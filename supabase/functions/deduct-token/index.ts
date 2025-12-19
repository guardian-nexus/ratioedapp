// Deduct Token Edge Function
// Handles secure server-side token deduction for chat export analysis

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Allowed origins for CORS (mobile apps + Supabase dashboard)
const ALLOWED_ORIGINS = [
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
  'exp://',
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  // For mobile apps, origin may be null or a special scheme
  // Allow requests from mobile apps and local development
  const isAllowed = !origin || ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));

  return {
    'Access-Control-Allow-Origin': isAllowed ? (origin || '*') : '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const count = body.count ?? 1;

    // Validate count parameter to prevent manipulation
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 10) {
      return new Response(
        JSON.stringify({ error: 'Invalid count parameter. Must be integer 1-10.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for unlimited subscription
    // TODO: Integrate with RevenueCat to check subscription status
    const isUnlimited = false; // Will be checked via RevenueCat

    if (isUnlimited) {
      // Skip deduction for unlimited users
      return new Response(
        JSON.stringify({ success: true, remaining: 999 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ATOMIC token deduction using raw SQL to prevent race conditions
    // This uses a single UPDATE with WHERE clause - if balance < count, no rows are updated
    const { data: result, error: rpcError } = await supabase.rpc('deduct_tokens_atomic', {
      p_user_id: user.id,
      p_count: count
    });

    // If RPC doesn't exist, fall back to conditional update approach
    if (rpcError && rpcError.message.includes('function') && rpcError.message.includes('does not exist')) {
      // Fallback: Get current balance, then do conditional update
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('token_balance')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ error: 'Profile not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (profile.token_balance < count) {
        return new Response(
          JSON.stringify({ error: 'Insufficient tokens', code: 'NO_TOKENS' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Atomic update: only succeeds if token_balance >= count at execution time
      const newBalance = profile.token_balance - count;
      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update({
          token_balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .eq('token_balance', profile.token_balance) // Optimistic lock - only update if balance unchanged
        .select('token_balance')
        .single();

      if (updateError || !updated) {
        // Race condition detected - balance changed between read and write
        return new Response(
          JSON.stringify({ error: 'Please try again', code: 'RETRY' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, remaining: updated.token_balance }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle RPC result
    if (rpcError) {
      console.error('RPC error:', rpcError);
      return new Response(
        JSON.stringify({ error: 'Failed to deduct tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // RPC returns: { success: boolean, remaining: number, error?: string }
    if (!result.success) {
      if (result.error === 'NO_TOKENS') {
        return new Response(
          JSON.stringify({ error: 'Insufficient tokens', code: 'NO_TOKENS' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: result.error || 'Failed to deduct tokens' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, remaining: result.remaining }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const corsHeaders = getCorsHeaders(req.headers.get('Origin'));
    console.error('Deduct token error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

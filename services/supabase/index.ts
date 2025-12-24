import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

import { AnalysisResult, AnalysisResponse, Pattern, ConversationVibe } from '@/types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Lazy initialization to avoid timing issues in production builds
let _supabase: SupabaseClient | null = null;

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    if (!_supabase) {
      _supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: {
            getItem: (key) => SecureStore.getItemAsync(key),
            setItem: (key, value) => SecureStore.setItemAsync(key, value),
            removeItem: (key) => SecureStore.deleteItemAsync(key),
          },
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      });
    }
    return (_supabase as unknown as Record<string, unknown>)[prop as string];
  },
});

// ============================================================================
// TYPES (matching actual Supabase schema)
// ============================================================================

interface ScanRow {
  id: string;
  user_id: string;
  score: number;
  score_label: string;
  stats: {
    messages: { you: number; them: number };
    words: { you: number; them: number };
    questions: { you: number; them: number };
    initiations: { you: number; them: number };
  };
  patterns: Pattern[];
  limitations: string[] | null;
  tagline: string;
  message_count: number;
  screenshot_count: number;
  created_at: string;
  label: string | null;
  compare_id: string | null;
  vibe: ConversationVibe | null;
}

interface ProfileRow {
  id: string;
  email: string | null;
  token_balance: number;
  created_at: string;
  updated_at: string;
  roast_mode: boolean;
  referral_count: number;
  tokens_earned_from_referrals: number;
}

interface InviteRow {
  id: string;
  code: string;
  created_by: string;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

// ============================================================================
// SCANS
// ============================================================================

// Generate a unique scan ID
function generateScanId(): string {
  return `scan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Save scan result
export async function saveScan(
  result: AnalysisResponse,
  label?: string,
  screenshotCount: number = 1,
  compareId?: string
): Promise<AnalysisResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const scanId = generateScanId();
  const messageCount = result.breakdown.messages.you + result.breakdown.messages.them;

  const insertData: Record<string, unknown> = {
    id: scanId,
    user_id: user.id,
    score: result.score,
    score_label: result.label,
    stats: result.breakdown,
    patterns: result.patterns,
    limitations: null,
    tagline: result.summary,
    message_count: messageCount,
    screenshot_count: screenshotCount,
    label,
    vibe: result.vibe || null,
  };

  // Add compare_id if provided
  if (compareId) {
    insertData.compare_id = compareId;
  }

  const { data, error } = await supabase
    .from('scans')
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;

  return scanRowToAnalysisResult(data as ScanRow);
}

// Get single scan
export async function getScan(id: string): Promise<AnalysisResult | null> {
  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return scanRowToAnalysisResult(data as ScanRow);
}

// Get scan history
export async function getScanHistory(): Promise<AnalysisResult[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return (data as ScanRow[]).map(scanRowToAnalysisResult);
}

// Update scan label
export async function updateScanLabel(id: string, label: string): Promise<void> {
  const { error } = await supabase
    .from('scans')
    .update({ label })
    .eq('id', id);

  if (error) throw error;
}

// Update scan compare_id (to link scans together for comparison)
export async function updateScanCompareId(id: string, compareId: string): Promise<void> {
  const { error } = await supabase
    .from('scans')
    .update({ compare_id: compareId })
    .eq('id', id);

  if (error) throw error;
}

// Delete single scan
export async function deleteScan(id: string): Promise<void> {
  const { error } = await supabase
    .from('scans')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Get scans with the same label for trend tracking
export async function getScansByLabel(label: string, excludeId?: string): Promise<AnalysisResult[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !label) return [];

  let query = supabase
    .from('scans')
    .select('*')
    .eq('user_id', user.id)
    .eq('label', label)
    .order('created_at', { ascending: true });

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query;

  if (error || !data) return [];
  return (data as ScanRow[]).map(scanRowToAnalysisResult);
}

// Get trend data for a conversation
export interface TrendData {
  previousScans: AnalysisResult[];
  trend: 'improving' | 'declining' | 'stable' | 'new';
  averageScore: number;
  scoreChange: number; // difference from previous scan
}

export async function getTrendData(scanId: string, label: string | undefined): Promise<TrendData | null> {
  if (!label) return null;

  const previousScans = await getScansByLabel(label, scanId);

  if (previousScans.length === 0) {
    return {
      previousScans: [],
      trend: 'new',
      averageScore: 0,
      scoreChange: 0,
    };
  }

  // Get current scan to compare
  const currentScan = await getScan(scanId);
  if (!currentScan) return null;

  // Calculate average score across previous scans
  const totalScore = previousScans.reduce((sum, scan) => sum + scan.score, 0);
  const averageScore = Math.round(totalScore / previousScans.length);

  // Get most recent previous scan for comparison
  const mostRecentPrevious = previousScans[previousScans.length - 1];
  const scoreChange = currentScan.score - mostRecentPrevious.score;

  // Determine trend
  let trend: TrendData['trend'] = 'stable';
  if (scoreChange >= 10) {
    trend = 'improving';
  } else if (scoreChange <= -10) {
    trend = 'declining';
  }

  return {
    previousScans,
    trend,
    averageScore,
    scoreChange,
  };
}

// Delete all scans for user
export async function deleteAllScans(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('scans')
    .delete()
    .eq('user_id', user.id);

  if (error) throw error;
}

// Helper to convert DB scan row to AnalysisResult
function scanRowToAnalysisResult(scan: ScanRow): AnalysisResult {
  return {
    id: scan.id,
    score: scan.score,
    label: scan.score_label,
    summary: scan.tagline,
    patterns: scan.patterns,
    breakdown: scan.stats,
    createdAt: scan.created_at,
    chatLabel: scan.label || undefined,
    compareId: scan.compare_id || undefined,
    vibe: scan.vibe || undefined,
  };
}

// ============================================================================
// PROFILES / CREDITS
// ============================================================================

// Get user profile
export async function getProfile(): Promise<ProfileRow | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !data) return null;
  return data as ProfileRow;
}

// Get user token balance
export async function getTokenBalance(): Promise<number> {
  const profile = await getProfile();
  return profile?.token_balance ?? 0;
}

// Get user roast mode preference
export async function getRoastModePreference(): Promise<boolean> {
  const profile = await getProfile();
  return profile?.roast_mode ?? false;
}

// Update roast mode preference
export async function updateRoastModePreference(enabled: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('profiles')
    .update({ roast_mode: enabled, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) throw error;
}

// Deduct a single token (atomic operation)
export async function decrementToken(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase.rpc('decrement_token', {
    p_user_id: user.id,
  });

  if (error) throw error;
  return data as boolean;
}

// Deduct multiple tokens (calls decrement_token multiple times)
export async function deductTokens(amount: number = 1): Promise<boolean> {
  for (let i = 0; i < amount; i++) {
    const success = await decrementToken();
    if (!success) return false;
  }
  return true;
}

// Refund a single token
export async function refundToken(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase.rpc('refund_token', {
    p_user_id: user.id,
  });

  if (error) throw error;
  return data as boolean;
}

// Add tokens (after purchase or promo)
export async function addTokens(amount: number): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase.rpc('add_tokens', {
    p_user_id: user.id,
    p_amount: amount,
  });

  if (error) throw error;
  return data as boolean;
}

// ============================================================================
// INVITE CODES (table: invites)
// ============================================================================

// Validate invite code (check if exists and not used)
export async function validateInviteCode(code: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('invites')
    .select('id, used_by')
    .eq('code', code.toUpperCase())
    .single();

  if (error || !data) return false;
  return data.used_by === null;
}

// Use invite code during signup (direct table update since no RPC)
export async function useInviteCode(code: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Update the invite code to mark it as used
  const { error } = await supabase
    .from('invites')
    .update({
      used_by: user.id,
      used_at: new Date().toISOString(),
    })
    .eq('code', code.toUpperCase())
    .is('used_by', null);

  if (error) throw error;

  // Reward the referrer (the person who created the invite)
  const { data: invite } = await supabase
    .from('invites')
    .select('created_by')
    .eq('code', code.toUpperCase())
    .single();

  if (invite?.created_by) {
    // Call reward_referrer RPC to give tokens to the referrer
    await supabase.rpc('reward_referrer', {
      p_user_id: invite.created_by,
      p_token_amount: 5, // Award 5 tokens for referral
    });
  }
}

// Get user's invite codes
export async function getUserInviteCodes(): Promise<{ code: string; used: boolean }[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('invites')
    .select('code, used_by')
    .eq('created_by', user.id);

  if (error || !data) return [];
  return data.map((row) => ({
    code: row.code,
    used: row.used_by !== null,
  }));
}

// Get invite codes with full details (for settings screen)
export async function getInviteCodes(): Promise<{
  id: string;
  code: string;
  usedBy: string | null;
  usedAt: string | null;
}[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('invites')
    .select('id, code, used_by, used_at')
    .eq('created_by', user.id)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    code: row.code,
    usedBy: row.used_by,
    usedAt: row.used_at,
  }));
}

// Generate invite codes for new user (called on signup)
export async function generateInviteCodes(count: number = 3): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Generate random invite codes
  const codes = Array.from({ length: count }, () =>
    generateRandomCode()
  );

  const invites = codes.map((code) => ({
    code,
    created_by: user.id,
  }));

  const { error } = await supabase
    .from('invites')
    .insert(invites);

  if (error) throw error;
}

// Generate a random 8-character invite code
function generateRandomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (0, O, 1, I)
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================================================
// PROMO CODES
// ============================================================================

// Validate promo code using RPC
export async function validatePromoCode(code: string): Promise<{
  valid: boolean;
  error?: string;
  credits?: number;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { valid: false, error: 'Not authenticated' };

  const { data, error } = await supabase.rpc('validate_promo_code', {
    p_code: code.toUpperCase(),
    p_user_id: user.id,
  });

  if (error) {
    return { valid: false, error: error.message };
  }

  // RPC returns TABLE(is_valid boolean, credits integer, error_message text)
  const result = data?.[0];
  if (!result) {
    return { valid: false, error: 'Invalid response from server' };
  }

  if (!result.is_valid) {
    return { valid: false, error: result.error_message || 'Invalid promo code' };
  }

  return { valid: true, credits: result.credits };
}

// Redeem promo code using RPC
export async function redeemPromoCode(code: string): Promise<{
  success: boolean;
  credits?: number;
  error?: string;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  try {
    const { data, error } = await supabase.rpc('redeem_promo_code', {
      p_code: code.toUpperCase(),
      p_user_id: user.id,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // RPC returns TABLE(success boolean, credits_added integer, error_message text)
    const result = data?.[0];
    if (!result) {
      return { success: false, error: 'Invalid response from server' };
    }

    if (!result.success) {
      return { success: false, error: result.error_message || 'Failed to redeem code' };
    }

    return { success: true, credits: result.credits_added };
  } catch (err) {
    return { success: false, error: 'Failed to redeem code' };
  }
}

// ============================================================================
// PURCHASES (for tracking IAP)
// ============================================================================

// Record a purchase
export async function recordPurchase(
  packageId: string,
  tokensAdded: number,
  amountCents: number
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('purchases')
    .insert({
      user_id: user.id,
      package_id: packageId,
      tokens_added: tokensAdded,
      amount_cents: amountCents,
    });

  if (error) throw error;
}

// ============================================================================
// WAITLIST
// ============================================================================

// Join waitlist
export async function joinWaitlist(
  email: string,
  source?: string,
  referrer?: string
): Promise<void> {
  const { error } = await supabase
    .from('waitlist')
    .insert({
      email: email.toLowerCase(),
      source,
      referrer,
    });

  if (error) {
    if (error.code === '23505') {
      throw new Error('Email already on waitlist');
    }
    throw error;
  }
}

// ============================================================================
// ACCOUNT DELETION
// ============================================================================

// Delete user account and all data
export async function deleteAccount(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Delete user data from each table (order matters for foreign keys)
  // 1. Delete scans
  await supabase.from('scans').delete().eq('user_id', user.id);

  // 2. Delete promo redemptions
  await supabase.from('promo_redemptions').delete().eq('user_id', user.id);

  // 3. Delete purchases
  await supabase.from('purchases').delete().eq('user_id', user.id);

  // 4. Update invite codes created by user (don't delete, just orphan them)
  // Or delete if you prefer:
  await supabase.from('invites').delete().eq('created_by', user.id);

  // 5. Delete profile
  await supabase.from('profiles').delete().eq('id', user.id);

  // 6. Sign out (this also deletes the auth.users record in some configs)
  await supabase.auth.signOut();
}

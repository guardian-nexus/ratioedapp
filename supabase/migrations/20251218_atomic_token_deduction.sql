-- Atomic Token Deduction Function
-- Prevents race conditions by using FOR UPDATE lock and single transaction
-- Run this in Supabase SQL Editor to create the function

CREATE OR REPLACE FUNCTION deduct_tokens_atomic(
  p_user_id UUID,
  p_count INTEGER DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Validate input
  IF p_count < 1 OR p_count > 10 THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_COUNT');
  END IF;

  -- Lock the row and get current balance atomically
  SELECT token_balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- Check if profile exists
  IF v_current_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'PROFILE_NOT_FOUND');
  END IF;

  -- Check if sufficient balance
  IF v_current_balance < p_count THEN
    RETURN json_build_object('success', false, 'error', 'NO_TOKENS', 'remaining', v_current_balance);
  END IF;

  -- Deduct tokens
  v_new_balance := v_current_balance - p_count;

  UPDATE profiles
  SET
    token_balance = v_new_balance,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'remaining', v_new_balance);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION deduct_tokens_atomic(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_tokens_atomic(UUID, INTEGER) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION deduct_tokens_atomic IS 'Atomically deducts tokens from user balance with race condition protection using FOR UPDATE lock';

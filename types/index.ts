// Analysis types
export interface AnalysisResult {
  id: string;
  score: number;
  label: string; // 'BALANCED' | 'MIXED' | 'ONE-SIDED AF' or custom
  summary: string;
  patterns: Pattern[];
  breakdown: Breakdown;
  createdAt: string;
  chatLabel?: string;
  compareId?: string;
  vibe?: ConversationVibe; // Phase 1: Conversation vibe/tone
}

export interface Pattern {
  title: string;
  description: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface Breakdown {
  messages: { you: number; them: number };
  words: { you: number; them: number };
  questions: { you: number; them: number };
  initiations: { you: number; them: number };
  responseTimes?: { you: number | null; them: number | null }; // avg response time in minutes
}

// Phase 1: Vibe/tone detection
export interface ConversationVibe {
  vibe: string;
  emoji: string;
  description: string;
}

// User/Profile types (matches actual Supabase schema)
export interface Profile {
  id: string;
  email: string | null;
  token_balance: number;
  created_at: string;
  updated_at: string;
  roast_mode: boolean;
  referral_count: number;
  tokens_earned_from_referrals: number;
}

// Scan types (matches actual Supabase schema)
export interface Scan {
  id: string; // text, not uuid
  user_id: string;
  score: number;
  score_label: string;
  stats: Breakdown;
  patterns: Pattern[];
  limitations: string[] | null;
  tagline: string;
  message_count: number;
  screenshot_count: number;
  created_at: string;
  label: string | null;
  compare_id: string | null;
}

// Invite code types (table: invites)
export interface InviteCode {
  id: string;
  code: string;
  created_by: string;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

// Promo code types
export interface PromoCode {
  id: string;
  code: string;
  credits: number;
  max_uses: number | null;
  times_used: number;
  expires_at: string | null;
  description: string | null;
  created_at: string;
}

// Promo redemption
export interface PromoRedemption {
  id: string;
  user_id: string;
  promo_code_id: string;
  credits_received: number;
  redeemed_at: string;
}

// Purchase record
export interface Purchase {
  id: string;
  user_id: string;
  package_id: string;
  tokens_added: number;
  amount_cents: number;
  created_at: string;
}

// Credits/Purchases (for UI)
export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: string;
  priceNumber: number;
  isBestValue?: boolean;
}

export interface Subscription {
  id: string;
  name: string;
  price: string;
  interval: 'month' | 'year';
}

// API types
export interface AnalysisRequest {
  images: string[]; // base64 encoded
  roastMode?: boolean;
}

export interface AnalysisResponse {
  score: number;
  label: string;
  summary: string;
  patterns: Pattern[];
  breakdown: Breakdown;
  vibe?: ConversationVibe; // Phase 1: Conversation vibe/tone
}

// Compare mode types
export interface CompareResult {
  personA: AnalysisResult;
  personB: AnalysisResult;
  comparison: {
    winner: 'A' | 'B' | 'tie';
    summary: string;
  };
}

// Waitlist
export interface WaitlistEntry {
  id: string;
  email: string;
  created_at: string;
  source: string | null;
  referrer: string | null;
}

// Group Chat Analysis Types
export interface GroupMemberStats {
  name: string;
  messageCount: number;
  wordCount: number;
  questionCount: number;
  avgWordsPerMessage: number;
  mediaCount: number; // links, images mentioned
  emojiCount: number;
  percentage: number; // % of total messages
}

export interface GroupMemberAnalysis {
  name: string;
  stats: GroupMemberStats;
  tags: GroupMemberTag[];
  rank: number;
}

export interface GroupMemberTag {
  label: string;
  emoji: string;
  description: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface GroupChatResponse {
  groupName?: string;
  totalMessages: number;
  totalParticipants: number;
  members: GroupMemberAnalysis[];
  summary: string;
  highlights: string[];
}

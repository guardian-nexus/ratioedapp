import { File } from 'expo-file-system/next';

import { supabase } from '@/services/supabase';
import { AnalysisResponse, Pattern, GroupChatResponse, GroupMemberAnalysis, GroupMemberTag } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

interface ImageContent {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

interface Message {
  text: string;
  sender: 'person1' | 'person2';
  hasQuestion: boolean;
  timestamp: string | null;
  wordCount?: number;
}

interface Participant {
  id: string;
  name?: string;
  position?: string;
  sampleMessages: string[];
}

interface OCRResult {
  messages: Message[];
  participants: Participant[];
  needsUserIdentification: boolean;
  confidence: number;
  warnings: string[];
}

interface Stats {
  messageRatio: number;
  wordRatio: number;
  questionRatio: number;
  userMessageCount: number;
  themMessageCount: number;
  userWordCount: number;
  themWordCount: number;
  userQuestionCount: number;
  themQuestionCount: number;
  // Phase 1: Response time analysis
  userAvgResponseMins: number | null;
  themAvgResponseMins: number | null;
  responseTimeRatio: number | null; // user/them - >1 means you're slower
}

interface InterpretationResult {
  tagline: string;
  insights: string[];
  alternativeReadings: string[];
}

// ============================================================================
// RETRY LOGIC WITH EXPONENTIAL BACKOFF
// ============================================================================

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableErrors?: string[];
}

// Note: Edge function already retries 3x, so keep client retries minimal
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 2,
  baseDelayMs: 3000,
  maxDelayMs: 10000,
  retryableErrors: ['RATE_LIMITED', 'API_UNAVAILABLE', 'MAINTENANCE', 'overloaded', '529', '503'],
};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries!; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if this error is retryable
      const isRetryable = opts.retryableErrors!.some(
        e => lastError!.message.includes(e)
      );

      // Don't retry non-retryable errors or if we've exhausted retries
      if (!isRetryable || attempt >= opts.maxRetries!) {
        throw lastError;
      }

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = opts.baseDelayMs! * Math.pow(2, attempt);
      const jitter = Math.random() * 500;
      const delay = Math.min(exponentialDelay + jitter, opts.maxDelayMs!);

      if (__DEV__) {
        console.log(`Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms`);
      }

      await sleep(delay);
    }
  }

  throw lastError || new Error('Retry failed');
}

// ============================================================================
// EDGE FUNCTION CALLS
// ============================================================================

async function callAnalyzeScan(images: ImageContent[]): Promise<OCRResult> {
  return withRetry(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/analyze-scan`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ images }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      // Handle specific error codes
      if (data.code === 'NO_TOKENS') {
        throw new Error('NO_TOKENS');
      }
      if (data.code === 'RATE_LIMITED') {
        throw new Error('RATE_LIMITED');
      }
      if (data.code === 'API_UNAVAILABLE' || data.code === 'MAINTENANCE') {
        throw new Error('MAINTENANCE');
      }
      if (data.code === 'API_CREDITS_EXHAUSTED') {
        throw new Error('API_CREDITS_EXHAUSTED');
      }
      // Handle HTTP status codes for API issues
      if (response.status === 529 || response.status === 503 || response.status === 502) {
        throw new Error('API_UNAVAILABLE');
      }
      throw new Error(data.error || 'Analysis failed');
    }

    return data as OCRResult;
  }, {
    // Don't retry NO_TOKENS or API_CREDITS_EXHAUSTED - those are permanent failures
    retryableErrors: ['RATE_LIMITED', 'API_UNAVAILABLE', 'MAINTENANCE'],
  });
}

async function callInterpretPatterns(
  messages: Message[],
  stats: Stats,
  patterns: { name: string }[]
): Promise<InterpretationResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  // Format messages for the edge function (rename sender to match expected format)
  const formattedMessages = messages.map((msg) => ({
    text: msg.text,
    sender: msg.sender === 'person1' ? 'user' : 'them',
  }));

  const response = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/interpret-patterns`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        messages: formattedMessages,
        stats,
        patterns,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Interpretation failed');
  }

  return data as InterpretationResult;
}

// ============================================================================
// LOCAL COMPUTATION
// ============================================================================

/**
 * Parse timestamp string to Date object
 * Handles formats: "1/15/24, 3:45 PM", "1/15/2024 3:45:00 PM", etc.
 */
function parseTimestamp(timestamp: string | null): Date | null {
  if (!timestamp) return null;

  try {
    // Try parsing common formats
    const cleaned = timestamp.trim();

    // Format: 1/15/24, 3:45 PM or 1/15/24 3:45 PM
    const match = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
    if (match) {
      let [, month, day, year, hour, minute, , ampm] = match;
      let yearNum = parseInt(year);
      if (yearNum < 100) yearNum += 2000; // Convert 24 to 2024

      let hourNum = parseInt(hour);
      if (ampm?.toUpperCase() === 'PM' && hourNum !== 12) hourNum += 12;
      if (ampm?.toUpperCase() === 'AM' && hourNum === 12) hourNum = 0;

      return new Date(yearNum, parseInt(month) - 1, parseInt(day), hourNum, parseInt(minute));
    }

    // Fallback to Date.parse
    const parsed = Date.parse(cleaned);
    if (!isNaN(parsed)) return new Date(parsed);

    return null;
  } catch {
    return null;
  }
}

/**
 * Calculate average response times for each participant
 */
function calculateResponseTimes(messages: Message[]): {
  userAvgMins: number | null;
  themAvgMins: number | null;
} {
  const userResponseTimes: number[] = [];
  const themResponseTimes: number[] = [];

  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1];
    const curr = messages[i];

    // Skip if same sender (not a response)
    if (prev.sender === curr.sender) continue;

    const prevTime = parseTimestamp(prev.timestamp);
    const currTime = parseTimestamp(curr.timestamp);

    if (!prevTime || !currTime) continue;

    const diffMs = currTime.getTime() - prevTime.getTime();
    // Only count reasonable response times (< 24 hours, > 0)
    if (diffMs <= 0 || diffMs > 24 * 60 * 60 * 1000) continue;

    const diffMins = diffMs / (1000 * 60);

    if (curr.sender === 'person1') {
      userResponseTimes.push(diffMins);
    } else {
      themResponseTimes.push(diffMins);
    }
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  return {
    userAvgMins: avg(userResponseTimes),
    themAvgMins: avg(themResponseTimes),
  };
}

function computeStats(messages: Message[]): Stats {
  const userMessages = messages.filter((m) => m.sender === 'person1');
  const themMessages = messages.filter((m) => m.sender === 'person2');

  const userMessageCount = userMessages.length;
  const themMessageCount = themMessages.length;

  const userWordCount = userMessages.reduce((sum, m) => sum + (m.wordCount || m.text.split(/\s+/).filter(w => w).length), 0);
  const themWordCount = themMessages.reduce((sum, m) => sum + (m.wordCount || m.text.split(/\s+/).filter(w => w).length), 0);

  const userQuestionCount = userMessages.filter((m) => m.hasQuestion).length;
  const themQuestionCount = themMessages.filter((m) => m.hasQuestion).length;

  // Calculate response times
  const responseTimes = calculateResponseTimes(messages);
  const responseTimeRatio = (responseTimes.userAvgMins !== null && responseTimes.themAvgMins !== null && responseTimes.themAvgMins > 0)
    ? responseTimes.userAvgMins / responseTimes.themAvgMins
    : null;

  return {
    userMessageCount,
    themMessageCount,
    userWordCount,
    themWordCount,
    userQuestionCount,
    themQuestionCount,
    messageRatio: themMessageCount > 0 ? userMessageCount / themMessageCount : userMessageCount,
    wordRatio: themWordCount > 0 ? userWordCount / themWordCount : userWordCount,
    questionRatio: themQuestionCount > 0 ? userQuestionCount / themQuestionCount : userQuestionCount,
    userAvgResponseMins: responseTimes.userAvgMins,
    themAvgResponseMins: responseTimes.themAvgMins,
    responseTimeRatio,
  };
}

function detectPatterns(messages: Message[], stats: Stats): Pattern[] {
  const patterns: Pattern[] = [];
  const redFlags: Pattern[] = [];
  const greenFlags: Pattern[] = [];

  // ============================================================================
  // RED FLAGS 🚩
  // ============================================================================

  // Double texting detection
  let consecutiveUserMessages = 0;
  let maxConsecutive = 0;
  for (const msg of messages) {
    if (msg.sender === 'person1') {
      consecutiveUserMessages++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveUserMessages);
    } else {
      consecutiveUserMessages = 0;
    }
  }
  if (maxConsecutive >= 3) {
    redFlags.push({
      title: '🚩 Double Texting',
      description: `You sent ${maxConsecutive} messages in a row without a response`,
      sentiment: 'negative',
    });
  }

  // One-word responses
  const themMessages = messages.filter((m) => m.sender === 'person2');
  const shortResponses = themMessages.filter((m) => m.text.split(/\s+/).length <= 2);
  if (themMessages.length > 3 && shortResponses.length / themMessages.length > 0.5) {
    redFlags.push({
      title: '🚩 Dry Texter',
      description: 'More than half their replies are just a few words',
      sentiment: 'negative',
    });
  }

  // One-way questions (you asking, they never ask)
  if (stats.userQuestionCount >= 3 && stats.themQuestionCount === 0) {
    redFlags.push({
      title: '🚩 No Curiosity',
      description: "They haven't asked you a single question",
      sentiment: 'negative',
    });
  }

  // Response time: they take way longer
  if (stats.responseTimeRatio !== null && stats.responseTimeRatio < 0.3 && stats.themAvgResponseMins !== null) {
    const theirTime = stats.themAvgResponseMins;
    const timeDesc = theirTime > 60
      ? `${Math.round(theirTime / 60)} hours`
      : `${Math.round(theirTime)} min`;
    redFlags.push({
      title: '🚩 Slow to Reply',
      description: `They take ~${timeDesc} to respond on average`,
      sentiment: 'negative',
    });
  }

  // Effort imbalance (user doing way more)
  if (stats.messageRatio > 2.5) {
    redFlags.push({
      title: '🚩 One-Sided Effort',
      description: "You're carrying this conversation",
      sentiment: 'negative',
    });
  }

  // Late night only texting (check timestamps)
  const themWithTime = messages.filter((m) => m.sender === 'person2' && m.timestamp);
  if (themWithTime.length >= 3) {
    const lateNightCount = themWithTime.filter((m) => {
      const date = parseTimestamp(m.timestamp);
      if (!date) return false;
      const hour = date.getHours();
      return hour >= 22 || hour < 5; // 10pm - 5am
    }).length;

    if (lateNightCount / themWithTime.length > 0.7) {
      redFlags.push({
        title: '🚩 Late Night Only',
        description: 'Most of their texts come after 10pm',
        sentiment: 'negative',
      });
    }
  }

  // ============================================================================
  // GREEN FLAGS ✅
  // ============================================================================

  // Balanced energy
  if (stats.messageRatio >= 0.8 && stats.messageRatio <= 1.2 && stats.wordRatio >= 0.7 && stats.wordRatio <= 1.4) {
    greenFlags.push({
      title: '✅ Matched Energy',
      description: 'Both sides are putting in similar effort',
      sentiment: 'positive',
    });
  }

  // They ask questions too
  if (stats.themQuestionCount >= 2 && stats.questionRatio <= 2 && stats.questionRatio >= 0.5) {
    greenFlags.push({
      title: '✅ Shows Interest',
      description: 'They ask you questions back',
      sentiment: 'positive',
    });
  }

  // They're more invested
  if (stats.messageRatio < 0.7) {
    greenFlags.push({
      title: '✅ They Initiate',
      description: "They're reaching out more than you",
      sentiment: 'positive',
    });
  }

  // Response time: they respond quickly
  if (stats.themAvgResponseMins !== null && stats.themAvgResponseMins < 10) {
    greenFlags.push({
      title: '✅ Quick Replies',
      description: 'They typically respond within 10 minutes',
      sentiment: 'positive',
    });
  }

  // Good message length from them
  const themWordAvg = themMessages.length > 0
    ? stats.themWordCount / themMessages.length
    : 0;
  if (themWordAvg >= 8 && themMessages.length >= 3) {
    greenFlags.push({
      title: '✅ Thoughtful Replies',
      description: 'They write substantive messages',
      sentiment: 'positive',
    });
  }

  // ============================================================================
  // NEUTRAL PATTERNS
  // ============================================================================

  // Question imbalance (not extreme)
  if (stats.questionRatio > 2 && stats.themQuestionCount > 0) {
    patterns.push({
      title: 'Question Imbalance',
      description: 'You ask more questions than them',
      sentiment: 'neutral',
    });
  }

  // Response time info (neutral case)
  if (stats.responseTimeRatio !== null && stats.responseTimeRatio >= 0.3 && stats.responseTimeRatio <= 3) {
    // Roughly similar response times - don't add a pattern, it's normal
  }

  // ============================================================================
  // COMBINE: Prioritize red flags, then green flags, then neutral
  // ============================================================================

  const allPatterns = [...redFlags, ...greenFlags, ...patterns];
  return allPatterns.slice(0, 4); // Max 4 patterns
}

// ============================================================================
// VIBE/TONE DETECTION
// ============================================================================

type ConversationVibe = {
  vibe: string;
  emoji: string;
  description: string;
};

function detectVibe(messages: Message[], stats: Stats): ConversationVibe {
  const themMessages = messages.filter((m) => m.sender === 'person2');
  const allText = messages.map((m) => m.text).join(' ').toLowerCase();
  const theirText = themMessages.map((m) => m.text).join(' ').toLowerCase();

  // Emoji patterns
  const flirtyEmojis = /[😘😍🥰💕❤️💋😏🔥💗💓💖😉🫶]/g;
  const happyEmojis = /[😂🤣😊😁😆🥹☺️😃😄]/g;
  const coldEmojis = /[🙄😐😑💀😒]/g;

  const theirFlirtyCount = (theirText.match(flirtyEmojis) || []).length;
  const theirHappyCount = (theirText.match(happyEmojis) || []).length;
  const theirColdCount = (theirText.match(coldEmojis) || []).length;

  // Text patterns
  const flirtyWords = /\b(cute|miss you|thinking of you|can't wait|love|babe|baby|handsome|beautiful|gorgeous)\b/gi;
  const engagedWords = /\b(tell me more|that's interesting|really\?|omg|no way|haha|lol|lmao)\b/gi;
  const dryWords = /^(ok|k|sure|fine|cool|yea|yeah|yep|mhm|idk)$/i;

  const theirFlirtyWordCount = (theirText.match(flirtyWords) || []).length;
  const theirEngagedCount = (theirText.match(engagedWords) || []).length;

  // Check for dry responses
  const dryResponseCount = themMessages.filter((m) => dryWords.test(m.text.trim())).length;
  const dryRatio = themMessages.length > 0 ? dryResponseCount / themMessages.length : 0;

  // Average words per message for them
  const themAvgWords = themMessages.length > 0 ? stats.themWordCount / themMessages.length : 0;

  // Scoring
  let vibeScore = {
    flirty: theirFlirtyCount * 2 + theirFlirtyWordCount * 3,
    engaged: theirHappyCount + theirEngagedCount * 2 + (themAvgWords > 6 ? 3 : 0),
    dry: dryRatio * 10 + theirColdCount * 2 + (themAvgWords < 3 ? 3 : 0),
    cold: theirColdCount * 3 + (stats.themAvgResponseMins !== null && stats.themAvgResponseMins > 60 ? 3 : 0),
  };

  // Determine dominant vibe
  const maxScore = Math.max(vibeScore.flirty, vibeScore.engaged, vibeScore.dry, vibeScore.cold);

  // If low engagement overall
  if (maxScore < 2 && stats.messageRatio > 1.5) {
    return {
      vibe: 'Low Energy',
      emoji: '😴',
      description: "They're not giving much to work with",
    };
  }

  if (vibeScore.flirty >= maxScore && vibeScore.flirty >= 3) {
    return {
      vibe: 'Flirty',
      emoji: '🔥',
      description: 'The energy is definitely there',
    };
  }

  if (vibeScore.engaged >= maxScore && vibeScore.engaged >= 3) {
    return {
      vibe: 'Engaged',
      emoji: '💬',
      description: "They're actively participating",
    };
  }

  if (vibeScore.dry >= maxScore && vibeScore.dry >= 4) {
    return {
      vibe: 'Dry',
      emoji: '🏜️',
      description: 'One-word replies and minimal effort',
    };
  }

  if (vibeScore.cold >= maxScore && vibeScore.cold >= 3) {
    return {
      vibe: 'Distant',
      emoji: '❄️',
      description: 'Something feels off',
    };
  }

  // Check balance for neutral vibes
  if (stats.messageRatio >= 0.8 && stats.messageRatio <= 1.2) {
    return {
      vibe: 'Balanced',
      emoji: '⚖️',
      description: 'Steady back-and-forth energy',
    };
  }

  if (stats.messageRatio < 0.8) {
    return {
      vibe: 'Interested',
      emoji: '👀',
      description: "They're putting in effort",
    };
  }

  return {
    vibe: 'Mixed',
    emoji: '🤷',
    description: 'Hard to read, keep observing',
  };
}

function calculateScore(stats: Stats): number {
  // Score based on how balanced the conversation is
  // 100 = perfectly balanced, 0 = completely one-sided

  const messageBalance = Math.min(stats.messageRatio, 1 / stats.messageRatio);
  const wordBalance = Math.min(stats.wordRatio, 1 / stats.wordRatio);

  // Weight message count more heavily
  const balanceScore = (messageBalance * 0.6 + wordBalance * 0.4) * 100;

  // Clamp to 0-100
  return Math.round(Math.max(0, Math.min(100, balanceScore)));
}

function getScoreLabel(score: number): string {
  if (score >= 60) return 'BALANCED';
  if (score >= 40) return 'MIXED';
  return 'ONE-SIDED';
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

export async function analyzeConversation(
  imageUris: string[],
  _roastMode: boolean = false // Reserved for future use
): Promise<AnalysisResponse> {
  // Convert images to base64
  const images: ImageContent[] = await Promise.all(
    imageUris.map(async (uri) => {
      const file = new File(uri);
      const base64 = await file.base64();

      // Determine media type from URI
      const extension = uri.split('.').pop()?.toLowerCase();
      let mediaType = 'image/jpeg';
      if (extension === 'png') mediaType = 'image/png';
      else if (extension === 'gif') mediaType = 'image/gif';
      else if (extension === 'webp') mediaType = 'image/webp';

      return {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: mediaType,
          data: base64,
        },
      };
    })
  );

  // Step 1: Call analyze-scan edge function (extracts messages, deducts token)
  const ocrResult = await callAnalyzeScan(images);

  // Step 2: Compute stats locally
  const stats = computeStats(ocrResult.messages);

  // Step 3: Detect patterns locally
  const patterns = detectPatterns(ocrResult.messages, stats);

  // Step 4: Calculate score
  const score = calculateScore(stats);
  const label = getScoreLabel(score);

  // Step 5: Call interpret-patterns for tagline (optional, graceful fallback)
  let tagline = getDefaultTagline(stats);
  try {
    const interpretation = await callInterpretPatterns(
      ocrResult.messages,
      stats,
      patterns.map((p) => ({ name: p.title }))
    );
    if (interpretation.tagline) {
      tagline = interpretation.tagline;
    }
  } catch (error) {
    // Fallback to default tagline if interpretation fails
    if (__DEV__) {
      console.warn('Interpretation failed, using default tagline:', error);
    }
  }

  // Step 6: Detect vibe
  const vibe = detectVibe(ocrResult.messages, stats);

  return {
    score,
    label,
    summary: tagline,
    patterns,
    breakdown: {
      messages: { you: stats.userMessageCount, them: stats.themMessageCount },
      words: { you: stats.userWordCount, them: stats.themWordCount },
      questions: { you: stats.userQuestionCount, them: stats.themQuestionCount },
      initiations: { you: 0, them: 0 }, // TODO: Calculate initiations if needed
      responseTimes: {
        you: stats.userAvgResponseMins,
        them: stats.themAvgResponseMins,
      },
    },
    vibe,
  };
}

// Default tagline based on stats
function getDefaultTagline(stats: Stats): string {
  const ratio = stats.messageRatio;

  if (ratio > 3) return "You're carrying this conversation";
  if (ratio > 2) return "You're doing most of the heavy lifting";
  if (ratio > 1.5) return "The energy isn't quite matched";
  if (ratio > 1.2) return "Slightly uneven, but not too bad";
  if (ratio >= 0.8) return "The conversation looks balanced";
  if (ratio >= 0.67) return "They're slightly more invested";
  if (ratio >= 0.5) return "They're putting in more effort";
  if (ratio >= 0.33) return "They're really carrying this one";
  return "They're doing all the work here";
}

// ============================================================================
// TEXT CHAT EXPORT PARSING
// ============================================================================

interface ParsedMessage {
  text: string;
  sender: string;
  timestamp?: string;
}

function parseWhatsAppFormat(text: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  // WhatsApp format: [1/15/24, 3:45 PM] Name: message
  // Or: 1/15/24, 3:45 PM - Name: message
  const lines = text.split('\n');

  for (const line of lines) {
    // Try format: [date, time] Name: message
    let match = line.match(/^\[?(\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\]?\s*[-–]?\s*([^:]+):\s*(.+)$/i);
    if (match) {
      messages.push({
        timestamp: match[1],
        sender: match[2].trim(),
        text: match[3].trim(),
      });
      continue;
    }

    // Try simpler format: Name: message
    match = line.match(/^([^:]+):\s*(.+)$/);
    if (match && !line.includes('http') && match[1].length < 50) {
      messages.push({
        sender: match[1].trim(),
        text: match[2].trim(),
      });
    }
  }

  return messages;
}

function parseIMessageFormat(text: string): ParsedMessage[] {
  // iMessage exports vary, try common patterns
  const messages: ParsedMessage[] = [];
  const lines = text.split('\n');

  let currentSender = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if this is a sender header line
    const senderMatch = trimmed.match(/^(From|To|Me|You):\s*(.+)?$/i);
    if (senderMatch) {
      currentSender = senderMatch[1];
      if (senderMatch[2]) {
        messages.push({ sender: currentSender, text: senderMatch[2] });
      }
      continue;
    }

    // Check for timestamp + sender format
    const tsMatch = trimmed.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\s*[-–]?\s*([^:]+):\s*(.+)$/i);
    if (tsMatch) {
      messages.push({
        timestamp: tsMatch[1],
        sender: tsMatch[2].trim(),
        text: tsMatch[3].trim(),
      });
      continue;
    }

    // If we have a current sender and this is a plain message
    if (currentSender && trimmed.length > 0 && !trimmed.match(/^\d{1,2}[\/\-]/)) {
      messages.push({ sender: currentSender, text: trimmed });
    }
  }

  return messages;
}

function parseChatExport(text: string): ParsedMessage[] {
  // Try WhatsApp format first (most common)
  let messages = parseWhatsAppFormat(text);

  // If we got messages, return them
  if (messages.length > 2) return messages;

  // Try iMessage format
  messages = parseIMessageFormat(text);
  if (messages.length > 2) return messages;

  // Generic fallback: look for any "Name: message" patterns
  return parseWhatsAppFormat(text);
}

function identifyUserInChat(messages: ParsedMessage[]): { userNames: string[]; themNames: string[] } {
  // Get unique senders
  const senderCounts: Record<string, number> = {};
  for (const msg of messages) {
    const sender = msg.sender.toLowerCase();
    senderCounts[sender] = (senderCounts[sender] || 0) + 1;
  }

  const senders = Object.entries(senderCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  // Look for obvious user indicators
  const userIndicators = ['me', 'you', 'i', 'myself'];
  const userNames: string[] = [];
  const themNames: string[] = [];

  for (const sender of senders) {
    const lower = sender.toLowerCase();
    if (userIndicators.includes(lower) || lower.includes('(you)') || lower.includes('(me)')) {
      userNames.push(sender);
    } else {
      themNames.push(sender);
    }
  }

  // If no clear user identified, assume first sender with most messages is "them"
  // and second is "you" (since user is uploading to analyze the other person)
  if (userNames.length === 0 && senders.length >= 2) {
    // In most cases, user wants to see if the OTHER person is invested
    // So we assume the uploader is person1 (you)
    themNames.push(senders[0]);
    userNames.push(senders[1] || 'You');
  } else if (userNames.length === 0 && senders.length === 1) {
    themNames.push(senders[0]);
    userNames.push('You');
  }

  return { userNames, themNames };
}

export async function analyzeTextContent(textContent: string): Promise<AnalysisResponse> {
  // Parse the chat export
  const parsedMessages = parseChatExport(textContent);

  if (parsedMessages.length < 3) {
    throw new Error('Could not parse enough messages from the text. Please check the format.');
  }

  // Identify user vs them
  const { userNames, themNames } = identifyUserInChat(parsedMessages);

  // Convert to Message format
  const messages: Message[] = parsedMessages.map((pm) => {
    const senderLower = pm.sender.toLowerCase();
    const isUser = userNames.some((un) => senderLower.includes(un.toLowerCase()));

    return {
      text: pm.text,
      sender: isUser ? 'person1' : 'person2',
      hasQuestion: pm.text.includes('?'),
      timestamp: pm.timestamp || null,
      wordCount: pm.text.split(/\s+/).filter((w) => w).length,
    };
  });

  // Compute stats locally
  const stats = computeStats(messages);

  // Detect patterns locally
  const patterns = detectPatterns(messages, stats);

  // Calculate score
  const score = calculateScore(stats);
  const label = getScoreLabel(score);

  // Get default tagline (skip interpretation for text exports to save API calls)
  const tagline = getDefaultTagline(stats);

  // Detect vibe
  const vibe = detectVibe(messages, stats);

  // Deduct token via edge function
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  // Call a lightweight edge function just for token deduction
  const response = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/deduct-token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ count: 1 }),
    }
  );

  if (!response.ok) {
    const data = await response.json();
    if (data.code === 'NO_TOKENS') {
      throw new Error('NO_TOKENS');
    }
    throw new Error(data.error || 'Token deduction failed');
  }

  return {
    score,
    label,
    summary: tagline,
    patterns,
    breakdown: {
      messages: { you: stats.userMessageCount, them: stats.themMessageCount },
      words: { you: stats.userWordCount, them: stats.themWordCount },
      questions: { you: stats.userQuestionCount, them: stats.themQuestionCount },
      initiations: { you: 0, them: 0 },
      responseTimes: {
        you: stats.userAvgResponseMins,
        them: stats.themAvgResponseMins,
      },
    },
    vibe,
  };
}

// ============================================================================
// GROUP CHAT ANALYSIS
// ============================================================================

interface GroupMemberRawStats {
  messageCount: number;
  wordCount: number;
  questionCount: number;
  mediaCount: number;
  emojiCount: number;
  messages: string[];
}

function countEmojis(text: string): number {
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const matches = text.match(emojiRegex);
  return matches ? matches.length : 0;
}

function countMedia(text: string): number {
  // Count links, image references, video references
  const mediaPatterns = [
    /https?:\/\/[^\s]+/gi, // URLs
    /<Media omitted>/gi, // WhatsApp media placeholder
    /\.(jpg|jpeg|png|gif|mp4|mov|webp|webm)/gi, // File extensions
    /\[image\]/gi,
    /\[video\]/gi,
    /\[gif\]/gi,
    /\[sticker\]/gi,
  ];

  let count = 0;
  for (const pattern of mediaPatterns) {
    const matches = text.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

function assignMemberTags(stats: GroupMemberRawStats, totalMessages: number, allMembersStats: Map<string, GroupMemberRawStats>): GroupMemberTag[] {
  const tags: GroupMemberTag[] = [];
  const percentage = (stats.messageCount / totalMessages) * 100;
  const avgWords = stats.messageCount > 0 ? stats.wordCount / stats.messageCount : 0;

  // Calculate averages across all members for comparison
  const allStats = Array.from(allMembersStats.values());
  const avgMediaAcrossAll = allStats.reduce((sum, s) => sum + s.mediaCount, 0) / allStats.length;
  const avgMessagesAcrossAll = totalMessages / allStats.length;
  const avgQuestionsAcrossAll = allStats.reduce((sum, s) => sum + s.questionCount, 0) / allStats.length;

  // Top contributor
  if (percentage > 30) {
    tags.push({
      label: 'Carrying',
      emoji: '💪',
      description: 'Does most of the talking',
      sentiment: 'positive',
    });
  }

  // Lurker
  if (percentage < 5 && allStats.length > 3) {
    tags.push({
      label: 'Lurker',
      emoji: '👀',
      description: 'Barely participates',
      sentiment: 'negative',
    });
  }

  // Meme lord / Media sender
  if (stats.mediaCount > avgMediaAcrossAll * 2 && stats.mediaCount >= 3) {
    tags.push({
      label: 'Meme Lord',
      emoji: '🎭',
      description: 'Mostly sends media/links',
      sentiment: 'neutral',
    });
  }

  // One-liner
  if (avgWords < 4 && stats.messageCount >= 5) {
    tags.push({
      label: 'One-liner',
      emoji: '💬',
      description: 'Keeps it short',
      sentiment: 'neutral',
    });
  }

  // Essay writer
  if (avgWords > 20 && stats.messageCount >= 3) {
    tags.push({
      label: 'Essay Writer',
      emoji: '📝',
      description: 'Writes long messages',
      sentiment: 'neutral',
    });
  }

  // Question master
  if (stats.questionCount > avgQuestionsAcrossAll * 2 && stats.questionCount >= 3) {
    tags.push({
      label: 'Curious',
      emoji: '❓',
      description: 'Asks lots of questions',
      sentiment: 'positive',
    });
  }

  // Emoji enthusiast
  if (stats.emojiCount > 10 && stats.emojiCount / stats.messageCount > 1) {
    tags.push({
      label: 'Emoji Fan',
      emoji: '😂',
      description: 'Loves their emojis',
      sentiment: 'neutral',
    });
  }

  // Ghost - very few messages relative to average
  if (stats.messageCount < avgMessagesAcrossAll * 0.2 && allStats.length > 2) {
    tags.push({
      label: 'Ghost',
      emoji: '👻',
      description: 'Rarely shows up',
      sentiment: 'negative',
    });
  }

  // Active participant - near average or above
  if (percentage >= 15 && percentage <= 30 && tags.length === 0) {
    tags.push({
      label: 'Active',
      emoji: '✨',
      description: 'Consistently engaged',
      sentiment: 'positive',
    });
  }

  // If no tags assigned, give a neutral one
  if (tags.length === 0) {
    tags.push({
      label: 'Casual',
      emoji: '👋',
      description: 'Chimes in occasionally',
      sentiment: 'neutral',
    });
  }

  return tags.slice(0, 3); // Max 3 tags per person
}

function generateGroupSummary(members: GroupMemberAnalysis[], totalMessages: number): string {
  const topContributor = members[0];
  const bottomContributor = members[members.length - 1];

  if (members.length === 2) {
    const diff = topContributor.stats.percentage - bottomContributor.stats.percentage;
    if (diff < 20) {
      return 'Pretty balanced conversation between you two';
    }
    return `${topContributor.name} is doing most of the talking`;
  }

  const carrierTag = topContributor.tags.find((t) => t.label === 'Carrying');
  const lurkerCount = members.filter((m) => m.tags.some((t) => t.label === 'Lurker' || t.label === 'Ghost')).length;

  if (carrierTag && lurkerCount > 1) {
    return `${topContributor.name} is carrying while ${lurkerCount} people barely show up`;
  }

  if (carrierTag) {
    return `${topContributor.name} keeps this chat alive`;
  }

  if (lurkerCount >= members.length / 2) {
    return 'Half the group is barely participating';
  }

  // Check for balanced conversation
  const topThreePercentage = members.slice(0, 3).reduce((sum, m) => sum + m.stats.percentage, 0);
  if (topThreePercentage < 70 && members.length > 3) {
    return 'The energy is pretty well distributed';
  }

  return `${topContributor.name} leads the conversation`;
}

function generateHighlights(members: GroupMemberAnalysis[]): string[] {
  const highlights: string[] = [];

  // Find interesting facts
  const memeLord = members.find((m) => m.tags.some((t) => t.label === 'Meme Lord'));
  if (memeLord) {
    highlights.push(`${memeLord.name} is basically just here for the memes`);
  }

  const essayWriter = members.find((m) => m.tags.some((t) => t.label === 'Essay Writer'));
  if (essayWriter) {
    highlights.push(`${essayWriter.name} writes novels in the chat`);
  }

  const ghosts = members.filter((m) => m.tags.some((t) => t.label === 'Ghost' || t.label === 'Lurker'));
  if (ghosts.length === 1) {
    highlights.push(`${ghosts[0].name} needs to step it up`);
  } else if (ghosts.length > 1) {
    highlights.push(`${ghosts.map((g) => g.name).join(' and ')} are basically invisible`);
  }

  const curious = members.find((m) => m.tags.some((t) => t.label === 'Curious'));
  if (curious) {
    highlights.push(`${curious.name} keeps the conversation going with questions`);
  }

  // Top contributor stat
  const top = members[0];
  if (top.stats.percentage > 40) {
    highlights.push(`${top.name} sends ${Math.round(top.stats.percentage)}% of all messages`);
  }

  return highlights.slice(0, 4);
}

export async function analyzeGroupChat(textContent: string): Promise<GroupChatResponse> {
  // Parse the chat export
  const parsedMessages = parseChatExport(textContent);

  if (parsedMessages.length < 5) {
    throw new Error('Could not parse enough messages from the group chat. Please check the format.');
  }

  // Build stats per member
  const memberStats = new Map<string, GroupMemberRawStats>();

  for (const msg of parsedMessages) {
    const sender = msg.sender;
    if (!memberStats.has(sender)) {
      memberStats.set(sender, {
        messageCount: 0,
        wordCount: 0,
        questionCount: 0,
        mediaCount: 0,
        emojiCount: 0,
        messages: [],
      });
    }

    const stats = memberStats.get(sender)!;
    stats.messageCount++;
    stats.wordCount += msg.text.split(/\s+/).filter((w) => w).length;
    stats.questionCount += msg.text.includes('?') ? 1 : 0;
    stats.mediaCount += countMedia(msg.text);
    stats.emojiCount += countEmojis(msg.text);
    stats.messages.push(msg.text);
  }

  const totalMessages = parsedMessages.length;

  // Convert to member analysis with tags and ranking
  const members: GroupMemberAnalysis[] = Array.from(memberStats.entries())
    .map(([name, stats]) => {
      const percentage = (stats.messageCount / totalMessages) * 100;
      return {
        name,
        stats: {
          name,
          messageCount: stats.messageCount,
          wordCount: stats.wordCount,
          questionCount: stats.questionCount,
          avgWordsPerMessage: stats.messageCount > 0 ? Math.round(stats.wordCount / stats.messageCount * 10) / 10 : 0,
          mediaCount: stats.mediaCount,
          emojiCount: stats.emojiCount,
          percentage: Math.round(percentage * 10) / 10,
        },
        tags: assignMemberTags(stats, totalMessages, memberStats),
        rank: 0,
      };
    })
    .sort((a, b) => b.stats.messageCount - a.stats.messageCount)
    .map((member, index) => ({ ...member, rank: index + 1 }));

  // Generate summary and highlights
  const summary = generateGroupSummary(members, totalMessages);
  const highlights = generateHighlights(members);

  // Deduct token
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/deduct-token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ count: 1 }),
    }
  );

  if (!response.ok) {
    const data = await response.json();
    if (data.code === 'NO_TOKENS') {
      throw new Error('NO_TOKENS');
    }
    throw new Error(data.error || 'Token deduction failed');
  }

  return {
    totalMessages,
    totalParticipants: members.length,
    members,
    summary,
    highlights,
  };
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'NO_TOKENS') {
      return 'You need more scan credits to analyze this conversation.';
    }
    if (error.message === 'RATE_LIMITED') {
      return "We're experiencing high demand. Please try again in a moment.";
    }
    if (error.message === 'API_UNAVAILABLE' || error.message === 'MAINTENANCE') {
      return "Ratioed is temporarily unavailable for maintenance. We'll be back shortly!";
    }
    if (error.message === 'API_CREDITS_EXHAUSTED') {
      return "We're experiencing technical difficulties. Please try again later.";
    }
    if (error.message.includes('Not authenticated')) {
      return 'Please sign in to analyze conversations.';
    }
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
    if (error.message.includes('overloaded') || error.message.includes('529')) {
      return "We're experiencing high demand. Please try again in a few minutes.";
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

// Check if error is a maintenance/API issue (not user's fault)
export function isMaintenanceError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message;
    return (
      msg === 'API_UNAVAILABLE' ||
      msg === 'MAINTENANCE' ||
      msg === 'API_CREDITS_EXHAUSTED' ||
      msg.includes('overloaded') ||
      msg.includes('529') ||
      msg.includes('503') ||
      msg.includes('502')
    );
  }
  return false;
}

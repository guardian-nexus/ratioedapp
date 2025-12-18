import * as FileSystem from 'expo-file-system';

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
}

interface InterpretationResult {
  tagline: string;
  insights: string[];
  alternativeReadings: string[];
}

// ============================================================================
// EDGE FUNCTION CALLS
// ============================================================================

async function callAnalyzeScan(images: ImageContent[]): Promise<OCRResult> {
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

function computeStats(messages: Message[]): Stats {
  const userMessages = messages.filter((m) => m.sender === 'person1');
  const themMessages = messages.filter((m) => m.sender === 'person2');

  const userMessageCount = userMessages.length;
  const themMessageCount = themMessages.length;

  const userWordCount = userMessages.reduce((sum, m) => sum + (m.wordCount || m.text.split(/\s+/).filter(w => w).length), 0);
  const themWordCount = themMessages.reduce((sum, m) => sum + (m.wordCount || m.text.split(/\s+/).filter(w => w).length), 0);

  const userQuestionCount = userMessages.filter((m) => m.hasQuestion).length;
  const themQuestionCount = themMessages.filter((m) => m.hasQuestion).length;

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
  };
}

function detectPatterns(messages: Message[], stats: Stats): Pattern[] {
  const patterns: Pattern[] = [];

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
    patterns.push({
      title: 'Double Texting',
      description: `You sent ${maxConsecutive} messages in a row without a response`,
      sentiment: 'negative',
    });
  }

  // One-word responses
  const themMessages = messages.filter((m) => m.sender === 'person2');
  const shortResponses = themMessages.filter((m) => m.text.split(/\s+/).length <= 2);
  if (themMessages.length > 3 && shortResponses.length / themMessages.length > 0.5) {
    patterns.push({
      title: 'Short Responses',
      description: 'They frequently reply with just a few words',
      sentiment: 'negative',
    });
  }

  // Question imbalance
  if (stats.userQuestionCount > 0 && stats.themQuestionCount === 0) {
    patterns.push({
      title: 'One-Way Questions',
      description: "You're asking all the questions",
      sentiment: 'negative',
    });
  } else if (stats.questionRatio > 2) {
    patterns.push({
      title: 'Question Imbalance',
      description: 'You ask significantly more questions than them',
      sentiment: 'neutral',
    });
  }

  // Good energy match
  if (stats.messageRatio >= 0.8 && stats.messageRatio <= 1.2 && stats.wordRatio >= 0.7 && stats.wordRatio <= 1.4) {
    patterns.push({
      title: 'Balanced Energy',
      description: 'Both sides are putting in similar effort',
      sentiment: 'positive',
    });
  }

  // They're invested
  if (stats.messageRatio < 0.8) {
    patterns.push({
      title: 'They Initiate',
      description: "They're sending more messages than you",
      sentiment: 'positive',
    });
  }

  // Effort imbalance (user doing more)
  if (stats.messageRatio > 2) {
    patterns.push({
      title: 'Effort Imbalance',
      description: "You're sending significantly more messages",
      sentiment: 'negative',
    });
  }

  return patterns.slice(0, 4); // Max 4 patterns
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
  return 'ONE-SIDED AF';
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
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

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
    },
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
    },
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

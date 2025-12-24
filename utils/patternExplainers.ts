// utils/patternExplainers.ts
// Explanations for common conversation patterns

export interface PatternExplanation {
  title: string;
  whatItMeans: string;
  whyItMatters: string;
  tip?: string;
}

// Map pattern titles to explanations
const patternExplanations: Record<string, PatternExplanation> = {
  // Message imbalance patterns
  'One-Sided Effort': {
    title: 'One-Sided Effort',
    whatItMeans: 'One person is sending significantly more messages than the other, creating an unbalanced conversation.',
    whyItMatters: 'Healthy conversations usually have a natural back-and-forth. If you\'re always initiating or carrying the conversation, it might indicate lower interest or engagement from the other person.',
    tip: 'Try pulling back a bit and see if they start initiating more. Quality over quantity.',
  },
  'Double/Triple Texting': {
    title: 'Double/Triple Texting',
    whatItMeans: 'Sending multiple messages in a row without getting a response.',
    whyItMatters: 'Occasional follow-ups are fine, but frequent double or triple texting can come across as anxious or over-eager.',
    tip: 'Wait for a response before sending follow-ups unless it\'s truly urgent.',
  },
  'Short Responses': {
    title: 'Short Responses',
    whatItMeans: 'One person consistently sends brief, one-word or minimal replies.',
    whyItMatters: 'While some people are naturally brief texters, consistently short responses often signal low engagement or disinterest.',
    tip: 'Look at the context - are they busy, or is this their default?',
  },
  'Lengthy Responses': {
    title: 'Lengthy Responses',
    whatItMeans: 'One person writes detailed, thoughtful messages.',
    whyItMatters: 'Long messages often show genuine interest and investment in the conversation.',
  },

  // Question patterns
  'Not Asking Questions': {
    title: 'Not Asking Questions',
    whatItMeans: 'One person rarely asks questions or shows curiosity about the other.',
    whyItMatters: 'Questions show interest. If someone never asks about you, they might be self-focused or not invested.',
    tip: 'Notice if they ever ask follow-up questions about things you share.',
  },
  'Question Imbalance': {
    title: 'Question Imbalance',
    whatItMeans: 'One person asks most of the questions while the other rarely reciprocates.',
    whyItMatters: 'Balanced curiosity is a sign of mutual interest. One-sided questioning can feel like an interview.',
  },
  'Asks Questions': {
    title: 'Asks Questions',
    whatItMeans: 'This person actively shows curiosity by asking questions.',
    whyItMatters: 'Questions are a sign of genuine interest in getting to know you better.',
  },

  // Timing patterns
  'Slow to Respond': {
    title: 'Slow to Respond',
    whatItMeans: 'One person takes significantly longer to reply than the other.',
    whyItMatters: 'While everyone has different texting habits, consistently slow responses might indicate lower priority.',
    tip: 'Consider their lifestyle - are they just busy, or is it a pattern?',
  },
  'Quick Responses': {
    title: 'Quick Responses',
    whatItMeans: 'This person typically responds within minutes.',
    whyItMatters: 'Quick responses often show enthusiasm and that the conversation is a priority.',
  },
  'Response Time Mismatch': {
    title: 'Response Time Mismatch',
    whatItMeans: 'There\'s a significant difference in how fast each person replies.',
    whyItMatters: 'Big differences in response times can create anxiety for the faster responder.',
  },

  // Engagement patterns
  'Dry Texter': {
    title: 'Dry Texter',
    whatItMeans: 'Messages lack enthusiasm, emotion, or personality.',
    whyItMatters: 'Dry texting makes conversations feel flat. It could mean disinterest, or just a different communication style.',
    tip: 'Some people are just better communicators in person - suggest meeting up.',
  },
  'High Energy': {
    title: 'High Energy',
    whatItMeans: 'Messages show enthusiasm with exclamation marks, emojis, or expressive language.',
    whyItMatters: 'Energy matching often correlates with connection and interest.',
  },
  'Enthusiastic Engagement': {
    title: 'Enthusiastic Engagement',
    whatItMeans: 'This person brings energy and enthusiasm to the conversation.',
    whyItMatters: 'Enthusiasm is a good sign of genuine interest and investment.',
  },
  'Surface Level': {
    title: 'Surface Level',
    whatItMeans: 'Conversations stay on safe, shallow topics without going deeper.',
    whyItMatters: 'Deeper conversations build connection. Staying surface-level might indicate guardedness.',
  },

  // Initiation patterns
  'Always Initiating': {
    title: 'Always Initiating',
    whatItMeans: 'One person starts most conversations.',
    whyItMatters: 'If you\'re always the one reaching out first, they might not be thinking about you as much.',
    tip: 'Stop initiating for a few days and see if they reach out.',
  },
  'Never Initiates': {
    title: 'Never Initiates',
    whatItMeans: 'This person waits for you to start conversations.',
    whyItMatters: 'People who are interested usually want to talk to you and will reach out.',
  },
  'Balanced Initiation': {
    title: 'Balanced Initiation',
    whatItMeans: 'Both people start conversations roughly equally.',
    whyItMatters: 'This is a healthy sign of mutual interest and effort.',
  },

  // Positive patterns
  'Matched Energy': {
    title: 'Matched Energy',
    whatItMeans: 'Both people put in similar effort and enthusiasm.',
    whyItMatters: 'Matched energy is a great sign of compatibility and mutual interest.',
  },
  'Good Conversationalist': {
    title: 'Good Conversationalist',
    whatItMeans: 'This person contributes meaningfully to keep the conversation flowing.',
    whyItMatters: 'Good conversation skills make texting enjoyable and build connection.',
  },
  'Healthy Balance': {
    title: 'Healthy Balance',
    whatItMeans: 'The conversation shows balanced effort from both sides.',
    whyItMatters: 'This is what healthy communication looks like - mutual investment.',
  },
};

// Get explanation for a pattern, with fallback for unknown patterns
export function getPatternExplanation(patternTitle: string): PatternExplanation {
  // Try exact match first
  if (patternExplanations[patternTitle]) {
    return patternExplanations[patternTitle];
  }

  // Try case-insensitive match
  const lowerTitle = patternTitle.toLowerCase();
  for (const [key, value] of Object.entries(patternExplanations)) {
    if (key.toLowerCase() === lowerTitle) {
      return value;
    }
  }

  // Try partial match
  for (const [key, value] of Object.entries(patternExplanations)) {
    if (lowerTitle.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerTitle)) {
      return value;
    }
  }

  // Fallback for unknown patterns
  return {
    title: patternTitle,
    whatItMeans: 'This pattern was detected in your conversation.',
    whyItMatters: 'Patterns help you understand the dynamics of your communication.',
  };
}

import supportIntents from '@/data/supportIntents.json';
import type { ReplyLanguage, SupportIntentItem } from '@/types/support';
import { detectLanguage, normalizeText } from '@/utils/text';

const intents = supportIntents as SupportIntentItem[];

const categoryAliases: Record<string, string[]> = {
  'Router / Internet': [
    'router',
    'internet',
    'wifi',
    'wi fi',
    'net',
    'wan',
    'lan',
    'রাউটার',
    'ইন্টারনেট',
    'নেট',
    'ওয়াইফাই',
    'ওয়াইফাই',
  ],
  'Camera / DVR / NVR': [
    'camera',
    'camra',
    'dvr',
    'nvr',
    'cctv',
    'monitor',
    'recording',
    'ক্যামেরা',
    'ডিভিআর',
    'এনভিআর',
    'সিসিটিভি',
  ],
  Printer: ['printer', 'print', 'toner', 'ink', 'paper jam', 'প্রিন্টার', 'প্রিন্ট', 'টোনার', 'কালি'],
  'UPS / Inverter': [
    'ups',
    'inverter',
    'backup',
    'battery',
    'overload',
    'alarm',
    'ইউপিএস',
    'ইনভার্টার',
    'ব্যাকআপ',
    'ব্যাটারি',
  ],
  Warranty: ['warranty', 'warenty', 'warrenty', 'serial', 'claim', 'ওয়ারেন্টি', 'ওয়ারেন্টি', 'সিরিয়াল', 'ক্লেইম'],
  'New Product Purchase': [
    'buy',
    'purchase',
    'new product',
    'price',
    'dealer',
    'sales',
    'kinte chai',
    'product kinte',
    'পণ্য কিনতে',
    'প্রোডাক্ট কিনতে',
    'নতুন পণ্য',
    'দাম',
  ],
  General: ['support', 'service center', 'csp', 'engineer', 'help', 'সাপোর্ট', 'সার্ভিস সেন্টার', 'ইঞ্জিনিয়ার'],
};

const nonSupportKeywords = [
  'poem',
  'story',
  'joke',
  'love message',
  'politics',
  'political',
  'song',
  'recipe',
  'weather',
  'news',
  'write me',
  'tell me a story',
  'একটা কবিতা',
  'কবিতা',
  'গল্প',
  'জোক',
  'ভালোবাসা',
  'রাজনীতি',
  'গান',
  'রেসিপি',
];

const supportWords = [
  'problem',
  'issue',
  'not working',
  'offline',
  'slow',
  'disconnect',
  'backup',
  'warranty',
  'buy',
  'purchase',
  'support',
  'service',
  'help',
  'সমস্যা',
  'কাজ করছে না',
  'হচ্ছে না',
  'নাই',
  'স্লো',
  'কিনতে',
  'সাপোর্ট',
  'সার্ভিস',
];

const replacementPairs: Array<[RegExp, string]> = [
  [/\binternt\b/g, 'internet'],
  [/\bnet\b/g, 'internet'],
  [/\bslo\b/g, 'slow'],
  [/\bslw\b/g, 'slow'],
  [/\bjhamela\b/g, 'problem'],
  [/\bbar bar jai\b/g, 'disconnect'],
  [/\bchole jai\b/g, 'disconnect'],
  [/\bkete jai\b/g, 'disconnect'],
  [/\bhocche na\b/g, 'not working'],
  [/\bhoy na\b/g, 'not working'],
  [/\bkore na\b/g, 'not working'],
  [/\bditese na\b/g, 'not working'],
  [/\bnai\b/g, 'no'],
  [/\blal light\b/g, 'red light'],
  [/\bcamra\b/g, 'camera'],
  [/\bprnt\b/g, 'print'],
  [/\bwarenty\b/g, 'warranty'],
  [/\bwarrenty\b/g, 'warranty'],
];

export type LanguageUnderstandingResult = {
  language: ReplyLanguage;
  normalizedMessage: string;
  isSupportRelated: boolean;
  isNonSupport: boolean;
  category: string;
  issueType: string;
  intent: string;
  score: number;
  matchedKeywords: string[];
};

function normalizeCustomerText(message: string) {
  let text = normalizeText(message);

  for (const [pattern, replacement] of replacementPairs) {
    text = text.replace(pattern, replacement);
  }

  return text.replace(/\s+/g, ' ').trim();
}

function scorePhrase(message: string, phrase: string) {
  const normalizedPhrase = normalizeCustomerText(phrase);

  if (!normalizedPhrase) return 0;
  if (message === normalizedPhrase) return normalizedPhrase.length + 20;
  if (message.includes(normalizedPhrase)) return normalizedPhrase.length + 8;

  const words = normalizedPhrase.split(' ').filter((word) => word.length > 2);
  const matched = words.filter((word) => message.includes(word)).length;

  return matched >= 2 ? matched * 3 : matched;
}

function getItemKeywords(item: SupportIntentItem) {
  return [
    ...item.englishKeywords,
    ...item.banglaKeywords,
    ...item.banglishKeywords,
    ...item.misspellings,
    item.category,
    item.issueType,
  ];
}

function scoreCategory(message: string) {
  let best = { category: '', score: 0 };

  for (const [category, aliases] of Object.entries(categoryAliases)) {
    const score = Math.max(...aliases.map((alias) => scorePhrase(message, alias)), 0);

    if (score > best.score) {
      best = { category, score };
    }
  }

  return best;
}

export function analyzeSupportMessage(message: string): LanguageUnderstandingResult {
  const language = detectLanguage(message);
  const normalizedMessage = normalizeCustomerText(message);
  const nonSupportScore = Math.max(
    ...nonSupportKeywords.map((keyword) => scorePhrase(normalizedMessage, keyword)),
    0
  );
  const categoryMatch = scoreCategory(normalizedMessage);
  const genericSupportScore = Math.max(
    ...supportWords.map((word) => scorePhrase(normalizedMessage, word)),
    0
  );

  let bestIntent: (SupportIntentItem & { score: number; matchedKeywords: string[] }) | null = null;

  for (const item of intents.filter((intent) => intent.active)) {
    const matchedKeywords: string[] = [];
    let score = categoryMatch.category === item.category ? Math.min(categoryMatch.score, 10) : 0;

    for (const keyword of getItemKeywords(item)) {
      const keywordScore = scorePhrase(normalizedMessage, keyword);

      if (keywordScore > 0) {
        score += keywordScore;
        matchedKeywords.push(keyword);
      }
    }

    if (!bestIntent || score > bestIntent.score) {
      bestIntent = { ...item, score, matchedKeywords };
    }
  }

  const bestScore = bestIntent?.score || 0;
  const supportScore = Math.max(bestScore, categoryMatch.score, genericSupportScore);
  const isNonSupport = nonSupportScore >= 4 && supportScore < 6;
  const isSupportRelated = !isNonSupport && supportScore >= 3;

  return {
    language,
    normalizedMessage,
    isSupportRelated,
    isNonSupport,
    category: bestScore >= 4 ? bestIntent?.category || categoryMatch.category : categoryMatch.category,
    issueType: bestScore >= 6 ? bestIntent?.issueType || '' : '',
    intent: bestScore >= 6 ? bestIntent?.intent || '' : '',
    score: supportScore,
    matchedKeywords: bestIntent?.matchedKeywords || [],
  };
}

export function nonSupportReply(language: ReplyLanguage) {
  return language === 'bn'
    ? 'এটি Excel product support সম্পর্কিত সমস্যা বলে মনে হচ্ছে না। অনুগ্রহ করে আপনার পণ্য বা সার্ভিস সমস্যাটি লিখুন।'
    : 'This does not look like an Excel product support issue. Please write your product or service problem so I can help you.';
}

export function noExactSolutionReply(language: ReplyLanguage) {
  return language === 'bn'
    ? 'দুঃখিত, এই সমস্যার জন্য সঠিক সমাধান পাওয়া যায়নি। বিষয়টি মানব সাপোর্ট টিমের কাছে পাঠানো হচ্ছে। অনুগ্রহ করে আপনার লোকেশন লিখুন।'
    : 'Sorry, I could not find an exact solution for this issue. I am escalating this to human support. Please provide your location.';
}

export function escalationLocationReply(language: ReplyLanguage) {
  return language === 'bn'
    ? 'দুঃখিত। অনুগ্রহ করে আপনার লোকেশন লিখুন, তাহলে আমরা আপনাকে নিকটস্থ Excel Customer Support Point-এর তথ্য দিতে সহায়তা করব। আপনি চাইলে এখানে দেখতে পারেন: https://www.excelbd.com/support/'
    : 'Sorry to hear that. Please provide your location so we can guide you to the nearest Excel Customer Support Point. You may also visit: https://www.excelbd.com/support/';
}

export function isHumanHelpRequest(message: string) {
  const text = normalizeCustomerText(message);

  return [
    'human support',
    'engineer',
    'talk to person',
    'not solved',
    'still problem',
    'problem not fixed',
    'same issue',
    'kaj hoy nai',
    'ekhono problem',
    'সমাধান হয়নি',
    'এখনো সমস্যা',
    'ঠিক হয়নি',
    'মানুষের সাহায্য',
  ].some((keyword) => scorePhrase(text, keyword) >= 3);
}

export function getSupportIntents() {
  return intents;
}

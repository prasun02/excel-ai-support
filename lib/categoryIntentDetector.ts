import type { AIIntent, DetectedLanguage, RiskLevel, SupportCategory } from '@/lib/aiSupportTypes';
import { hasBangla, normalizeText } from '@/utils/text';

type DetectorInput = {
  message: string;
  previousCategory?: string;
  activeProblemId?: string;
  activeSolutionId?: string;
  waitingForLocation?: boolean;
};

type DetectorOutput = {
  language: DetectedLanguage;
  intent: AIIntent;
  category: SupportCategory;
  problemName?: string;
  problemKeywords: string[];
  categoryChanged: boolean;
  confidence: number;
  riskLevel: RiskLevel;
  shouldResetFlow: boolean;
};

const categoryKeywords: Record<SupportCategory, string[]> = {
  'Router / Internet': [
    'router',
    'wifi',
    'wi fi',
    'internet',
    'net',
    'lan',
    'wan',
    'onu',
    'olt',
    'modem',
    'speed',
    'slow',
    'khub slow',
    'speed slow',
    'range paina',
    'disconnect',
    'auto disconnect',
    'auto disconnect hoy',
    'no internet',
    'network',
    'kaj kore na',
    'ping',
    'ip',
    'dns',
    'নেট',
    'ইন্টারনেট',
    'ওয়াইফাই',
    'রাউটার',
    'স্লো',
  ],
  'Camera / DVR / NVR': [
    'camera',
    'cctv',
    'dvr',
    'nvr',
    'video',
    'no view',
    'offline',
    'show kore na',
    'dekha jay na',
    'hikvision',
    'dahua',
    'vigi',
    'tapo',
    'ip camera',
    'poe',
    'ক্যামেরা',
    'সিসিটিভি',
  ],
  Printer: [
    'printer',
    'print',
    'not printing',
    'print hocche na',
    'print ditese na',
    'ink',
    'toner',
    'paper jam',
    'epson',
    'canon',
    'hp',
    'cartridge',
    'প্রিন্ট',
  ],
  'UPS / Inverter': [
    'ups',
    'inverter',
    'backup',
    'backup nai',
    'battery',
    'charge',
    'power backup',
    'marsriva',
    'ইউপিএস',
    'ব্যাকআপ',
  ],
  Warranty: [
    'warranty',
    'warranty ache kina',
    'rma',
    'claim',
    'replacement',
    'service warranty',
    'serial',
    'sn',
    'ওয়ারেন্টি',
  ],
  'New Product Purchase': [
    'buy',
    'price',
    'purchase',
    'new product',
    'quotation',
    'kinte chai',
    'product kinte chai',
    'কিনতে',
    'দাম',
  ],
  'Other Product': ['support', 'service', 'help', 'problem', 'issue', 'সাপোর্ট', 'সমস্যা'],
};

const nonSupportKeywords = [
  'poem',
  'story',
  'joke',
  'love letter',
  'recipe',
  'political speech',
  'কবিতা',
  'গল্প',
  'জোক',
  'রেসিপি',
];

const banglishWords = [
  'net slow',
  'khub slow',
  'net chole na',
  'wifi kaj kore na',
  'wifi bar bar jai',
  'camera dekha jay na',
  'camera show kore na',
  'print hocche na',
  'print ditese na',
  'backup kom',
  'backup nai',
  'charge nei',
  'warranty ache kina',
  'kaj kore na',
  'hocche na',
  'nai',
  'kom',
];

const riskyKeywords = [
  'firmware',
  'reset',
  'factory reset',
  'bios',
  'flash',
  'upgrade',
  'repair',
  'rma',
  'replacement',
  'configuration',
  'warranty approval',
];

function detectLanguage(message: string): DetectedLanguage {
  const text = normalizeText(message);
  const bangla = hasBangla(message);
  const banglish = banglishWords.some((word) => text.includes(normalizeText(word)));
  const englishLetters = /[a-z]/i.test(message);

  if (bangla && englishLetters) return 'mixed';
  if (bangla) return 'bn';
  if (banglish) return 'banglish';
  if (englishLetters) return 'en';
  return 'unknown';
}

function scoreKeyword(message: string, keyword: string) {
  const normalizedKeyword = normalizeText(keyword);

  if (!normalizedKeyword) return 0;
  if (message.includes(normalizedKeyword)) return normalizedKeyword.length > 3 ? 3 : 1;

  return normalizedKeyword
    .split(' ')
    .filter((word) => word.length > 2 && message.includes(word)).length;
}

function detectCategory(message: string) {
  let best: { category: SupportCategory; score: number; keywords: string[] } = {
    category: 'Other Product',
    score: 0,
    keywords: [],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords) as Array<[SupportCategory, string[]]>) {
    const matchedKeywords = keywords.filter((keyword) => scoreKeyword(message, keyword) > 0);
    const score = matchedKeywords.reduce((total, keyword) => total + scoreKeyword(message, keyword), 0);

    if (score > best.score) {
      best = { category, score, keywords: matchedKeywords };
    }
  }

  return best;
}

function detectIntent(message: string, waitingForLocation?: boolean): AIIntent {
  if (nonSupportKeywords.some((keyword) => message.includes(normalizeText(keyword)))) return 'non_support';
  if (waitingForLocation && message.split(' ').filter(Boolean).length <= 5) return 'location_reply';
  if (categoryKeywords.Warranty.some((keyword) => message.includes(normalizeText(keyword)))) return 'warranty_query';
  if (categoryKeywords['New Product Purchase'].some((keyword) => message.includes(normalizeText(keyword)))) return 'purchase_query';
  if (/(not solved|still problem|cannot|not understand|no solved|same problem|সমাধান হয়নি|এখনো সমস্যা)/.test(message)) return 'follow_up';

  return 'support_problem';
}

function detectProblemName(message: string, category: SupportCategory) {
  if (/(auto disconnect|disconnect|connection drops|bar bar|বার বার|চলে যায়)/.test(message)) return 'Auto Disconnect';
  if (/(slow|speed low|speed slow|buffer|range paina|স্লো)/.test(message)) return category === 'Router / Internet' ? 'Slow Internet' : 'Slow Performance';
  if (/(no view|offline|not showing|show kore na|dekha jay na|দেখা)/.test(message)) return 'Camera Offline / No View';
  if (/(not printing|print hocche na|print ditese na|paper jam|প্রিন্ট)/.test(message)) return 'Printer Not Printing';
  if (/(backup|battery|charge|backup nai|ব্যাকআপ)/.test(message)) return 'Backup / Battery Issue';
  if (/(warranty|rma|replacement|serial|sn|ওয়ারেন্টি)/.test(message)) return 'Warranty Check';
  if (/(buy|price|purchase|quotation|kinte chai|কিনতে|দাম)/.test(message)) return 'Product Purchase';

  return undefined;
}

export function detectCategoryAndIntent(input: DetectorInput): DetectorOutput {
  const normalizedMessage = normalizeText(input.message);
  const language = detectLanguage(input.message);
  const categoryResult = detectCategory(normalizedMessage);
  const intent = detectIntent(normalizedMessage, input.waitingForLocation);
  const riskLevel: RiskLevel = riskyKeywords.some((keyword) => normalizedMessage.includes(normalizeText(keyword)))
    ? 'high'
    : intent === 'warranty_query'
      ? 'medium'
      : 'low';
  const previousCategory = input.previousCategory as SupportCategory | undefined;
  const categoryChanged = Boolean(
    previousCategory &&
    categoryResult.score >= 3 &&
    categoryResult.category !== previousCategory
  );

  if (intent === 'non_support') {
    return {
      language,
      intent,
      category: 'Other Product',
      problemKeywords: [],
      categoryChanged: false,
      confidence: 0.95,
      riskLevel: 'low',
      shouldResetFlow: false,
    };
  }

  return {
    language,
    intent,
    category: categoryResult.category,
    problemName: detectProblemName(normalizedMessage, categoryResult.category),
    problemKeywords: categoryResult.keywords,
    categoryChanged,
    confidence: Math.min(0.95, categoryResult.score / 10 + 0.35),
    riskLevel,
    shouldResetFlow: categoryChanged,
  };
}

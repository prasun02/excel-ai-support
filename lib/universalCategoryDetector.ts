export type UniversalDetectedCategory =
  | 'Router / Internet'
  | 'Camera / DVR / NVR'
  | 'Printer'
  | 'UPS / Inverter'
  | 'Warranty'
  | 'New Product Purchase'
  | 'Other Product'
  | 'Non Support';

export type UniversalDetectedLanguage = 'en' | 'bn' | 'banglish' | 'mixed' | 'unknown';

export type UniversalCategoryContextInput = {
  message: string;
  previousCategory?: string;
  previousProductName?: string;
  previousModel?: string;
  previousProblemName?: string;
};

export type UniversalCategoryContext = {
  category: UniversalDetectedCategory;
  detectedCategory: UniversalDetectedCategory;
  detectedBrand?: string;
  detectedModel?: string;
  detectedProductName?: string;
  detectedProblem?: string;
  language: UniversalDetectedLanguage;
  confidence: number;
  categoryChanged: boolean;
  productChanged: boolean;
  shouldResetSupportFlow: boolean;
  reason: string;
};

type SupportCategory = Exclude<UniversalDetectedCategory, 'Non Support'>;

type CategoryRule = {
  category: SupportCategory;
  keywords: string[];
};

type ProblemRule = {
  problem: string;
  keywords: string[];
};

const categoryRules: CategoryRule[] = [
  {
    category: 'Router / Internet',
    keywords: [
      'router',
      'wifi',
      'wi-fi',
      'internet',
      'net',
      'lan',
      'wan',
      'onu',
      'olt',
      'modem',
      'tp-link',
      'tplink',
      'mercusys',
      'archer',
      'tl-wr',
      'deco',
      'range',
      'disconnect',
      'auto disconnect',
      'slow internet',
      'net slow',
      'no internet',
      'net kaj kore na',
      'range paina',
      'lal bati',
      'red light',
      'wan blinking',
    ],
  },
  {
    category: 'Camera / DVR / NVR',
    keywords: [
      'camera',
      'cctv',
      'dvr',
      'nvr',
      'no view',
      'offline',
      'video nai',
      'camera kaj kore na',
      'hikvision',
      'dahua',
      'vigi',
      'tapo',
      'ip camera',
      'poe',
      'recording',
      'night vision',
    ],
  },
  {
    category: 'Printer',
    keywords: [
      'printer',
      'print',
      'printing',
      'print hocche na',
      'epson',
      'ink',
      'toner',
      'cartridge',
      'paper jam',
      'print quality',
      'color problem',
      'l8050',
      'l3210',
      'l1300',
      'l1800',
    ],
  },
  {
    category: 'UPS / Inverter',
    keywords: [
      'ups',
      'inverter',
      'marsriva',
      'backup',
      'backup low',
      'no backup',
      'battery',
      'charge',
      'charging',
      'power backup',
      '2kw',
      '2kva',
      '3kva',
      'mr-spf',
      'mr-lbp',
      'overload',
      'backup kom',
    ],
  },
  {
    category: 'Warranty',
    keywords: [
      'warranty',
      'rma',
      'claim',
      'replacement',
      'service warranty',
      'serial',
      'sn',
      'invoice',
      'warranty ache kina',
      'warranty check',
      'reject',
      'approve',
    ],
  },
  {
    category: 'New Product Purchase',
    keywords: [
      'buy',
      'price',
      'purchase',
      'quotation',
      'new product',
      'available',
      'stock',
      'product price',
      'dealer price',
    ],
  },
  {
    category: 'Other Product',
    keywords: [
      'mouse',
      'keyboard',
      'speaker',
      'ssd',
      'pen drive',
      'monitor',
      'adapter',
      'charger',
      'switch',
      'cable',
      'accessories',
      'no power',
      'not working',
      'not work',
      'service',
      'support',
      'problem',
      'issue',
    ],
  },
];

const nonSupportKeywords = [
  'poem',
  'story',
  'joke',
  'love letter',
  'recipe',
  'political speech',
  'game cheat',
  'movie',
];

const problemRules: Record<SupportCategory, ProblemRule[]> = {
  'Router / Internet': [
    { problem: 'Slow Internet', keywords: ['slow internet', 'net slow', 'slow', 'speed slow', 'speed low', 'buffer'] },
    { problem: 'No Internet', keywords: ['no internet', 'internet nai', 'net nai', 'connected no internet', 'net kaj kore na'] },
    { problem: 'Auto Disconnect', keywords: ['auto disconnect', 'disconnect', 'bar bar', 'drop', 'line cut'] },
    { problem: 'Range Problem', keywords: ['range problem', 'range paina', 'range', 'signal weak', 'coverage'] },
    { problem: 'Red Light / WAN Issue', keywords: ['red light', 'lal bati', 'wan blinking', 'wan', 'los'] },
    { problem: 'Router Hang', keywords: ['hang', 'freeze', 'stuck'] },
    { problem: 'No Power', keywords: ['no power', 'power nai', 'light nai', 'dead'] },
    { problem: 'Configuration Issue', keywords: ['configuration', 'configure', 'setup', 'pppoe', 'router page', '192.168'] },
    { problem: 'Router Not Working', keywords: ['router not working', 'not working', 'not work', 'kaj kore na'] },
  ],
  'Camera / DVR / NVR': [
    { problem: 'No View', keywords: ['no view', 'no video', 'video nai', 'not showing', 'show kore na', 'dekha jay na'] },
    { problem: 'Offline', keywords: ['offline', 'device offline', 'camera offline'] },
    { problem: 'No Power', keywords: ['no power', 'power nai', 'light nai', 'dead'] },
    { problem: 'Recording Issue', keywords: ['recording', 'not recording', 'playback', 'hdd'] },
    { problem: 'Night Vision Issue', keywords: ['night vision', 'night mode', 'ir', 'dark at night'] },
    { problem: 'Network Issue', keywords: ['network', 'remote view', 'ip conflict', 'lan'] },
    { problem: 'Configuration Issue', keywords: ['configuration', 'configure', 'setup', 'password'] },
  ],
  Printer: [
    { problem: 'Not Printing', keywords: ['not printing', 'print hocche na', 'print ditese na', 'print not', 'printing problem'] },
    { problem: 'Print Quality Problem', keywords: ['print quality', 'color problem', 'faded', 'line', 'smudge', 'blank print'] },
    { problem: 'Paper Jam', keywords: ['paper jam', 'paper stuck', 'jam'] },
    { problem: 'Ink/Toner Issue', keywords: ['ink', 'toner', 'cartridge', 'low ink', 'low toner'] },
    { problem: 'Network Printer Issue', keywords: ['network printer', 'wifi printer', 'lan printer', 'ip printer'] },
    { problem: 'No Power', keywords: ['no power', 'power nai', 'light nai', 'dead'] },
  ],
  'UPS / Inverter': [
    { problem: 'Backup Low', keywords: ['backup low', 'backup kom', 'low backup', 'backup time kom', 'battery low'] },
    { problem: 'No Backup', keywords: ['no backup', 'backup nai', 'backup nei'] },
    { problem: 'Charging Issue', keywords: ['charging issue', 'charging', 'not charging', 'charge hocche na'] },
    { problem: 'Overload', keywords: ['overload', 'load', 'alarm', 'beep'] },
    { problem: 'No Power', keywords: ['no power', 'power nai', 'light nai', 'dead'] },
    { problem: 'Battery Issue', keywords: ['battery issue', 'battery', 'battery problem'] },
  ],
  Warranty: [
    { problem: 'Warranty Check', keywords: ['warranty check', 'warranty ache kina', 'warranty status', 'warranty'] },
    { problem: 'Replacement Request', keywords: ['replacement', 'replace', 'change product'] },
    { problem: 'RMA Claim', keywords: ['rma', 'claim', 'service claim'] },
    { problem: 'Serial Number Issue', keywords: ['serial number', 'serial', 'sn', 'sticker'] },
    { problem: 'Out of Warranty Query', keywords: ['out of warranty', 'warranty expired', 'expired'] },
  ],
  'New Product Purchase': [
    { problem: 'Purchase Query', keywords: ['buy', 'purchase', 'new product'] },
    { problem: 'Price Query', keywords: ['price', 'product price', 'dealer price'] },
    { problem: 'Stock Query', keywords: ['stock', 'available', 'availability'] },
    { problem: 'Quotation Query', keywords: ['quotation', 'quote'] },
  ],
  'Other Product': [
    { problem: 'No Power', keywords: ['no power', 'power nai', 'light nai', 'dead'] },
    { problem: 'Not Working', keywords: ['not working', 'not work', 'kaj kore na', 'not detected'] },
    { problem: 'Physical Damage', keywords: ['physical damage', 'broken', 'damage', 'burn', 'liquid'] },
    { problem: 'Connectivity Issue', keywords: ['connectivity', 'connection', 'not connecting', 'disconnect', 'cable'] },
  ],
};

const brandRules: Array<{ brand: string; keywords: string[] }> = [
  { brand: 'TP-Link', keywords: ['tp-link', 'tplink', 'archer', 'tl-wr', 'deco'] },
  { brand: 'Mercusys', keywords: ['mercusys'] },
  { brand: 'Hikvision', keywords: ['hikvision'] },
  { brand: 'Dahua', keywords: ['dahua'] },
  { brand: 'VIGI', keywords: ['vigi'] },
  { brand: 'Tapo', keywords: ['tapo'] },
  { brand: 'Epson', keywords: ['epson', 'l8050', 'l3210', 'l1300', 'l1800'] },
  { brand: 'Marsriva', keywords: ['marsriva', 'mr-spf', 'mr-lbp'] },
];

const productWords = [
  'router',
  'onu',
  'modem',
  'camera',
  'dvr',
  'nvr',
  'printer',
  'ups',
  'inverter',
  'mouse',
  'keyboard',
  'speaker',
  'ssd',
  'pen drive',
  'monitor',
  'adapter',
  'charger',
  'switch',
  'cable',
];

const banglishMarkers = [
  'kaj kore na',
  'hocche na',
  'hoy na',
  'nai',
  'nei',
  'ache kina',
  'backup kom',
  'net slow',
  'range paina',
  'show kore na',
  'print hocche na',
];

function normalize(value: string) {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s./]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(value: string) {
  return normalize(value).replace(/[^a-z0-9\u0980-\u09FF]+/gi, '');
}

function keywordScore(text: string, keyword: string) {
  const normalizedKeyword = normalize(keyword);

  if (!normalizedKeyword) return 0;
  if (text.includes(normalizedKeyword)) {
    return normalizedKeyword.includes(' ') ? 6 : 4;
  }

  return normalizedKeyword
    .split(' ')
    .filter((word) => word.length > 2 && text.includes(word)).length;
}

function scoreCategory(text: string, rule: CategoryRule) {
  return rule.keywords.reduce((total, keyword) => total + keywordScore(text, keyword), 0);
}

function bestCategory(text: string) {
  return categoryRules.reduce(
    (best, rule) => {
      const score = scoreCategory(text, rule);

      return score > best.score ? { category: rule.category, score } : best;
    },
    { category: 'Other Product' as SupportCategory, score: 0 }
  );
}

function detectLanguage(message: string): UniversalDetectedLanguage {
  const hasBangla = /[\u0980-\u09FF]/.test(message);
  const hasEnglish = /[a-z]/i.test(message);
  const text = normalize(message);
  const hasBanglish = banglishMarkers.some((marker) => text.includes(normalize(marker)));

  if (hasBangla && hasEnglish) return 'mixed';
  if (hasBangla) return 'bn';
  if (hasBanglish) return 'banglish';
  if (hasEnglish) return 'en';

  return 'unknown';
}

function normalizeCategory(category?: string): SupportCategory | '' {
  const text = normalize(category || '');

  if (!text) return '';
  if (text.includes('router') || text.includes('internet') || text.includes('wifi')) return 'Router / Internet';
  if (text.includes('camera') || text.includes('dvr') || text.includes('nvr') || text.includes('cctv')) return 'Camera / DVR / NVR';
  if (text.includes('printer') || text.includes('print')) return 'Printer';
  if (text.includes('ups') || text.includes('inverter')) return 'UPS / Inverter';
  if (text.includes('warranty') || text.includes('rma') || text.includes('claim') || text.includes('serial')) return 'Warranty';
  if (text.includes('purchase') || text.includes('new product') || text.includes('sales')) return 'New Product Purchase';
  if (text.includes('other') || text.includes('general')) return 'Other Product';

  return '';
}

function detectProblem(text: string, category: SupportCategory, previousProblemName?: string) {
  const rules = problemRules[category];
  const best = rules.reduce(
    (winner, rule) => {
      const score = rule.keywords.reduce((total, keyword) => total + keywordScore(text, keyword), 0);

      return score > winner.score ? { problem: rule.problem, score } : winner;
    },
    { problem: '', score: 0 }
  );

  if (best.score > 0) return best.problem;

  return previousProblemName || rules[0]?.problem || '';
}

function detectBrand(text: string) {
  return brandRules.find((rule) => rule.keywords.some((keyword) => keywordScore(text, keyword) > 0))?.brand;
}

function originalMatch(message: string, pattern: RegExp) {
  return message.match(pattern)?.[0]?.trim();
}

function detectModel(message: string) {
  return (
    originalMatch(message, /\btl[-\s]?wr[0-9a-z-]+\b/i) ||
    originalMatch(message, /\barcher\s+[a-z0-9-]+\b/i) ||
    originalMatch(message, /\bdeco\s+[a-z0-9-]+\b/i) ||
    originalMatch(message, /\bmr[-\s]?(?:spf|lbp)[a-z0-9-]*\b/i) ||
    originalMatch(message, /\b\d+(?:\.\d+)?\s*(?:kw|kva|va|watt)\b/i) ||
    originalMatch(message, /\bl(?:8050|3210|1300|1800)\b/i) ||
    originalMatch(message, /\bds[-\s]?[a-z0-9-]+\b/i) ||
    originalMatch(message, /\b(?:dvr|nvr)[-\s]?[a-z0-9-]+\b/i)
  );
}

function detectProductWord(text: string) {
  return productWords.find((word) => text.includes(normalize(word)));
}

function buildProductName(brand?: string, model?: string, productWord?: string) {
  const parts = [brand, model, productWord && !model?.toLowerCase().includes(productWord) ? productWord : '']
    .filter(Boolean)
    .map((part) => String(part).trim());

  return parts.length ? Array.from(new Set(parts)).join(' ') : undefined;
}

function nonSupportScore(text: string) {
  return nonSupportKeywords.reduce((total, keyword) => total + keywordScore(text, keyword), 0);
}

function changedProduct(previousProduct: string, currentProduct: string, categoryChanged: boolean) {
  if (categoryChanged && previousProduct) return true;
  if (!previousProduct || !currentProduct) return false;

  const previous = compact(previousProduct);
  const current = compact(currentProduct);

  return Boolean(previous && current && previous !== current);
}

export function detectUniversalCategoryContext(input: UniversalCategoryContextInput): UniversalCategoryContext {
  const message = input.message || '';
  const text = normalize(message);
  const previousCategory = normalizeCategory(input.previousCategory);
  const language = detectLanguage(message);
  const nonSupport = nonSupportScore(text);
  const categoryMatch = bestCategory(text);
  const hasStrongCategory = categoryMatch.score > 0;
  const detectedCategory: UniversalDetectedCategory =
    nonSupport > 0 && !hasStrongCategory
      ? 'Non Support'
      : hasStrongCategory
        ? categoryMatch.category
        : previousCategory || 'Other Product';
  const confidence = detectedCategory === 'Non Support'
    ? 0.95
    : hasStrongCategory
      ? Math.min(0.98, 0.35 + categoryMatch.score / 18)
      : previousCategory
        ? 0.35
        : 0.3;
  const detectedBrand = detectBrand(text);
  const detectedModel = detectModel(message);
  const productWord = detectProductWord(text);
  const detectedProductName = buildProductName(detectedBrand, detectedModel, productWord);
  const supportCategory = detectedCategory === 'Non Support' ? undefined : detectedCategory;
  const detectedProblem = supportCategory ? detectProblem(text, supportCategory, input.previousProblemName) : undefined;
  const categoryChanged = Boolean(
    previousCategory &&
      detectedCategory !== 'Non Support' &&
      confidence >= 0.6 &&
      detectedCategory !== previousCategory
  );
  const previousProduct = [input.previousProductName, input.previousModel].filter(Boolean).join(' ');
  const currentProduct = [detectedProductName, detectedModel].filter(Boolean).join(' ');
  const productChanged = changedProduct(previousProduct, currentProduct, categoryChanged);
  const problemChanged = Boolean(
    input.previousProblemName &&
      detectedProblem &&
      confidence >= 0.6 &&
      normalize(input.previousProblemName) !== normalize(detectedProblem) &&
      hasStrongCategory
  );
  const shouldResetSupportFlow = categoryChanged || productChanged || problemChanged;
  const reasonParts = [
    hasStrongCategory ? `matched ${detectedCategory} keywords` : 'no strong latest category keyword',
    categoryChanged ? `category changed from ${previousCategory} to ${detectedCategory}` : '',
    productChanged ? 'product context changed or old product must be cleared' : '',
    problemChanged ? `problem changed to ${detectedProblem}` : '',
  ].filter(Boolean);

  return {
    category: detectedCategory,
    detectedCategory,
    detectedBrand,
    detectedModel,
    detectedProductName,
    detectedProblem,
    language,
    confidence,
    categoryChanged,
    productChanged,
    shouldResetSupportFlow,
    reason: reasonParts.join('; '),
  };
}

export function detectUniversalCategory(input: UniversalCategoryContextInput) {
  const context = detectUniversalCategoryContext(input);

  return {
    category: context.category,
    detectedProblem: context.detectedProblem || '',
    language: context.language,
    confidence: context.confidence,
    categoryChanged: context.categoryChanged,
    shouldResetSupportFlow: context.shouldResetSupportFlow,
  };
}

import {
  detectUniversalCategoryContext,
  type UniversalDetectedCategory,
  type UniversalDetectedLanguage,
} from '@/lib/universalCategoryDetector';

export type UniversalSupportType =
  | 'universal_support_answer'
  | 'clarifying_question'
  | 'safe_checks'
  | 'escalation'
  | 'non_support';

export type UniversalSupportLanguage = Exclude<UniversalDetectedLanguage, 'unknown'>;

export type UniversalSupportCategory = UniversalDetectedCategory;

export type UniversalSupportRequest = {
  message: string;
  category?: string;
  detectedProduct?: string;
  detectedModel?: string;
  detectedProblem?: string;
  hardwareVersion?: string;
  language?: string;
  previousContext?: {
    currentCategory?: string;
    currentProblemName?: string;
    currentProductName?: string;
    currentModel?: string;
    currentHardwareVersion?: string;
    activeSupportFlow?: string;
  };
};

export type UniversalSupportAnswer = {
  type: UniversalSupportType;
  language: UniversalSupportLanguage;
  category: string;
  detectedProblem: string;
  productName?: string;
  message: string;
  possibleCauses: string[];
  safeChecks: string[];
  diagnosticQuestions: string[];
  nextStep: string;
  warning?: string;
  escalationRequired?: boolean;
  source?: 'openai' | 'fallback';
};

type ServiceCategory = Exclude<UniversalSupportCategory, 'Non Support'>;

type UniversalFallbackTemplate = {
  defaultProblem: string;
  possibleCauses: string[];
  safeChecks: string[];
  diagnosticQuestions: string[];
  nextStep: string;
  warning?: string;
};

const fallbackCatalog: Record<ServiceCategory, UniversalFallbackTemplate> = {
  'Router / Internet': {
    defaultProblem: 'Router Not Working',
    possibleCauses: [
      'Adapter or power issue',
      'ISP/ONU issue',
      'WAN/LAN cable issue',
      'WiFi interference or overload',
      'Firmware/configuration or router hardware issue',
    ],
    safeChecks: [
      'Restart router and ONU, then wait 2 minutes',
      'Check router adapter and power socket',
      'Check WAN cable and ONU LOS/PON status',
      'Test near the router with one device',
      'Reduce connected users and confirm model/version',
    ],
    diagnosticQuestions: [
      'Is the power light on?',
      'What is the internet/WAN light status?',
      'Is the issue slow internet, no internet, range, or disconnect?',
      'What is the router model and hardware version?',
    ],
    nextStep: 'Share router model, hardware version, and light status so I can guide the next safe check.',
  },
  'Camera / DVR / NVR': {
    defaultProblem: 'No View',
    possibleCauses: [
      'Power or PoE issue',
      'LAN cable or port issue',
      'DVR/NVR channel configuration issue',
      'IP/network issue',
      'Camera, adapter, DVR, or NVR hardware issue',
    ],
    safeChecks: [
      'Check camera power or PoE',
      'Check cable and DVR/NVR/switch port',
      'Restart camera and DVR/NVR',
      'Check whether the device appears online in device list',
      'Test another port or cable if available',
    ],
    diagnosticQuestions: [
      'Does the camera have power?',
      'Does it show online or offline?',
      'Is one camera affected or all cameras?',
      'Is it connected by PoE or adapter?',
    ],
    nextStep: 'Share whether one camera or all cameras are affected, plus the camera/DVR/NVR model if available.',
  },
  Printer: {
    defaultProblem: 'Not Printing',
    possibleCauses: [
      'USB/LAN/WiFi connection issue',
      'Driver or print queue issue',
      'Ink/toner or cartridge issue',
      'Paper jam or paper feed issue',
      'Printhead/nozzle or printer hardware issue',
    ],
    safeChecks: [
      'Restart printer and computer',
      'Check USB/LAN/WiFi connection',
      'Check paper, ink, and toner',
      'Clear print queue',
      'Try a test print and check error light/message',
    ],
    diagnosticQuestions: [
      'Is it connected by USB, LAN, or WiFi?',
      'Is there any error light or message?',
      'Is the issue from one PC or all devices?',
      'What is the printer model?',
    ],
    nextStep: 'Share printer model, connection type, and any error message so I can guide the next safe check.',
  },
  'UPS / Inverter': {
    defaultProblem: 'Backup Low',
    possibleCauses: [
      'Weak or aged battery',
      'Connected load is higher than rated capacity',
      'UPS/Inverter is not fully charged',
      'Charging issue or unstable input power',
      'Battery capacity mismatch or inverter fault',
    ],
    safeChecks: [
      'Fully charge before testing backup',
      'Reduce connected load',
      'Test with one low-power device',
      'Check battery age and capacity if known',
      'Check charging indicator and input voltage',
    ],
    diagnosticQuestions: [
      'What is the model?',
      'How old is the battery?',
      'What load is connected?',
      'How long is backup after full charge?',
      'Is charging indicator normal?',
    ],
    nextStep: 'Share model, battery age, connected load, and backup time after full charge.',
    warning: 'Do not open UPS/Inverter or touch internal battery wiring unless you are a qualified technician.',
  },
  Warranty: {
    defaultProblem: 'Warranty Check',
    possibleCauses: [
      'Warranty status needs serial/invoice verification',
      'Product may be inside or outside warranty period',
      'RMA or replacement needs warranty portal/CSP verification',
    ],
    safeChecks: [
      'Collect product model, serial number, and invoice if available',
      'Check through warranty portal or nearest Excel CSP',
      'Describe the product problem clearly',
      'Do not promise replacement before verification',
    ],
    diagnosticQuestions: [
      'What is the product model?',
      'What is the serial number?',
      'Do you have purchase invoice?',
      'What problem is happening?',
    ],
    nextStep: 'Please share model/SN/invoice details if available, or contact Excel CSP for official verification.',
    warning: 'AI cannot approve warranty, replacement, or RMA. Excel warranty portal/CSP verification is required.',
  },
  'New Product Purchase': {
    defaultProblem: 'Purchase Query',
    possibleCauses: [
      'Exact product requirement is not clear yet',
      'Price and stock can vary by model and location',
      'Dealer quotation may need sales team verification',
    ],
    safeChecks: [
      'Confirm exact product type and model if known',
      'Mention required quantity',
      'Mention your location or preferred sales point',
    ],
    diagnosticQuestions: [
      'Which product do you want to buy?',
      'Do you need a specific model or configuration?',
      'What is your location?',
    ],
    nextStep: 'Share product name/model and location so Excel sales can guide price, stock, or quotation.',
  },
  'Other Product': {
    defaultProblem: 'Not Working',
    possibleCauses: [
      'Power issue',
      'Cable or connection issue',
      'Driver or configuration issue',
      'Physical damage',
      'Internal hardware issue',
    ],
    safeChecks: [
      'Check power and cable',
      'Restart the device if safe',
      'Test another port, cable, or device if available',
      'Check visible damage',
      'Provide model/SN if warranty support is needed',
    ],
    diagnosticQuestions: [
      'What is the product model?',
      'What exactly is not working?',
      'Does any power light turn on?',
      'Do you need warranty/SN support?',
    ],
    nextStep: 'Share product type, model, and exact symptom so I can guide safe checks.',
  },
};

const riskyKeywords = [
  'firmware',
  'reset',
  'factory reset',
  'bios',
  'flash',
  'repair',
  'open device',
  'open the device',
  'board',
  'burn',
  'short circuit',
  'internal',
  'rma',
  'replacement',
  'warranty approval',
  'configure',
  'configuration',
];

const supportWords = [
  'problem',
  'issue',
  'not working',
  'not work',
  'service',
  'support',
  'offline',
  'slow',
  'backup',
  'warranty',
  'replacement',
  'repair',
  'kaj kore na',
  'hocche na',
  'nai',
];

function normalize(value: string) {
  return String(value || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s./]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(normalize(keyword)));
}

function cleanArray(items: unknown, fallbackItems: string[]) {
  return Array.isArray(items)
    ? items
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8)
    : fallbackItems;
}

function dedupe(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function riskyUniversalStepsAllowed() {
  return String(process.env.UNIVERSAL_AI_ALLOW_RISKY_STEPS || '').toLowerCase() === 'true';
}

function detectContext(input: UniversalSupportRequest) {
  return detectUniversalCategoryContext({
    message: input.message,
    previousCategory: input.category || input.previousContext?.currentCategory,
    previousProductName: input.detectedProduct || input.previousContext?.currentProductName,
    previousModel: input.detectedModel || input.previousContext?.currentModel,
    previousProblemName: input.detectedProblem || input.previousContext?.currentProblemName,
  });
}

function normalizeLanguage(language?: string): UniversalSupportLanguage {
  const text = normalize(language || '');

  if (text === 'bn' || text === 'bangla') return 'bn';
  if (text === 'banglish') return 'banglish';
  if (text === 'mixed') return 'mixed';
  return 'en';
}

export function detectUniversalLanguage(message: string, languageHint?: string): UniversalSupportLanguage {
  const hinted = normalizeLanguage(languageHint);

  if (languageHint && hinted !== 'en') return hinted;

  const detected = detectUniversalCategoryContext({ message }).language;

  return detected === 'unknown' ? 'en' : detected;
}

export function normalizeUniversalCategory(category?: string): UniversalSupportCategory {
  const text = normalize(category || '');

  if (!text) return 'Other Product';
  if (text.includes('non support')) return 'Non Support';
  if (text.includes('router') || text.includes('internet') || text.includes('wifi')) return 'Router / Internet';
  if (text.includes('camera') || text.includes('dvr') || text.includes('nvr') || text.includes('cctv')) return 'Camera / DVR / NVR';
  if (text.includes('printer') || text.includes('print')) return 'Printer';
  if (text.includes('ups') || text.includes('inverter')) return 'UPS / Inverter';
  if (text.includes('warranty') || text.includes('rma') || text.includes('claim') || text.includes('serial')) return 'Warranty';
  if (text.includes('purchase') || text.includes('new product') || text.includes('buy') || text.includes('price')) return 'New Product Purchase';
  if (text.includes('general') || text.includes('other')) return 'Other Product';

  return 'Other Product';
}

export function universalCategoryToTicketCategory(category: string) {
  const normalized = normalizeUniversalCategory(category);

  if (normalized === 'Non Support') return '';

  return normalized;
}

export function detectUniversalCategory(input: UniversalSupportRequest): UniversalSupportCategory {
  return detectContext(input).detectedCategory;
}

export function detectUniversalProblem(message: string, category: UniversalSupportCategory, fallbackProblem?: string) {
  const context = detectUniversalCategoryContext({
    message,
    previousCategory: category,
    previousProblemName: fallbackProblem,
  });

  return context.detectedProblem || fallbackProblem || getTemplate(category).defaultProblem;
}

export function isUniversalRiskyRequest(input: UniversalSupportRequest) {
  const text = normalize(`${input.message} ${input.category || ''} ${input.detectedProblem || ''} ${input.previousContext?.currentProblemName || ''}`);

  return includesAny(text, riskyKeywords);
}

export function hasUniversalModelContext(input: UniversalSupportRequest) {
  return Boolean(
    input.detectedModel?.trim() ||
      input.hardwareVersion?.trim() ||
      input.previousContext?.currentModel?.trim() ||
      input.previousContext?.currentHardwareVersion?.trim()
  );
}

export function isUniversalSupportRelated(input: UniversalSupportRequest) {
  const context = detectContext(input);
  const text = normalize(`${input.message} ${input.category || ''} ${input.detectedProduct || ''} ${input.detectedModel || ''}`);

  if (context.detectedCategory === 'Non Support') return false;

  return context.confidence >= 0.6 || includesAny(text, supportWords);
}

function getTemplate(category: UniversalSupportCategory) {
  const normalized = normalizeUniversalCategory(category);

  if (normalized === 'Non Support') return fallbackCatalog['Other Product'];

  return fallbackCatalog[normalized];
}

function getProductName(input: UniversalSupportRequest) {
  return [input.detectedProduct, input.detectedModel].filter(Boolean).join(' ').trim() || undefined;
}

function localizedIntro(language: UniversalSupportLanguage, type: UniversalSupportType) {
  if (type === 'non_support') {
    return "I'm here to help with Excel Technologies product support only. Please describe your product issue.";
  }

  if (language === 'bn' || language === 'banglish' || language === 'mixed') {
    return 'Exact Excel-approved model-specific answer na thakleo ami safe general support checks dite pari.';
  }

  return 'I do not have an Excel-approved exact model-specific answer for this yet. I can still help with safe general checks.';
}

function safetyWarning(input: UniversalSupportRequest, category: UniversalSupportCategory, existingWarning?: string) {
  const normalized = normalizeUniversalCategory(category);
  const risky = isUniversalRiskyRequest(input);
  const lacksModelContext = !hasUniversalModelContext(input);

  if (normalized === 'Warranty') {
    return existingWarning || 'AI cannot approve warranty, replacement, or RMA. Excel warranty portal/CSP verification is required.';
  }

  if (risky && lacksModelContext && !riskyUniversalStepsAllowed()) {
    return 'Risky or exact model-specific actions need exact model, hardware version, SN/sticker photo, or Excel-approved instructions. Do not continue from a guess.';
  }

  return existingWarning;
}

export function enforceUniversalSafety(answer: UniversalSupportAnswer, input: UniversalSupportRequest): UniversalSupportAnswer {
  const category = normalizeUniversalCategory(answer.category);
  const risky = isUniversalRiskyRequest(input);
  const lacksModelContext = !hasUniversalModelContext(input);
  const warning = safetyWarning(input, category, answer.warning);
  const blockedStepPattern = /\b(upload firmware|flash|solder|open the device|open device|replace board|internal repair|approve warranty|approve replacement|approve rma)\b/i;
  const safeChecks = risky && !riskyUniversalStepsAllowed()
    ? answer.safeChecks.filter((check) => !blockedStepPattern.test(check))
    : answer.safeChecks;
  const diagnosticQuestions = dedupe([
    ...answer.diagnosticQuestions,
    ...(risky && lacksModelContext ? ['What is the exact model and hardware version?', 'Can you share SN/sticker photo if needed?'] : []),
  ]);
  const nextStep = risky && lacksModelContext && !riskyUniversalStepsAllowed()
    ? 'Please share exact model/version/SN or a clear sticker photo. If unsure, contact Excel CSP before risky firmware, reset, repair, warranty, or replacement steps.'
    : answer.nextStep;

  return {
    ...answer,
    category,
    warning,
    safeChecks,
    diagnosticQuestions,
    nextStep,
    escalationRequired: Boolean(
      answer.escalationRequired ||
        (risky && lacksModelContext && !riskyUniversalStepsAllowed()) ||
        category === 'Warranty'
    ),
  };
}

export function getUniversalSupportFallback(input: UniversalSupportRequest): UniversalSupportAnswer {
  const context = detectContext(input);
  const language = input.language
    ? normalizeLanguage(input.language)
    : context.language === 'unknown'
      ? 'en'
      : context.language;

  if (!isUniversalSupportRelated(input)) {
    return {
      type: 'non_support',
      language,
      category: 'Non Support',
      detectedProblem: 'Non-support request',
      message: localizedIntro(language, 'non_support'),
      possibleCauses: [],
      safeChecks: [],
      diagnosticQuestions: ['Please write your Excel product name/model and the service issue.'],
      nextStep: 'Describe the Excel product service problem so I can help.',
      escalationRequired: false,
      source: 'fallback',
    };
  }

  const category = normalizeUniversalCategory(context.detectedCategory === 'Non Support' ? input.category : context.detectedCategory);
  const template = getTemplate(category);
  const problem = input.detectedProblem || context.detectedProblem || template.defaultProblem;
  const warning = safetyWarning(input, category, template.warning);
  const type: UniversalSupportType =
    category === 'Warranty'
      ? 'clarifying_question'
      : warning
        ? 'safe_checks'
        : 'universal_support_answer';

  return enforceUniversalSafety(
    {
      type,
      language,
      category,
      detectedProblem: problem,
      productName: getProductName(input) || context.detectedProductName,
      message: localizedIntro(language, type),
      possibleCauses: template.possibleCauses,
      safeChecks: template.safeChecks,
      diagnosticQuestions: template.diagnosticQuestions,
      nextStep: template.nextStep,
      warning,
      escalationRequired: category === 'Warranty',
      source: 'fallback',
    },
    input
  );
}

export function sanitizeUniversalAnswer(value: unknown, input: UniversalSupportRequest): UniversalSupportAnswer {
  const fallback = getUniversalSupportFallback(input);
  const record = value && typeof value === 'object' ? value as Partial<UniversalSupportAnswer> : {};
  const allowedTypes: UniversalSupportType[] = [
    'universal_support_answer',
    'clarifying_question',
    'safe_checks',
    'escalation',
    'non_support',
  ];
  const allowedLanguages: UniversalSupportLanguage[] = ['en', 'bn', 'banglish', 'mixed'];

  return enforceUniversalSafety(
    {
      type: allowedTypes.includes(record.type as UniversalSupportType) ? record.type as UniversalSupportType : fallback.type,
      language: allowedLanguages.includes(record.language as UniversalSupportLanguage)
        ? record.language as UniversalSupportLanguage
        : fallback.language,
      category: typeof record.category === 'string' && record.category.trim()
        ? normalizeUniversalCategory(record.category)
        : fallback.category,
      detectedProblem: typeof record.detectedProblem === 'string' && record.detectedProblem.trim()
        ? record.detectedProblem.trim()
        : fallback.detectedProblem,
      productName: typeof record.productName === 'string' && record.productName.trim()
        ? record.productName.trim()
        : fallback.productName,
      message: typeof record.message === 'string' && record.message.trim()
        ? record.message.trim()
        : fallback.message,
      possibleCauses: cleanArray(record.possibleCauses, fallback.possibleCauses),
      safeChecks: cleanArray(record.safeChecks, fallback.safeChecks),
      diagnosticQuestions: cleanArray(record.diagnosticQuestions, fallback.diagnosticQuestions),
      nextStep: typeof record.nextStep === 'string' && record.nextStep.trim()
        ? record.nextStep.trim()
        : fallback.nextStep,
      warning: typeof record.warning === 'string' && record.warning.trim() ? record.warning.trim() : fallback.warning,
      escalationRequired: Boolean(record.escalationRequired ?? fallback.escalationRequired),
      source: record.source || fallback.source,
    },
    input
  );
}

export function formatUniversalSupportAnswer(answer: UniversalSupportAnswer) {
  if (answer.type === 'non_support') return answer.message;

  const useEnglish = answer.language === 'en';
  const causesHeading = useEnglish ? 'This may happen due to:' : 'Ei problem hote pare:';
  const checksHeading = useEnglish ? 'Safe checks you can try first:' : 'Safe check korte paren:';
  const questionsHeading = useEnglish ? 'To understand better, please answer:' : 'Bujte help korbe, egulo bolun:';
  const nextHeading = 'Next:';
  const safetyHeading = 'Safety note:';
  const numberLines = (items: string[]) => items.map((item, index) => `${index + 1}. ${item}`).join('\n');

  return [
    `Detected issue:\n${answer.category} -> ${answer.detectedProblem}`,
    answer.productName ? `Device:\n${answer.productName}` : '',
    answer.possibleCauses.length ? `${causesHeading}\n\n${numberLines(answer.possibleCauses)}` : '',
    answer.safeChecks.length ? `${checksHeading}\n\n${numberLines(answer.safeChecks)}` : '',
    answer.diagnosticQuestions.length ? `${questionsHeading}\n\n${numberLines(answer.diagnosticQuestions)}` : '',
    `${nextHeading}\n${answer.nextStep}`,
    answer.warning ? `${safetyHeading}\n${answer.warning}` : '',
  ].filter(Boolean).join('\n\n');
}

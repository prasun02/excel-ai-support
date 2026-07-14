import cameraFlows from '@/data/flows/camera.json';
import generalFlows from '@/data/flows/general.json';
import printerFlows from '@/data/flows/printer.json';
import purchaseFlows from '@/data/flows/purchase.json';
import routerFlows from '@/data/flows/router.json';
import upsFlows from '@/data/flows/ups.json';
import warrantyFlows from '@/data/flows/warranty.json';
import cspLocations from '@/data/cspLocations.json';
import {
  analyzeSupportMessage,
  escalationLocationReply,
  isHumanHelpRequest,
  noExactSolutionReply,
  nonSupportReply,
} from '@/lib/languageUnderstanding';
import {
  findSimpleKnowledgeMatch,
  simpleKnowledgeToFlow,
} from '@/lib/simpleKnowledgeImport';
import {
  findModelWiseSolution,
  getDefaultSimpleSupportKnowledge,
} from '@/lib/modelWiseKnowledge';
import {
  analyzeSupportMessage as analyzeManualSupportKnowledge,
} from '@/lib/supportKnowledgeEngine';
import type {
  AiIntentMatch,
  LocalSupportTicket,
  ReplyLanguage,
  SimpleSupportKnowledgeItem,
  SolvedStatus,
  TroubleshootingFlow,
} from '@/types/support';
import { detectLanguage, normalizeText } from '@/utils/text';

const flows = [
  ...routerFlows,
  ...cameraFlows,
  ...printerFlows,
  ...upsFlows,
  ...warrantyFlows,
  ...purchaseFlows,
  ...generalFlows,
] as TroubleshootingFlow[];

type CspLocation = {
  area: string;
  keywords: string[];
  address: string;
  phone: string;
  engineerPhone: string;
};

const locations = cspLocations as CspLocation[];

type TroubleshootingInput = {
  message: string;
  selectedCategory?: string;
  ticketState?: Partial<LocalSupportTicket>;
  language?: ReplyLanguage;
  importedSimpleKnowledge?: SimpleSupportKnowledgeItem[];
  aiIntent?: AiIntentMatch | null;
};

type TroubleshootingOutput = {
  responseText: string;
  updatedTicketState: Partial<LocalSupportTicket>;
  detectedCategory: string;
  detectedIssueType: string;
  needsCategorySelection: boolean;
  matched: boolean;
  language: ReplyLanguage;
};

type LegacyEngineInput = {
  message: string;
  selectedCategory?: string;
  ticketContext?: Partial<LocalSupportTicket>;
};

type LegacyEngineResult = {
  category: string;
  issueType: string;
  reply: string;
  matched: boolean;
  language: ReplyLanguage;
  context: Partial<LocalSupportTicket>;
};

type LocationReply = {
  text: string;
  locationFound: boolean;
};

function flowId(flow: TroubleshootingFlow) {
  return `${flow.category}::${flow.issueType}`;
}

function findFlowById(id?: string) {
  if (!id) return undefined;

  return flows.find((flow) => flowId(flow) === id);
}

function sameCategory(left?: string, right?: string) {
  return Boolean(left && right && normalizeText(left) === normalizeText(right));
}

function scoreText(message: string, text: string) {
  const normalizedText = normalizeText(text);

  if (!normalizedText) return 0;
  if (message === normalizedText) return normalizedText.length + 25;
  if (message.includes(normalizedText)) return normalizedText.length + 10;

  return normalizedText
    .split(' ')
    .filter((word) => word.length > 2 && message.includes(word)).length;
}

function scoreFlow(message: string, flow: TroubleshootingFlow, selectedCategory?: string) {
  const categoryScore = sameCategory(selectedCategory, flow.category)
    ? 10
    : scoreText(message, flow.category);
  const issueScore = scoreText(message, flow.issueType);
  const symptomScore = Math.max(
    ...flow.symptoms.map((symptom) => scoreText(message, symptom)),
    0
  );

  return categoryScore + issueScore + symptomScore;
}

function findBestFlow(message: string, selectedCategory?: string) {
  const normalizedMessage = normalizeText(message);
  const categoryFlows = selectedCategory
    ? flows.filter((flow) => sameCategory(selectedCategory, flow.category))
    : flows;
  const candidates = categoryFlows.length > 0 ? categoryFlows : flows;
  let bestFlow = candidates[0];
  let bestScore = 0;

  for (const flow of candidates) {
    const score = scoreFlow(normalizedMessage, flow, selectedCategory);

    if (score > bestScore) {
      bestFlow = flow;
      bestScore = score;
    }
  }

  if (bestScore < 3 && selectedCategory && categoryFlows[0]) {
    return { flow: categoryFlows[0], matched: false };
  }

  return { flow: bestFlow, matched: bestScore >= 3 };
}

function categoryFromContext(ticketState?: Partial<LocalSupportTicket>, selectedCategory?: string) {
  if (selectedCategory?.trim()) return selectedCategory.trim();

  const ticketCategory = ticketState?.selectedCategory || ticketState?.category || '';

  return ticketCategory === 'General Support' ? '' : ticketCategory;
}

function isNotSolved(message: string) {
  const text = normalizeText(message);

  return [
    'no', 'not solved', 'no not solved', 'still problem', 'not fixed', 'same problem', 'kaj hoy nai', 'ekhono problem',
    'cannot do', "can't do", 'cant do', 'unable to do',
    '\u09a8\u09be', '\u09b8\u09ae\u09be\u09a7\u09be\u09a8 \u09b9\u09df\u09a8\u09bf', '\u098f\u0996\u09a8\u09cb \u09b8\u09ae\u09b8\u09cd\u09af\u09be', '\u09a0\u09bf\u0995 \u09b9\u09df\u09a8\u09bf',
  ].some((word) => text.includes(normalizeText(word)));
}

function isSolved(message: string) {
  const text = normalizeText(message);

  if (isNotSolved(message)) return false;

  return [
    'yes', 'yes solved', 'solved', 'fixed', 'okay', 'ok', 'done',
    '\u09b9\u09cd\u09af\u09be\u0981', '\u09b8\u09ae\u09be\u09a7\u09be\u09a8 \u09b9\u09df\u09c7\u099b\u09c7', '\u09a0\u09bf\u0995 \u09b9\u09df\u09c7\u099b\u09c7',
  ].some((word) => text.includes(normalizeText(word)));
}

function solvedReply(language: ReplyLanguage) {
  return language === 'bn' ? '\u0986\u09aa\u09a8\u09be\u09b0 \u09b8\u09ae\u09b8\u09cd\u09af\u09be\u099f\u09bf \u09b8\u09ae\u09be\u09a7\u09be\u09a8 \u09b9\u09df\u09c7\u099b\u09c7 \u099c\u09c7\u09a8\u09c7 \u09ad\u09be\u09b2\u09cb \u09b2\u09be\u0997\u09b2\u0964 \u0986\u09aa\u09a8\u09be\u09b0 \u0995\u09bf \u0986\u09b0 \u0995\u09cb\u09a8\u09cb \u09b8\u09be\u09b0\u09cd\u09ad\u09bf\u09b8 \u09aa\u09cd\u09b0\u09df\u09cb\u099c\u09a8?' : 'Glad to know your problem is solved. Do you need any other service?';
}

function categorySelectionReply(language: ReplyLanguage) {
  return language === 'bn' ? '\u0985\u09a8\u09c1\u0997\u09cd\u09b0\u09b9 \u0995\u09b0\u09c7 \u098f\u0995\u099f\u09bf \u09b8\u09be\u09b0\u09cd\u09ad\u09bf\u09b8 \u0995\u09cd\u09af\u09be\u099f\u09be\u0997\u09b0\u09bf \u09a8\u09bf\u09b0\u09cd\u09ac\u09be\u099a\u09a8 \u0995\u09b0\u09c1\u09a8\u0964' : 'Please select a service category.';
}

function moreDetailsReply(language: ReplyLanguage) {
  return language === 'bn' ? '\u0986\u09aa\u09a8\u09be\u09b0 \u09b8\u09ae\u09b8\u09cd\u09af\u09be\u099f\u09bf \u0986\u09b0\u0993 \u09ad\u09be\u09b2\u09cb\u09ad\u09be\u09ac\u09c7 \u09ac\u09c1\u099d\u09a4\u09c7 \u0985\u09a8\u09c1\u0997\u09cd\u09b0\u09b9 \u0995\u09b0\u09c7 \u0995\u09bf\u099b\u09c1 \u09ac\u09bf\u09b8\u09cd\u09a4\u09be\u09b0\u09bf\u09a4 \u09b2\u09bf\u0996\u09c1\u09a8\u0964 \u09af\u09c7\u09ae\u09a8: \u0995\u09c0 \u09b8\u09ae\u09b8\u09cd\u09af\u09be \u09b9\u099a\u09cd\u099b\u09c7, \u0995\u09cb\u09a8 \u09ae\u09a1\u09c7\u09b2/\u09a1\u09bf\u09ad\u09be\u0987\u09b8\u09c7 \u09b9\u099a\u09cd\u099b\u09c7, \u098f\u09ac\u0982 \u0995\u0996\u09a8 \u09a5\u09c7\u0995\u09c7 \u09b9\u099a\u09cd\u099b\u09c7\u0964' : 'To understand the issue better, please share a few more details. For example: what is happening, which model/device is affected, and when it started.';
}

function intro(flow: TroubleshootingFlow, language: ReplyLanguage) {
  return language === 'bn'
    ? '\u0986\u09aa\u09a8\u09bf \u09b8\u09ae\u09cd\u09ad\u09ac\u09a4 ' + flow.category + ' -> ' + flow.issueType + ' \u09ac\u09bf\u09b7\u09df\u09c7 \u099c\u09be\u09a8\u09a4\u09c7 \u099a\u09be\u099a\u09cd\u099b\u09c7\u09a8\u0964'
    : `You may be asking about ${flow.category} -> ${flow.issueType}.`;
}

function questionReply(flow: TroubleshootingFlow, question: string, language: ReplyLanguage, includeIntro: boolean) {
  const prefix = includeIntro ? `${intro(flow, language)}\n\n` : '';
  return language === 'bn' ? `${prefix}${'\u09ad\u09be\u09b2\u09cb\u09ad\u09be\u09ac\u09c7 \u09ac\u09c1\u099d\u09a4\u09c7 \u0985\u09a8\u09c1\u0997\u09cd\u09b0\u09b9 \u0995\u09b0\u09c7 \u0989\u09a4\u09cd\u09a4\u09b0 \u09a6\u09bf\u09a8:'}\n${question}` : `${prefix}To understand better, please answer:\n${question}`;
}

function solutionReply(
  flow: TroubleshootingFlow,
  language: ReplyLanguage,
  ticketState?: Partial<LocalSupportTicket>,
  importedSimpleKnowledge: SimpleSupportKnowledgeItem[] = []
) {
  const modelSolution = findModelWiseSolution({
    category: flow.category,
    issueType: flow.issueType,
    productModel: ticketState?.productModel || '',
    message: ticketState?.issue || '',
    importedSimpleKnowledge,
  });
  const solutionSteps = modelSolution?.solutionSteps?.length ? modelSolution.solutionSteps : flow.solutionSteps;
  const steps = solutionSteps.map((step, index) => `${index + 1}. ${step}`).join('\n');
  const solvedQuestion = language === 'bn' ? '\u0986\u09aa\u09a8\u09be\u09b0 \u09b8\u09ae\u09b8\u09cd\u09af\u09be\u099f\u09bf \u0995\u09bf \u09b8\u09ae\u09be\u09a7\u09be\u09a8 \u09b9\u09df\u09c7\u099b\u09c7?\n- \u09b9\u09cd\u09af\u09be\u0981, \u09b8\u09ae\u09be\u09a7\u09be\u09a8 \u09b9\u09df\u09c7\u099b\u09c7\n- \u09a8\u09be, \u09b8\u09ae\u09be\u09a7\u09be\u09a8 \u09b9\u09df\u09a8\u09bf' : `${flow.solvedQuestion}\n- Yes, solved\n- No, not solved`;
  const heading = language === 'bn' ? '\u0985\u09a8\u09c1\u0997\u09cd\u09b0\u09b9 \u0995\u09b0\u09c7 \u098f\u0987 \u09a7\u09be\u09aa\u0997\u09c1\u09b2\u09cb \u099a\u09c7\u09b7\u09cd\u099f\u09be \u0995\u09b0\u09c1\u09a8:' : 'Please try these steps:';
  return `${heading}\n\n${steps}\n\n${solvedQuestion}`;
}

function manualKnowledgeReply(
  responseText: string,
  solutionSteps: string[] = [],
  nextIfNotSolved = ''
) {
  const steps = solutionSteps.length
    ? `\n\n${solutionSteps.map((step, index) => {
        if (step.includes('\n')) return step;
        const isAlreadyNumbered = /^\d+\./.test(step.trim());
        return isAlreadyNumbered ? step : `${index + 1}. ${step}`;
      }).join('\n')}`
    : '';
  const next = nextIfNotSolved ? `\n\nNext: ${nextIfNotSolved}` : '';

  return `${responseText}${steps}${next}`;
}

function purchaseLocationReply(language: ReplyLanguage) {
  return language === 'bn' ? '\u09a7\u09a8\u09cd\u09af\u09ac\u09be\u09a6\u0964 \u0986\u09aa\u09a8\u09be\u09b0 \u09b2\u09cb\u0995\u09c7\u09b6\u09a8 \u0985\u09a8\u09c1\u09af\u09be\u09df\u09c0 \u0986\u09ae\u09be\u09a6\u09c7\u09b0 \u09b8\u09c7\u09b2\u09b8 \u099f\u09bf\u09ae \u09af\u09cb\u0997\u09be\u09af\u09cb\u0997 \u0995\u09b0\u09a4\u09c7 \u09aa\u09be\u09b0\u09ac\u09c7\u0964 \u0985\u09a8\u09c1\u0997\u09cd\u09b0\u09b9 \u0995\u09b0\u09c7 \u0986\u09aa\u09a8\u09be\u09b0 \u09ab\u09cb\u09a8 \u09a8\u09ae\u09cd\u09ac\u09b0 \u09a6\u09bf\u09a8 \u0985\u09a5\u09ac\u09be \u09a8\u09bf\u0995\u099f\u09b8\u09cd\u09a5 Excel sales point-\u098f \u09af\u09cb\u0997\u09be\u09af\u09cb\u0997 \u0995\u09b0\u09c1\u09a8\u0964' : 'Thank you. Our sales team can contact you based on your location. Please share your phone number or contact your nearest Excel sales point.';
}

function locationSupportReply(message: string, language: ReplyLanguage): LocationReply {
  const text = normalizeText(message);
  const location = locations.find((item) => item.keywords.some((keyword) => text.includes(normalizeText(keyword))));
  if (!location) {
    return { text: language === 'bn' ? '\u09a7\u09a8\u09cd\u09af\u09ac\u09be\u09a6\u0964 \u0985\u09a8\u09c1\u0997\u09cd\u09b0\u09b9 \u0995\u09b0\u09c7 \u0986\u09aa\u09a8\u09be\u09b0 \u099c\u09c7\u09b2\u09be/\u09b2\u09cb\u0995\u09c7\u09b6\u09a8 \u0986\u09b0\u09c7\u0995\u099f\u09c1 \u09aa\u09b0\u09bf\u09b7\u09cd\u0995\u09be\u09b0\u09ad\u09be\u09ac\u09c7 \u09b2\u09bf\u0996\u09c1\u09a8\u0964 \u0986\u09aa\u09a8\u09bf \u099a\u09be\u0987\u09b2\u09c7 \u098f\u0996\u09be\u09a8\u09c7 \u09a8\u09bf\u0995\u099f\u09b8\u09cd\u09a5 support point \u09a6\u09c7\u0996\u09a4\u09c7 \u09aa\u09be\u09b0\u09c7\u09a8: https://www.excelbd.com/support/' : 'Thank you. Please write your district/location more clearly. You may also find your nearest support point here: https://www.excelbd.com/support/', locationFound: false };
  }
  return {
    text: language === 'bn'
      ? '\u09a7\u09a8\u09cd\u09af\u09ac\u09be\u09a6\u0964 \u0986\u09aa\u09a8\u09be\u09b0 \u09a8\u09bf\u0995\u099f\u09b8\u09cd\u09a5 Excel Customer Support Point:' + `\n\n${location.address}\nContact: ${location.phone}\nEngineer contact: ${location.engineerPhone}\n\n` + '\u09af\u09a6\u09bf \u0986\u09aa\u09a8\u09bf \u09aa\u09a3\u09cd\u09af \u09aa\u09be\u09a0\u09be\u09a4\u09c7 \u09ac\u09be \u0986\u09b8\u09a4\u09c7 \u09a8\u09be \u09aa\u09be\u09b0\u09c7\u09a8, engineer contact \u09a8\u09ae\u09cd\u09ac\u09b0\u09c7 \u09af\u09cb\u0997\u09be\u09af\u09cb\u0997 \u0995\u09b0\u09c1\u09a8\u0964'
      : `Thank you. Please contact your nearest Excel Customer Support Point directly for further support.\n\n${location.address}\nContact: ${location.phone}\nEngineer contact: ${location.engineerPhone}\n\nYou may visit the service center physically with your device if needed.`,
    locationFound: true,
  };
}

function postEscalationPrompt(language: ReplyLanguage) {
  return language === 'bn' ? '\u0986\u09aa\u09a8\u09be\u09b0 \u09af\u09a6\u09bf \u0985\u09a8\u09cd\u09af \u0995\u09cb\u09a8\u09cb \u09b8\u09ae\u09b8\u09cd\u09af\u09be \u09ac\u09be \u09aa\u09cd\u09b0\u09b6\u09cd\u09a8 \u09a5\u09be\u0995\u09c7, \u0985\u09a8\u09c1\u0997\u09cd\u09b0\u09b9 \u0995\u09b0\u09c7 \u09b2\u09bf\u0996\u09c1\u09a8\u0964' : 'If you have any other support issue or query, please write it.';
}

function postEscalationClosingReply(language: ReplyLanguage) {
  return language === 'bn' ? '\u09a7\u09a8\u09cd\u09af\u09ac\u09be\u09a6\u0964 \u0986\u09aa\u09a8\u09be\u09b0 \u09af\u09a6\u09bf \u0985\u09a8\u09cd\u09af \u0995\u09cb\u09a8\u09cb Excel product support \u09b8\u09ae\u09b8\u09cd\u09af\u09be \u09a5\u09be\u0995\u09c7, \u0985\u09a8\u09c1\u0997\u09cd\u09b0\u09b9 \u0995\u09b0\u09c7 \u09b2\u09bf\u0996\u09c1\u09a8\u0964' : 'Thank you. If you have any other Excel product support issue, please write it.';
}

function purchaseQuestion(language: ReplyLanguage, includeIntro: boolean, flow: TroubleshootingFlow) {
  const question = language === 'bn' ? '\u09aa\u09a3\u09cd\u09af \u0995\u09cd\u09b0\u09df\u09c7\u09b0 \u099c\u09a8\u09cd\u09af \u0985\u09a8\u09c1\u0997\u09cd\u09b0\u09b9 \u0995\u09b0\u09c7 \u0986\u09aa\u09a8\u09be\u09b0 \u0995\u09be\u0999\u09cd\u0995\u09cd\u09b7\u09bf\u09a4 \u09b2\u09cb\u0995\u09c7\u09b6\u09a8 \u09b2\u09bf\u0996\u09c1\u09a8\u0964 \u098f\u09b0\u09aa\u09b0 \u0986\u09ae\u09b0\u09be \u0986\u09aa\u09a8\u09be\u0995\u09c7 \u09b8\u0982\u09b6\u09cd\u09b2\u09bf\u09b7\u09cd\u099f \u09b8\u09c7\u09b2\u09b8 \u0995\u09a8\u09cd\u099f\u09be\u0995\u09cd\u099f \u09aa\u09be\u09b0\u09b8\u09a8\u09c7\u09b0 \u09b8\u09be\u09a5\u09c7 \u09b8\u0982\u09af\u09c1\u0995\u09cd\u09a4 \u0995\u09b0\u09a4\u09c7 \u09b8\u09b9\u09be\u09df\u09a4\u09be \u0995\u09b0\u09ac\u0964' : 'For product purchase support, please mention your desired location. Then we can help connect you with the appropriate sales contact person.';
  const prefix = includeIntro ? `${intro(flow, language)}\n\n` : '';
  return `${prefix}${question}`;
}

function purchaseLocationLooksProvided(message: string) {
  const text = normalizeText(message);
  const hasPurchaseIntent = [
    'buy',
    'purchase',
    'product',
    'price',
    'dealer',
    'sales',
    'পণ্য',
    'কিনতে',
    'প্রোডাক্ট',
    'দাম',
  ].some((word) => text.includes(normalizeText(word)));
  const words = text.split(' ').filter(Boolean);

  return words.length > 0 && words.length <= 6 && !hasPurchaseIntent;
}

function buildContext(
  flow: TroubleshootingFlow,
  currentQuestionIndex: number,
  askedQuestions: string[],
  userAnswers: string[],
  solutionGiven: boolean,
  solvedStatus: SolvedStatus,
  extra: Partial<LocalSupportTicket> = {}
) {
  return {
    category: flow.category,
    selectedCategory: flow.category,
    issueType: flow.issueType,
    currentFlowId: flowId(flow),
    currentQuestionIndex,
    currentStep: currentQuestionIndex,
    askedQuestions,
    userAnswers,
    solutionGiven,
    solvedStatus,
    awaitingLocation: false,
    escalationActive: false,
    escalationCompleted: false,
    ...extra,
  };
}

function result(
  flow: TroubleshootingFlow,
  responseText: string,
  updatedTicketState: Partial<LocalSupportTicket>,
  language: ReplyLanguage,
  matched: boolean
): TroubleshootingOutput {
  return {
    responseText,
    updatedTicketState,
    detectedCategory: flow.category,
    detectedIssueType: flow.issueType,
    needsCategorySelection: false,
    matched,
    language,
  };
}

export function getNextTroubleshootingResponse(input: TroubleshootingInput): TroubleshootingOutput {
  const language = input.language || detectLanguage(input.message);
  const baseAnalysis = analyzeSupportMessage(input.message);
  const analysis = input.aiIntent && input.aiIntent.confidence >= 0.65
    ? {
        ...baseAnalysis,
        category: input.aiIntent.category || baseAnalysis.category,
        issueType: input.aiIntent.problem || baseAnalysis.issueType,
        matchedKeywords: input.aiIntent.matchedKeywords,
        isSupportRelated: true,
      }
    : baseAnalysis;
  const simpleKnowledge = [
    ...(input.importedSimpleKnowledge || []),
    ...getDefaultSimpleSupportKnowledge(),
  ];
  let ticketState = input.ticketState || {};

  if (ticketState.escalationCompleted) {
    if (!analysis.isSupportRelated || analysis.isNonSupport) {
      return {
        responseText: postEscalationClosingReply(language),
        updatedTicketState: ticketState,
        detectedCategory: categoryFromContext(ticketState, input.selectedCategory),
        detectedIssueType: ticketState.issueType || '',
        needsCategorySelection: false,
        matched: false,
        language,
      };
    }

    ticketState = {
      ...ticketState,
      category: analysis.category || input.selectedCategory || ticketState.category,
      selectedCategory: analysis.category || input.selectedCategory || ticketState.selectedCategory,
      issueType: '',
      currentFlowId: '',
      currentQuestionIndex: 0,
      currentStep: 0,
      askedQuestions: [],
      userAnswers: [],
      solutionGiven: false,
      solvedStatus: 'pending',
      awaitingLocation: false,
      escalationActive: false,
      escalationCompleted: false,
    };
  }

  const categoryHint = input.ticketState?.escalationCompleted && analysis.category
    ? analysis.category
    : input.selectedCategory;
  const selectedCategory = categoryFromContext(ticketState, categoryHint) || analysis.category;

  if (
    ticketState.awaitingLocation &&
    ticketState.escalationActive &&
    !isSolved(input.message) &&
    !isNotSolved(input.message)
  ) {
    const flow =
      findFlowById(ticketState.currentFlowId) ||
      flows.find((item) => sameCategory(item.category, selectedCategory)) ||
      flows[0];
    const locationReply = locationSupportReply(input.message, language);
    const responseText = locationReply.locationFound
      ? `${locationReply.text}\n\n${postEscalationPrompt(language)}`
      : locationReply.text;

    return result(
      flow,
      responseText,
      buildContext(
        flow,
        ticketState.currentQuestionIndex ?? ticketState.currentStep ?? 0,
        ticketState.askedQuestions || [],
        [...(ticketState.userAnswers || []), input.message],
        true,
        'not_solved',
        {
          awaitingLocation: !locationReply.locationFound,
          escalationActive: !locationReply.locationFound,
          escalationCompleted: locationReply.locationFound,
        }
      ),
      language,
      true
    );
  }

  const manualKnowledge = selectedCategory
    ? analyzeManualSupportKnowledge({
        message: input.message,
        selectedCategory,
        model: ticketState.productModel || '',
        serialNumber: ticketState.serialNumber || '',
        activeSolutionId: ticketState.currentFlowId || '',
        lastProblemName: ticketState.issueType || '',
      })
    : null;

  if (
    manualKnowledge &&
    !isHumanHelpRequest(input.message) &&
    !isNotSolved(input.message) &&
    manualKnowledge.type !== 'escalation' &&
    manualKnowledge.type !== 'non_support' &&
    (manualKnowledge.activeSolutionId || manualKnowledge.solutionSteps?.length || manualKnowledge.type === 'question')
  ) {
    const hasFinalSteps = Boolean(
      manualKnowledge.solutionSteps?.length &&
      /here (are|is) the|approved procedure/i.test(manualKnowledge.message)
    );
    const responseText = manualKnowledgeReply(
      manualKnowledge.message,
      hasFinalSteps ? manualKnowledge.solutionSteps : [],
      hasFinalSteps ? manualKnowledge.nextIfNotSolved : ''
    );

    return {
      responseText,
      updatedTicketState: {
        ...ticketState,
        category: manualKnowledge.category || selectedCategory,
        selectedCategory: manualKnowledge.category || selectedCategory,
        issueType: manualKnowledge.problemName || ticketState.issueType || analysis.issueType,
        currentFlowId: manualKnowledge.activeSolutionId || manualKnowledge.solutionId || manualKnowledge.problemId || ticketState.currentFlowId,
        currentQuestionIndex: ticketState.currentQuestionIndex ?? 0,
        currentStep: ticketState.currentStep ?? 0,
        askedQuestions: ticketState.askedQuestions || [],
        userAnswers: ticketState.userAnswers || [],
        solutionGiven: hasFinalSteps,
        solvedStatus: 'pending',
        awaitingLocation: false,
        escalationActive: false,
        escalationCompleted: false,
      },
      detectedCategory: manualKnowledge.category || selectedCategory,
      detectedIssueType: manualKnowledge.problemName || analysis.issueType,
      needsCategorySelection: false,
      matched: true,
      language,
    };
  }

  if (
    ticketState.awaitingLocation &&
    ticketState.escalationActive &&
    !isSolved(input.message) &&
    !isNotSolved(input.message)
  ) {
    const flow =
      findFlowById(ticketState.currentFlowId) ||
      flows.find((item) => sameCategory(item.category, selectedCategory)) ||
      flows[0];
    const locationReply = locationSupportReply(input.message, language);
    const responseText = locationReply.locationFound
      ? `${locationReply.text}\n\n${postEscalationPrompt(language)}`
      : locationReply.text;

    return result(
      flow,
      responseText,
      buildContext(
        flow,
        ticketState.currentQuestionIndex ?? ticketState.currentStep ?? 0,
        ticketState.askedQuestions || [],
        [...(ticketState.userAnswers || []), input.message],
        true,
        'not_solved',
        {
          awaitingLocation: !locationReply.locationFound,
          escalationActive: !locationReply.locationFound,
          escalationCompleted: locationReply.locationFound,
        }
      ),
      language,
      true
    );
  }

  if (isHumanHelpRequest(input.message)) {
    const knownCategory = categoryFromContext(ticketState, input.selectedCategory);

    return {
      responseText: escalationLocationReply(language),
      updatedTicketState: {
        ...ticketState,
        solvedStatus: 'not_solved',
        awaitingLocation: true,
        escalationActive: true,
        escalationCompleted: false,
      },
      detectedCategory: knownCategory,
      detectedIssueType: ticketState.issueType || analysis.issueType,
      needsCategorySelection: false,
      matched: false,
      language,
    };
  }

  if (!selectedCategory) {
    if (analysis.isNonSupport || !analysis.isSupportRelated) {
      return {
        responseText: nonSupportReply(language),
        updatedTicketState: ticketState,
        detectedCategory: '',
        detectedIssueType: '',
        needsCategorySelection: false,
        matched: false,
        language,
      };
    }

    return {
      responseText: categorySelectionReply(language),
      updatedTicketState: ticketState,
      detectedCategory: '',
      detectedIssueType: '',
      needsCategorySelection: true,
      matched: false,
      language,
    };
  }

  const existingFlow =
    findFlowById(ticketState.currentFlowId) ||
    (ticketState.issueType
      ? flows.find(
          (flow) =>
            sameCategory(flow.category, selectedCategory) &&
            normalizeText(flow.issueType) === normalizeText(ticketState.issueType || '')
        )
      : undefined);

  if (!existingFlow && analysis.isNonSupport) {
    return {
      responseText: nonSupportReply(language),
      updatedTicketState: ticketState,
      detectedCategory: selectedCategory,
      detectedIssueType: '',
      needsCategorySelection: false,
      matched: false,
      language,
    };
  }

  const exactFlow = analysis.issueType
    ? flows.find(
        (flow) =>
          sameCategory(flow.category, selectedCategory) &&
          normalizeText(flow.issueType) === normalizeText(analysis.issueType)
      )
    : undefined;
  const simpleMatch = findSimpleKnowledgeMatch({
    category: selectedCategory,
    problem: analysis.issueType,
    productModel: ticketState.productModel || '',
    message: input.message,
    knowledge: simpleKnowledge,
  });
  const simpleFlow = simpleMatch ? simpleKnowledgeToFlow(simpleMatch.item) : undefined;

  if (!existingFlow && analysis.issueType && !exactFlow && !simpleFlow) {
    return {
      responseText: noExactSolutionReply(language),
      updatedTicketState: {
        ...ticketState,
        category: selectedCategory,
        selectedCategory,
        issueType: analysis.issueType,
        currentFlowId: '',
        currentQuestionIndex: 0,
        currentStep: 0,
        solutionGiven: false,
        solvedStatus: 'not_solved',
        awaitingLocation: true,
        escalationActive: true,
        escalationCompleted: false,
      },
      detectedCategory: selectedCategory,
      detectedIssueType: analysis.issueType,
      needsCategorySelection: false,
      matched: false,
      language,
    };
  }

  const match = existingFlow
    ? { flow: existingFlow, matched: true }
    : exactFlow
      ? { flow: exactFlow, matched: true }
      : simpleFlow
        ? { flow: simpleFlow, matched: true }
        : findBestFlow(input.message, selectedCategory);

  if (!existingFlow && !match.matched) {
    const responseText = analysis.isSupportRelated && analysis.issueType
      ? noExactSolutionReply(language)
      : moreDetailsReply(language);

    return {
      responseText,
      updatedTicketState: {
        ...ticketState,
        category: selectedCategory,
        selectedCategory,
        issueType: '',
        currentFlowId: '',
        currentQuestionIndex: 0,
        currentStep: 0,
        solutionGiven: false,
        solvedStatus: 'pending',
        awaitingLocation: false,
        escalationActive: false,
        escalationCompleted: false,
      },
      detectedCategory: selectedCategory,
      detectedIssueType: '',
      needsCategorySelection: false,
      matched: false,
      language,
    };
  }

  const flow = match.flow;
  const askedQuestions = ticketState.askedQuestions || [];
  const userAnswers = ticketState.userAnswers || [];
  const currentQuestionIndex =
    ticketState.currentQuestionIndex ?? ticketState.currentStep ?? 0;
  const solutionGiven = Boolean(ticketState.solutionGiven);
  const questionLimit = Math.min(flow.questions.length, 3);

  if (
    ticketState.awaitingLocation &&
    ticketState.escalationActive &&
    !isSolved(input.message) &&
    !isNotSolved(input.message)
  ) {
    const locationReply = locationSupportReply(input.message, language);
    const responseText = locationReply.locationFound
      ? `${locationReply.text}\n\n${postEscalationPrompt(language)}`
      : locationReply.text;

    return result(
      flow,
      responseText,
      buildContext(
        flow,
        currentQuestionIndex,
        askedQuestions,
        [...userAnswers, input.message],
        true,
        'not_solved',
        {
          awaitingLocation: !locationReply.locationFound,
          escalationActive: !locationReply.locationFound,
          escalationCompleted: locationReply.locationFound,
        }
      ),
      language,
      true
    );
  }

  if (solutionGiven && isSolved(input.message)) {
    return result(
      flow,
      solvedReply(language),
      buildContext(flow, currentQuestionIndex, askedQuestions, userAnswers, true, 'solved'),
      language,
      true
    );
  }

  if (solutionGiven && (isNotSolved(input.message) || isHumanHelpRequest(input.message))) {
    return result(
      flow,
      escalationLocationReply(language),
      buildContext(flow, currentQuestionIndex, askedQuestions, userAnswers, true, 'not_solved', {
        awaitingLocation: true,
        escalationActive: true,
        escalationCompleted: false,
      }),
      language,
      true
    );
  }

  if (flow.category === 'New Product Purchase') {
    if (currentQuestionIndex > 0 || askedQuestions.length > 0 || purchaseLocationLooksProvided(input.message)) {
      return result(
        flow,
        purchaseLocationReply(language),
        buildContext(flow, 1, askedQuestions, [...userAnswers, input.message], true, 'pending'),
        language,
        true
      );
    }

    return result(
      flow,
      purchaseQuestion(language, true, flow),
      buildContext(flow, 1, [flow.questions[0]], userAnswers, false, 'pending'),
      language,
      true
    );
  }

  if (currentQuestionIndex === 0) {
    const firstQuestion = flow.questions[0];

    if (!firstQuestion) {
      return result(
        flow,
        solutionReply(flow, language, ticketState, input.importedSimpleKnowledge),
        buildContext(flow, currentQuestionIndex, askedQuestions, userAnswers, true, 'pending'),
        language,
        match.matched
      );
    }

    return result(
      flow,
      questionReply(flow, firstQuestion, language, true),
      buildContext(flow, 1, [firstQuestion], userAnswers, false, 'pending'),
      language,
      match.matched
    );
  }

  const nextAnswers = [...userAnswers, input.message];

  if (currentQuestionIndex < questionLimit) {
    const nextQuestion = flow.questions[currentQuestionIndex];

    return result(
      flow,
      questionReply(flow, nextQuestion, language, false),
      buildContext(
        flow,
        currentQuestionIndex + 1,
        [...askedQuestions, nextQuestion],
        nextAnswers,
        false,
        'pending'
      ),
      language,
      true
    );
  }

  return result(
    flow,
    solutionReply(flow, language, ticketState, input.importedSimpleKnowledge),
    buildContext(flow, currentQuestionIndex, askedQuestions, nextAnswers, true, 'pending'),
    language,
    true
  );
}

export function runTroubleshooting(input: LegacyEngineInput): LegacyEngineResult {
  const output = getNextTroubleshootingResponse({
    message: input.message,
    selectedCategory: input.selectedCategory,
    ticketState: input.ticketContext,
  });

  return {
    category: output.detectedCategory,
    issueType: output.detectedIssueType,
    reply: output.responseText,
    matched: output.matched,
    language: output.language,
    context: output.updatedTicketState,
  };
}

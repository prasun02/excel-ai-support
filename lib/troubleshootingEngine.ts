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
import type {
  LocalSupportTicket,
  ReplyLanguage,
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
    'no',
    'not solved',
    'no not solved',
    'still problem',
    'not fixed',
    'same problem',
    'kaj hoy nai',
    'ekhono problem',
    'না',
    'সমাধান হয়নি',
    'এখনো সমস্যা',
    'ঠিক হয়নি',
  ].some((word) => text.includes(normalizeText(word)));
}

function isSolved(message: string) {
  const text = normalizeText(message);

  if (isNotSolved(message)) return false;

  return [
    'yes',
    'yes solved',
    'solved',
    'fixed',
    'okay',
    'ok',
    'done',
    'হ্যাঁ',
    'সমাধান হয়েছে',
    'ঠিক হয়েছে',
  ].some((word) => text.includes(normalizeText(word)));
}

function solvedReply(language: ReplyLanguage) {
  return language === 'bn'
    ? 'আপনার সমস্যাটি সমাধান হয়েছে জেনে ভালো লাগল। আপনার কি আর কোনো সার্ভিস প্রয়োজন?'
    : 'Glad to know your problem is solved. Do you need any other service?';
}

function categorySelectionReply(language: ReplyLanguage) {
  return language === 'bn'
    ? 'অনুগ্রহ করে একটি সার্ভিস ক্যাটাগরি নির্বাচন করুন।'
    : 'Please select a service category.';
}

function moreDetailsReply(language: ReplyLanguage) {
  return language === 'bn'
    ? 'আপনার সমস্যাটি আরও ভালোভাবে বুঝতে অনুগ্রহ করে কিছু বিস্তারিত লিখুন। যেমন: কী সমস্যা হচ্ছে, কোন মডেল/ডিভাইসে হচ্ছে, এবং কখন থেকে হচ্ছে।'
    : 'To understand the issue better, please share a few more details. For example: what is happening, which model/device is affected, and when it started.';
}

function intro(flow: TroubleshootingFlow, language: ReplyLanguage) {
  return language === 'bn'
    ? `আপনি সম্ভবত ${flow.category} → ${flow.issueType} বিষয়ে জানতে চাচ্ছেন।`
    : `You may be asking about ${flow.category} → ${flow.issueType}.`;
}

function questionReply(flow: TroubleshootingFlow, question: string, language: ReplyLanguage, includeIntro: boolean) {
  const prefix = includeIntro ? `${intro(flow, language)}\n\n` : '';

  return language === 'bn'
    ? `${prefix}ভালোভাবে বুঝতে অনুগ্রহ করে উত্তর দিন:\n${question}`
    : `${prefix}To understand better, please answer:\n${question}`;
}

function solutionReply(flow: TroubleshootingFlow, language: ReplyLanguage) {
  const steps = flow.solutionSteps.map((step, index) => `${index + 1}. ${step}`).join('\n');
  const solvedQuestion =
    language === 'bn'
      ? 'আপনার সমস্যাটি কি সমাধান হয়েছে?\n- হ্যাঁ, সমাধান হয়েছে\n- না, সমাধান হয়নি'
      : `${flow.solvedQuestion}\n- Yes, solved\n- No, not solved`;
  const heading = language === 'bn'
    ? 'অনুগ্রহ করে এই ধাপগুলো চেষ্টা করুন:'
    : 'Please try these steps:';

  return `${heading}\n\n${steps}\n\n${solvedQuestion}`;
}

function purchaseLocationReply(language: ReplyLanguage) {
  return language === 'bn'
    ? 'ধন্যবাদ। আপনার লোকেশন অনুযায়ী আমাদের সেলস টিম যোগাযোগ করতে পারবে। অনুগ্রহ করে আপনার ফোন নম্বর দিন অথবা নিকটস্থ Excel sales point-এ যোগাযোগ করুন।'
    : 'Thank you. Our sales team can contact you based on your location. Please share your phone number or contact your nearest Excel sales point.';
}

function locationSupportReply(message: string, language: ReplyLanguage) {
  const text = normalizeText(message);
  const location = locations.find((item) =>
    item.keywords.some((keyword) => text.includes(normalizeText(keyword)))
  );

  if (!location) {
    return language === 'bn'
      ? 'ধন্যবাদ। অনুগ্রহ করে আপনার জেলা/লোকেশন আরেকটু পরিষ্কারভাবে লিখুন। আপনি চাইলে এখানে নিকটস্থ support point দেখতে পারেন: https://www.excelbd.com/support/'
      : 'Thank you. Please write your district/location more clearly. You may also find your nearest support point here: https://www.excelbd.com/support/';
  }

  return language === 'bn'
    ? `ধন্যবাদ। আপনার নিকটস্থ Excel Customer Support Point:\n\n${location.address}\nContact: ${location.phone}\nEngineer contact: ${location.engineerPhone}\n\nযদি আপনি পণ্য পাঠাতে বা আসতে না পারেন, engineer contact নম্বরে যোগাযোগ করুন।`
    : `Thank you. Your nearest Excel Customer Support Point:\n\n${location.address}\nContact: ${location.phone}\nEngineer contact: ${location.engineerPhone}\n\nIf you cannot visit or send the product, please contact the CSP engineer.`;
}

function purchaseQuestion(language: ReplyLanguage, includeIntro: boolean, flow: TroubleshootingFlow) {
  const question =
    language === 'bn'
      ? 'পণ্য ক্রয়ের জন্য অনুগ্রহ করে আপনার কাঙ্ক্ষিত লোকেশন লিখুন। এরপর আমরা আপনাকে সংশ্লিষ্ট সেলস কন্টাক্ট পারসনের সাথে সংযুক্ত করতে সহায়তা করব।'
      : 'For product purchase support, please mention your desired location. Then we can help connect you with the appropriate sales contact person.';
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
  solvedStatus: SolvedStatus
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
  const analysis = analyzeSupportMessage(input.message);
  const selectedCategory = categoryFromContext(input.ticketState, input.selectedCategory) || analysis.category;

  if (!selectedCategory) {
    if (analysis.isNonSupport || !analysis.isSupportRelated) {
      return {
        responseText: nonSupportReply(language),
        updatedTicketState: input.ticketState || {},
        detectedCategory: '',
        detectedIssueType: '',
        needsCategorySelection: false,
        matched: false,
        language,
      };
    }

    return {
      responseText: categorySelectionReply(language),
      updatedTicketState: input.ticketState || {},
      detectedCategory: '',
      detectedIssueType: '',
      needsCategorySelection: true,
      matched: false,
      language,
    };
  }

  const existingFlow =
    findFlowById(input.ticketState?.currentFlowId) ||
    (input.ticketState?.issueType
      ? flows.find(
          (flow) =>
            sameCategory(flow.category, selectedCategory) &&
            normalizeText(flow.issueType) === normalizeText(input.ticketState?.issueType || '')
        )
      : undefined);

  if (!existingFlow && analysis.isNonSupport) {
    return {
      responseText: nonSupportReply(language),
      updatedTicketState: input.ticketState || {},
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

  if (!existingFlow && analysis.issueType && !exactFlow) {
    return {
      responseText: noExactSolutionReply(language),
      updatedTicketState: {
        ...input.ticketState,
        category: selectedCategory,
        selectedCategory,
        issueType: analysis.issueType,
        currentFlowId: '',
        currentQuestionIndex: 0,
        currentStep: 0,
        solutionGiven: false,
        solvedStatus: 'not_solved',
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
      : findBestFlow(input.message, selectedCategory);

  if (!existingFlow && !match.matched) {
    const responseText = analysis.isSupportRelated && analysis.issueType
      ? noExactSolutionReply(language)
      : moreDetailsReply(language);

    return {
      responseText,
      updatedTicketState: {
        ...input.ticketState,
        category: selectedCategory,
        selectedCategory,
        issueType: '',
        currentFlowId: '',
        currentQuestionIndex: 0,
        currentStep: 0,
        solutionGiven: false,
        solvedStatus: 'pending',
      },
      detectedCategory: selectedCategory,
      detectedIssueType: '',
      needsCategorySelection: false,
      matched: false,
      language,
    };
  }

  const flow = match.flow;
  const askedQuestions = input.ticketState?.askedQuestions || [];
  const userAnswers = input.ticketState?.userAnswers || [];
  const currentQuestionIndex =
    input.ticketState?.currentQuestionIndex ?? input.ticketState?.currentStep ?? 0;
  const solutionGiven = Boolean(input.ticketState?.solutionGiven);
  const questionLimit = Math.min(flow.questions.length, 3);

  if (
    input.ticketState?.solvedStatus === 'not_solved' &&
    !isSolved(input.message) &&
    !isNotSolved(input.message)
  ) {
    return result(
      flow,
      locationSupportReply(input.message, language),
      buildContext(flow, currentQuestionIndex, askedQuestions, [...userAnswers, input.message], true, 'not_solved'),
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
      buildContext(flow, currentQuestionIndex, askedQuestions, userAnswers, true, 'not_solved'),
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
    solutionReply(flow, language),
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

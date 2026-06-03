import commonProblemsData from '@/data/support-knowledge/commonProblems.json';
import escalationRulesData from '@/data/support-knowledge/escalationRules.json';
import followUpQuestionsData from '@/data/support-knowledge/followUpQuestions.json';
import modelSpecificSolutionsData from '@/data/support-knowledge/modelSpecificSolutions.json';
import procedureStepsData from '@/data/support-knowledge/procedureSteps.json';
import proceduresData from '@/data/support-knowledge/procedures.json';
import productsData from '@/data/support-knowledge/products.json';

type ProductKnowledge = {
  productId: string;
  itemName?: string;
  itemCode?: string;
  itemGroup?: string;
  category: string;
  brand: string;
  model: string;
  modelFamily: string;
  deviceType: string;
  requiresSerial?: boolean;
  requiresModel?: boolean;
  requiresHardwareVersion?: boolean;
  hardwareVersions?: string[];
  active: boolean;
};

type CommonProblemKnowledge = {
  problemId: string;
  category: string;
  modelFamily: string;
  problemName: string;
  symptoms: string[];
  possibleCauses?: string[];
  customerExplanation?: string;
  solutionSteps: string[];
  safeCustomerChecks?: string[];
  requiresModel?: boolean;
  requiresHardwareVersion?: boolean;
  requiresSerial?: boolean;
  requiresStickerPhoto?: boolean;
  firmwareRequired?: boolean;
  firmwareWarning?: string;
  routerFreeSupport?: boolean;
  riskLevel?: string;
  nextIfNotSolved: string;
  active: boolean;
};

type ModelSpecificSolutionKnowledge = {
  solutionId: string;
  productId: string;
  model: string;
  problemName: string;
  symptoms: string[];
  possibleCauses?: string[];
  safeCustomerChecks?: string[];
  solutionSteps: string[];
  internalTechnicianSteps?: string[];
  procedureId?: string;
  riskLevel?: string;
  requiresModel?: boolean;
  requiresHardwareVersion?: boolean;
  requiresSerial?: boolean;
  requiresStickerPhoto?: boolean;
  firmwareRequired?: boolean;
  firmwareWarning?: string;
  routerFreeSupport?: boolean;
  nextIfNotSolved: string;
  imageUrl: string;
  videoUrl: string;
  active: boolean;
};

type FollowUpQuestionKnowledge = {
  parentSolutionId: string;
  questionKeywords: string[];
  answer: string;
  language: string;
  active: boolean;
};

type EscalationRuleKnowledge = {
  category: string;
  condition: string;
  escalationMessage: string;
  active: boolean;
};

type ProcedureKnowledge = {
  procedureId: string;
  procedureCode: string;
  procedureName: string;
  category: string;
  brand: string;
  model: string;
  hardwareVersion: string;
  procedureType: string;
  shortAnswer: string;
  warning: string;
  imageUrl: string;
  videoUrl: string;
  active: boolean;
};

type ProcedureStepKnowledge = {
  procedureId: string;
  procedureCode: string;
  stepOrder: number;
  instruction: string;
  expectedResult: string;
  troubleshootingIfNotShowing: string;
  active: boolean;
};

export type ManualSupportInput = {
  message: string;
  selectedCategory?: string;
  model?: string;
  productId?: string;
  modelFamily?: string;
  hardwareVersion?: string;
  activeSolutionId?: string;
  lastProblemName?: string;
  serialNumber?: string;
};

export type ManualSupportResult = {
  type: 'solution' | 'follow_up' | 'question' | 'escalation' | 'non_support';
  category?: string;
  problemName?: string;
  solutionId?: string;
  problemId?: string;
  message: string;
  solutionSteps?: string[];
  nextIfNotSolved?: string;
  escalationRequired?: boolean;
  activeSolutionId?: string;
};

const products = productsData as ProductKnowledge[];
const commonProblems = commonProblemsData as CommonProblemKnowledge[];
const modelSpecificSolutions = modelSpecificSolutionsData as ModelSpecificSolutionKnowledge[];
const followUpQuestions = followUpQuestionsData as FollowUpQuestionKnowledge[];
const escalationRules = escalationRulesData as EscalationRuleKnowledge[];
const procedures = proceduresData as ProcedureKnowledge[];
const procedureSteps = procedureStepsData as ProcedureStepKnowledge[];
const FIRMWARE_WARNING =
  'Firmware update must match exact model and hardware version. Wrong firmware or power loss during update may damage router. If you are unsure, please visit Excel CSP.';

const nonSupportKeywords = [
  'poem',
  'story',
  'joke',
  'song',
  'recipe',
  'write me',
  'tell me a story',
  'love message',
  'politics',
];

const notSolvedKeywords = [
  'not solved',
  'still problem',
  'same problem',
  'not working',
  'not fixed',
  'no solution',
  'issue remains',
  'problem remains',
  'kaj hoy nai',
  'ekhono problem',
  'সমাধান হয়নি',
  'এখনো সমস্যা',
];

const warrantyOrReplacementKeywords = [
  'warranty',
  'replacement',
  'replace',
  'rma',
  'claim',
  'hardware issue',
  'physical damage',
  'repair',
];

const startTroubleshootingKeywords = [
  'yes',
  'start',
  'solution',
  'troubleshoot',
  'guide me',
  'continue',
  'ok',
  'okay',
  'step',
  'steps',
  'guide',
  'guide me',
  'how',
  'how to',
  'firmware',
  'update',
];

const procedureKeywords = [
  'procedure',
  'step by step',
  'firmware',
  'update',
  'upgrade',
  'how',
  'how to',
  'configure',
  'configuration',
  'pppoe',
  'dynamic ip',
  'router page',
  '192.168',
];

function normalize(value: string) {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesKeyword(message: string, keywords: string[]) {
  return keywords.some((keyword) => {
    const normalizedKeyword = normalize(keyword);

    return normalizedKeyword && message.includes(normalizedKeyword);
  });
}

function keywordScore(message: string, keywords: string[]) {
  return keywords.reduce((total, keyword) => {
    const normalizedKeyword = normalize(keyword);

    if (!normalizedKeyword) return total;
    if (message.includes(normalizedKeyword)) return total + Math.max(3, normalizedKeyword.length);

    const wordMatches = normalizedKeyword
      .split(' ')
      .filter((word) => word.length > 2 && message.includes(word)).length;

    return total + wordMatches;
  }, 0);
}

function isRouterCategory(category?: string) {
  return normalize(category || '').includes('router') || normalize(category || '').includes('internet');
}

function isProcedureRequest(message: string) {
  return includesKeyword(message, procedureKeywords);
}

function routerInfoGuidance(message: string) {
  const normalized = normalize(message);

  if (/(deco|mesh)/.test(normalized)) {
    return 'Deco series usually uses the Deco app for setup/update. Please share exact Deco model if you need model-specific guidance.';
  }

  if (/(sim|4g|lte|gp|grameenphone|banglalink|robi|airtel|teletalk|apn)/.test(normalized)) {
    return 'SIM/4G router may need APN configuration based on operator such as Grameenphone or Banglalink. Please share exact router model and SIM operator. I will not guess exact APN unless it is added in manual knowledge.';
  }

  if (/(mercusys|192\.168\.1\.1)/.test(normalized)) {
    return 'Mercusys routers usually use 192.168.1.1. IP may vary by configuration. If it does not open, check default gateway.';
  }

  if (/(tp-link|tplink|192\.168\.0\.1|router page|login ip)/.test(normalized)) {
    return 'For TP-Link routers usually open 192.168.0.1 after connecting to the router. IP may vary by configuration. If it does not open, check default gateway.';
  }

  if (/(mobile|phone)/.test(normalized)) {
    return 'Some router pages can open by mobile using default WiFi/SSID from sticker, but firmware update is safer by PC.';
  }

  return '';
}

function detectProductFromMessage(message: string) {
  return products.find((item) => {
    if (!item.active) return false;

    return [
      item.productId,
      item.itemCode || '',
      item.itemName || '',
      item.model || '',
      item.modelFamily || '',
      item.brand || '',
    ].some((keyword) => {
      const normalizedKeyword = normalize(keyword);

      return normalizedKeyword && message.includes(normalizedKeyword);
    });
  }) || null;
}

function categoryMatches(inputCategory: string | undefined, itemCategory: string) {
  if (!inputCategory) return true;

  const selected = normalize(inputCategory);
  const item = normalize(itemCategory);

  return selected === item || selected.includes(item) || item.includes(selected);
}

function modelMatches(input: ManualSupportInput, solution: ModelSpecificSolutionKnowledge) {
  const productId = normalize(input.productId || '');
  const model = normalize(input.model || '');
  const messageProduct = detectProductFromMessage(normalize(input.message || ''));

  return (
    Boolean(productId && productId === normalize(solution.productId)) ||
    Boolean(model && (model === normalize(solution.model) || model.includes(normalize(solution.model)))) ||
    Boolean(messageProduct && normalize(messageProduct.productId) === normalize(solution.productId))
  );
}

function modelFamilyMatches(input: ManualSupportInput, problem: CommonProblemKnowledge) {
  const modelFamily = normalize(input.modelFamily || '');
  const problemFamily = normalize(problem.modelFamily);

  return !modelFamily || problemFamily === 'general' || modelFamily === problemFamily;
}

function getProductCategory(input: ManualSupportInput) {
  const directProduct = products.find((item) => {
    if (!item.active) return false;

    return (
      Boolean(input.productId && normalize(input.productId) === normalize(item.productId)) ||
      Boolean(input.model && normalize(input.model).includes(normalize(item.model)))
    );
  });
  const messageProduct = detectProductFromMessage(normalize(input.message || ''));
  const product = directProduct || messageProduct;

  return product?.category || input.selectedCategory || '';
}

function getDetectedProduct(input: ManualSupportInput) {
  return products.find((item) => {
    if (!item.active) return false;

    return (
      Boolean(input.productId && normalize(input.productId) === normalize(item.productId)) ||
      Boolean(input.model && normalize(input.model).includes(normalize(item.model)))
    );
  }) || detectProductFromMessage(normalize(input.message || ''));
}

function formatSolutionMessage(
  problemName: string,
  explanation?: string,
  possibleCauses: string[] = [],
  safeChecks: string[] = []
) {
  const causeText = possibleCauses.length > 0
    ? `\n\nPossible causes:\n${possibleCauses.map((cause, index) => `${index + 1}. ${cause}`).join('\n')}`
    : '';
  const safeCheckText = safeChecks.length > 0
    ? `\n\nSafe checks you can try first:\n${safeChecks.map((check, index) => `${index + 1}. ${check}`).join('\n')}`
    : '';
  const explanationText = explanation ? `${explanation} ` : '';

  return `${explanationText}${causeText}${safeCheckText}\n\nI found an Excel-approved support flow for ${problemName}. I can guide you with safe checks first. Do you want step-by-step guidance?`.trim();
}

function escalationMessage(category?: string) {
  const rule = escalationRules.find(
    (item) =>
      item.active &&
      normalize(item.condition) === 'not solved' &&
      categoryMatches(category, item.category)
  );

  return rule?.escalationMessage ||
    'I do not have an Excel-approved exact solution for this issue yet. I can forward this to human support.';
}

function matchFollowUp(input: ManualSupportInput, normalizedMessage: string) {
  if (!input.activeSolutionId) return null;

  const explicitRouterGuidance = routerInfoGuidance(normalizedMessage);
  if (explicitRouterGuidance && isRouterCategory(input.selectedCategory)) {
    return {
      parentSolutionId: input.activeSolutionId,
      questionKeywords: [],
      answer: explicitRouterGuidance,
      language: 'en',
      active: true,
    };
  }

  return followUpQuestions.find(
    (item) =>
      item.active &&
      normalize(item.parentSolutionId) === normalize(input.activeSolutionId || '') &&
      includesKeyword(normalizedMessage, item.questionKeywords)
  ) || null;
}

function formatProcedureAnswer(solution: ModelSpecificSolutionKnowledge) {
  if (!solution.procedureId) return null;

  const procedure = procedures.find(
    (item) =>
      item.active &&
      (normalize(item.procedureId) === normalize(solution.procedureId || '') ||
        normalize(item.procedureCode) === normalize(solution.procedureId || ''))
  );
  const steps = procedureSteps
    .filter(
      (item) =>
        item.active &&
        (normalize(item.procedureId) === normalize(solution.procedureId || '') ||
          normalize(item.procedureCode) === normalize(solution.procedureId || ''))
    )
    .sort((left, right) => left.stepOrder - right.stepOrder);

  if (!procedure || steps.length === 0) return null;

  const warning = solution.firmwareRequired ? FIRMWARE_WARNING : procedure.warning;
  const stepText = steps.map((step) => `${step.stepOrder}. ${step.instruction}`).join('\n');

  return `${warning}\n\nApproved procedure: ${procedure.procedureName}\n\n${stepText}`;
}

function matchActiveSolution(input: ManualSupportInput, normalizedMessage: string) {
  if (!input.activeSolutionId || !includesKeyword(normalizedMessage, startTroubleshootingKeywords)) {
    return null;
  }

  const modelSolution = modelSpecificSolutions.find(
    (item) => item.active && normalize(item.solutionId) === normalize(input.activeSolutionId || '')
  );

  if (modelSolution) {
    const procedureAnswer = isProcedureRequest(normalizedMessage)
      ? formatProcedureAnswer(modelSolution)
      : null;

    return {
      category: getProductCategory(input),
      problemName: modelSolution.problemName,
      solutionId: modelSolution.solutionId,
      solutionSteps: procedureAnswer ? [procedureAnswer] : modelSolution.solutionSteps,
      nextIfNotSolved: modelSolution.nextIfNotSolved,
      procedureAnswer: Boolean(procedureAnswer),
    };
  }

  const commonProblem = commonProblems.find(
    (item) => item.active && normalize(item.problemId) === normalize(input.activeSolutionId || '')
  );

  if (!commonProblem) return null;

  return {
    category: commonProblem.category,
    problemName: commonProblem.problemName,
    problemId: commonProblem.problemId,
    solutionSteps: commonProblem.solutionSteps,
    nextIfNotSolved: commonProblem.nextIfNotSolved,
  };
}

function matchModelSpecificSolution(input: ManualSupportInput, normalizedMessage: string) {
  const messageProduct = detectProductFromMessage(normalizedMessage);

  if (!input.productId && !input.model && !messageProduct) return null;

  return modelSpecificSolutions
    .filter((item) => item.active && modelMatches(input, item))
    .map((item) => ({
      item,
      score:
        keywordScore(normalizedMessage, item.symptoms) +
        (item.requiresModel ? 5 : 0) +
        (item.firmwareRequired ? 3 : 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)[0]?.item || null;
}

function matchCommonProblem(input: ManualSupportInput, normalizedMessage: string) {
  const category = getProductCategory(input);

  return commonProblems
    .filter((item) => item.active && categoryMatches(category, item.category) && modelFamilyMatches(input, item))
    .map((item) => ({
      item,
      score:
        keywordScore(normalizedMessage, item.symptoms) +
        (item.requiresModel ? 5 : 0) +
        (item.firmwareRequired ? 3 : 0) +
        (item.safeCustomerChecks?.length ? 2 : 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)[0]?.item || null;
}

export function analyzeSupportMessage(input: ManualSupportInput): ManualSupportResult {
  const normalizedMessage = normalize(input.message);
  const category = getProductCategory(input);
  const detectedProduct = getDetectedProduct(input);

  if (
    detectedProduct?.requiresSerial &&
    !input.serialNumber &&
    includesKeyword(normalizedMessage, warrantyOrReplacementKeywords)
  ) {
    return {
      type: 'question',
      category: detectedProduct.category,
      message: 'Warranty details may need to be checked from Excel warranty portal or nearest CSP. If available, please share serial number or invoice details. You can also continue describing the issue.',
      escalationRequired: false,
    };
  }

  if (includesKeyword(normalizedMessage, nonSupportKeywords)) {
    return {
      type: 'non_support',
      message: "I'm here to help with Excel Technologies product support only. Please describe your product issue.",
      escalationRequired: false,
    };
  }

  const followUp = matchFollowUp(input, normalizedMessage);

  if (followUp) {
    return {
      type: 'follow_up',
      category,
      problemName: input.lastProblemName,
      solutionId: input.activeSolutionId,
      message: followUp.answer,
      escalationRequired: false,
      activeSolutionId: input.activeSolutionId,
    };
  }

  const activeSolution = matchActiveSolution(input, normalizedMessage);

  if (activeSolution) {
    return {
      type: 'solution',
      category: activeSolution.category,
      problemName: activeSolution.problemName,
      solutionId: activeSolution.solutionId,
      problemId: activeSolution.problemId,
      message: activeSolution.procedureAnswer
        ? `Here is the approved procedure for ${activeSolution.problemName}.`
        : `Here are the Excel-approved safe troubleshooting steps for ${activeSolution.problemName}.`,
      solutionSteps: activeSolution.solutionSteps,
      nextIfNotSolved: activeSolution.nextIfNotSolved,
      escalationRequired: false,
      activeSolutionId: activeSolution.solutionId || activeSolution.problemId,
    };
  }

  const modelSpecificSolution = matchModelSpecificSolution(input, normalizedMessage);

  if (modelSpecificSolution) {
    if (
      isRouterCategory(category || modelSpecificSolution.problemName) &&
      (modelSpecificSolution.requiresModel || modelSpecificSolution.requiresHardwareVersion || modelSpecificSolution.requiresStickerPhoto) &&
      !input.model
    ) {
      return {
        type: 'question',
        category: category || 'Router / Internet',
        problemName: modelSpecificSolution.problemName,
        solutionId: modelSpecificSolution.solutionId,
        message: 'Please share your router model or upload a clear photo of the backside sticker. You can also write the model manually, for example: TL-WR845N Ver 4.',
        escalationRequired: false,
        activeSolutionId: modelSpecificSolution.solutionId,
      };
    }

    return {
      type: 'solution',
      category,
      problemName: modelSpecificSolution.problemName,
      solutionId: modelSpecificSolution.solutionId,
      message: formatSolutionMessage(
        modelSpecificSolution.problemName,
        undefined,
        modelSpecificSolution.possibleCauses,
        modelSpecificSolution.safeCustomerChecks
      ),
      solutionSteps: modelSpecificSolution.solutionSteps,
      nextIfNotSolved: modelSpecificSolution.nextIfNotSolved,
      escalationRequired: false,
      activeSolutionId: modelSpecificSolution.solutionId,
    };
  }

  const commonProblem = matchCommonProblem(input, normalizedMessage);

  if (commonProblem) {
    if (
      isRouterCategory(commonProblem.category) &&
      (commonProblem.requiresModel || commonProblem.requiresHardwareVersion || commonProblem.requiresStickerPhoto) &&
      !input.model
    ) {
      return {
        type: 'question',
        category: commonProblem.category,
        problemName: commonProblem.problemName,
        problemId: commonProblem.problemId,
        message: 'Please share your router model or upload a clear photo of the backside sticker. You can also write the model manually, for example: TL-WR845N Ver 4.',
        escalationRequired: false,
        activeSolutionId: commonProblem.problemId,
      };
    }

    return {
      type: 'solution',
      category: commonProblem.category,
      problemName: commonProblem.problemName,
      problemId: commonProblem.problemId,
      message: formatSolutionMessage(
        commonProblem.problemName,
        commonProblem.customerExplanation,
        commonProblem.possibleCauses,
        commonProblem.safeCustomerChecks
      ),
      solutionSteps: commonProblem.safeCustomerChecks?.length ? commonProblem.safeCustomerChecks : commonProblem.solutionSteps,
      nextIfNotSolved: commonProblem.nextIfNotSolved,
      escalationRequired: false,
      activeSolutionId: commonProblem.problemId,
    };
  }

  if (includesKeyword(normalizedMessage, notSolvedKeywords)) {
    return {
      type: 'escalation',
      category,
      problemName: input.lastProblemName,
      message: escalationMessage(category),
      escalationRequired: true,
      activeSolutionId: input.activeSolutionId,
    };
  }

  return {
    type: 'escalation',
    category,
    problemName: input.lastProblemName,
    message: escalationMessage(category),
    escalationRequired: true,
    activeSolutionId: input.activeSolutionId,
  };
}

export function getManualSupportKnowledge() {
  return {
    products,
    commonProblems,
    modelSpecificSolutions,
    followUpQuestions,
    escalationRules,
  };
}

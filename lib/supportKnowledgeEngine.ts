import commonProblemsData from '@/data/support-knowledge/commonProblems.json';
import escalationRulesData from '@/data/support-knowledge/escalationRules.json';
import followUpQuestionsData from '@/data/support-knowledge/followUpQuestions.json';
import modelSpecificSolutionsData from '@/data/support-knowledge/modelSpecificSolutions.json';
import productsData from '@/data/support-knowledge/products.json';

type ProductKnowledge = {
  productId: string;
  category: string;
  brand: string;
  model: string;
  modelFamily: string;
  deviceType: string;
  active: boolean;
};

type CommonProblemKnowledge = {
  problemId: string;
  category: string;
  modelFamily: string;
  problemName: string;
  symptoms: string[];
  solutionSteps: string[];
  nextIfNotSolved: string;
  active: boolean;
};

type ModelSpecificSolutionKnowledge = {
  solutionId: string;
  productId: string;
  model: string;
  problemName: string;
  symptoms: string[];
  solutionSteps: string[];
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

export type ManualSupportInput = {
  message: string;
  selectedCategory?: string;
  model?: string;
  productId?: string;
  modelFamily?: string;
  activeSolutionId?: string;
  lastProblemName?: string;
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

function categoryMatches(inputCategory: string | undefined, itemCategory: string) {
  if (!inputCategory) return true;

  const selected = normalize(inputCategory);
  const item = normalize(itemCategory);

  return selected === item || selected.includes(item) || item.includes(selected);
}

function modelMatches(input: ManualSupportInput, solution: ModelSpecificSolutionKnowledge) {
  const productId = normalize(input.productId || '');
  const model = normalize(input.model || '');

  return (
    Boolean(productId && productId === normalize(solution.productId)) ||
    Boolean(model && model === normalize(solution.model))
  );
}

function modelFamilyMatches(input: ManualSupportInput, problem: CommonProblemKnowledge) {
  const modelFamily = normalize(input.modelFamily || '');
  const problemFamily = normalize(problem.modelFamily);

  return !modelFamily || problemFamily === 'general' || modelFamily === problemFamily;
}

function getProductCategory(input: ManualSupportInput) {
  const product = products.find((item) => {
    if (!item.active) return false;

    return (
      Boolean(input.productId && normalize(input.productId) === normalize(item.productId)) ||
      Boolean(input.model && normalize(input.model) === normalize(item.model))
    );
  });

  return product?.category || input.selectedCategory || '';
}

function formatSolutionMessage(problemName: string) {
  return `Manual support knowledge found a solution for ${problemName}.`;
}

function escalationMessage(category?: string) {
  const rule = escalationRules.find(
    (item) =>
      item.active &&
      normalize(item.condition) === 'not solved' &&
      categoryMatches(category, item.category)
  );

  return rule?.escalationMessage ||
    'No verified manual solution was found. Please escalate this issue to human support.';
}

function matchFollowUp(input: ManualSupportInput, normalizedMessage: string) {
  if (!input.activeSolutionId) return null;

  return followUpQuestions.find(
    (item) =>
      item.active &&
      normalize(item.parentSolutionId) === normalize(input.activeSolutionId || '') &&
      includesKeyword(normalizedMessage, item.questionKeywords)
  ) || null;
}

function matchModelSpecificSolution(input: ManualSupportInput, normalizedMessage: string) {
  if (!input.productId && !input.model) return null;

  return modelSpecificSolutions.find(
    (item) =>
      item.active &&
      modelMatches(input, item) &&
      includesKeyword(normalizedMessage, item.symptoms)
  ) || null;
}

function matchCommonProblem(input: ManualSupportInput, normalizedMessage: string) {
  const category = getProductCategory(input);

  return commonProblems.find(
    (item) =>
      item.active &&
      categoryMatches(category, item.category) &&
      modelFamilyMatches(input, item) &&
      includesKeyword(normalizedMessage, item.symptoms)
  ) || null;
}

export function analyzeSupportMessage(input: ManualSupportInput): ManualSupportResult {
  const normalizedMessage = normalize(input.message);
  const category = getProductCategory(input);

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

  const modelSpecificSolution = matchModelSpecificSolution(input, normalizedMessage);

  if (modelSpecificSolution) {
    return {
      type: 'solution',
      category,
      problemName: modelSpecificSolution.problemName,
      solutionId: modelSpecificSolution.solutionId,
      message: formatSolutionMessage(modelSpecificSolution.problemName),
      solutionSteps: modelSpecificSolution.solutionSteps,
      nextIfNotSolved: modelSpecificSolution.nextIfNotSolved,
      escalationRequired: false,
      activeSolutionId: modelSpecificSolution.solutionId,
    };
  }

  const commonProblem = matchCommonProblem(input, normalizedMessage);

  if (commonProblem) {
    return {
      type: 'solution',
      category: commonProblem.category,
      problemName: commonProblem.problemName,
      problemId: commonProblem.problemId,
      message: formatSolutionMessage(commonProblem.problemName),
      solutionSteps: commonProblem.solutionSteps,
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

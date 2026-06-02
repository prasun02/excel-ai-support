import modelWiseKnowledge from '@/data/modelWiseSupportKnowledge.json';
import simpleSupportKnowledge from '@/data/simpleSupportKnowledge.json';
import { findSimpleKnowledgeMatch } from '@/lib/simpleKnowledgeImport';
import type {
  ModelWiseSupportKnowledgeItem,
  SimpleSupportKnowledgeItem,
} from '@/types/support';
import { normalizeText } from '@/utils/text';

const defaultKnowledge = modelWiseKnowledge as ModelWiseSupportKnowledgeItem[];
const defaultSimpleKnowledge = simpleSupportKnowledge as SimpleSupportKnowledgeItem[];

type ModelWiseMatchInput = {
  category: string;
  issueType: string;
  productModel?: string;
  message?: string;
  importedSimpleKnowledge?: SimpleSupportKnowledgeItem[];
};

function scoreText(haystack: string, needle: string) {
  const text = normalizeText(haystack);
  const term = normalizeText(needle);

  if (!text || !term) return 0;
  if (text === term) return term.length + 20;
  if (text.includes(term)) return term.length + 8;

  return term
    .split(' ')
    .filter((word) => word.length > 2 && text.includes(word)).length;
}

function scoreKnowledgeItem(item: ModelWiseSupportKnowledgeItem, input: ModelWiseMatchInput) {
  if (!item.active) return 0;
  if (normalizeText(item.category) !== normalizeText(input.category)) return 0;
  if (normalizeText(item.issueType) !== normalizeText(input.issueType)) return 0;

  const modelText = input.productModel || '';
  const messageText = input.message || '';
  const keywordScore = [
    ...item.problemKeywords,
    ...item.banglaKeywords,
    ...item.banglishKeywords,
    ...item.misspellings,
  ].reduce((total, keyword) => total + scoreText(messageText, keyword), 0);
  const modelScore =
    scoreText(modelText, item.productModel) +
    scoreText(modelText, item.modelFamily) +
    scoreText(modelText, item.brand);

  return modelScore * 3 + keywordScore;
}

export function getDefaultModelWiseKnowledge() {
  return defaultKnowledge;
}

export function getDefaultSimpleSupportKnowledge() {
  return defaultSimpleKnowledge;
}

export function findModelWiseSolution(input: ModelWiseMatchInput) {
  // Future Supabase import can be merged into this array before defaultSimpleKnowledge.
  // The final customer solution should still come from manual support knowledge.
  const simpleKnowledge = [
    ...(input.importedSimpleKnowledge || []),
    ...defaultSimpleKnowledge,
  ];
  const simpleMatch = findSimpleKnowledgeMatch({
    category: input.category,
    problem: input.issueType,
    productModel: input.productModel,
    message: input.message,
    knowledge: simpleKnowledge,
  });

  if (simpleMatch) {
    return {
      category: simpleMatch.item.category,
      brand: simpleMatch.item.brand,
      productModel: simpleMatch.item.model,
      modelFamily: simpleMatch.item.modelFamily,
      deviceType: '',
      issueType: simpleMatch.item.problem,
      problemKeywords: simpleMatch.item.symptoms,
      banglaKeywords: [],
      banglishKeywords: [],
      misspellings: [],
      customerSymptomExample: '',
      diagnosticQuestions: [],
      solutionSteps: [
        ...simpleMatch.item.solutionSteps,
        ...(simpleMatch.item.nextIfNotSolved ? [simpleMatch.item.nextIfNotSolved] : []),
      ],
      repairImageUrl: simpleMatch.item.imageUrl,
      repairVideoUrl: simpleMatch.item.videoUrl,
      riskAfterSolution: '',
      nextPossibleProblem: simpleMatch.item.nextIfNotSolved,
      nextSolutionSteps: simpleMatch.item.nextIfNotSolved ? [simpleMatch.item.nextIfNotSolved] : [],
      whenToEscalate: '',
      escalationMessage: simpleMatch.item.escalationMessage,
      priority: 'high' as const,
      active: simpleMatch.item.active,
    };
  }

  if (!input.productModel?.trim()) return null;

  let bestItem: ModelWiseSupportKnowledgeItem | null = null;
  let bestScore = 0;

  for (const item of defaultKnowledge) {
    const score = scoreKnowledgeItem(item, input);

    if (score > bestScore) {
      bestItem = item;
      bestScore = score;
    }
  }

  return bestScore > 0 ? bestItem : null;
}

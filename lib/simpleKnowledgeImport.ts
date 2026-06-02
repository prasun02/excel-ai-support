import type { SimpleKnowledgeMatch, SimpleSupportKnowledgeItem } from '@/types/support';
import { normalizeText } from '@/utils/text';

export type SimpleSupportCsvRow = {
  category: string;
  brand: string;
  model: string;
  modelFamily: string;
  problem: string;
  symptoms: string;
  solutionSteps: string;
  nextIfNotSolved: string;
  escalationMessage: string;
  imageUrl: string;
  videoUrl: string;
  active: string;
};

type SimpleMatchInput = {
  category?: string;
  problem?: string;
  productModel?: string;
  message?: string;
  knowledge: SimpleSupportKnowledgeItem[];
};

const requiredHeaders = [
  'category',
  'brand',
  'model',
  'modelFamily',
  'problem',
  'symptoms',
  'solutionSteps',
  'nextIfNotSolved',
  'escalationMessage',
  'imageUrl',
  'videoUrl',
  'active',
];

function splitPipeList(value: string) {
  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && quoted && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

export function parseSimpleSupportCsv(csv: string) {
  const [headerLine, ...rawRows] = csv.trim().split(/\r?\n/);

  if (!headerLine) return [];

  const headers = parseCsvLine(headerLine);
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));

  if (missingHeaders.length > 0) {
    throw new Error(`Missing simple support CSV columns: ${missingHeaders.join(', ')}`);
  }

  return rawRows
    .filter((row) => row.trim())
    .map((row) => {
      const values = parseCsvLine(row);

      return headers.reduce<Record<string, string>>((record, header, index) => {
        record[header] = values[index] || '';
        return record;
      }, {}) as SimpleSupportCsvRow;
    });
}

export function simpleCsvRowToKnowledge(row: SimpleSupportCsvRow): SimpleSupportKnowledgeItem {
  return {
    category: row.category.trim(),
    brand: row.brand.trim(),
    model: row.model.trim(),
    modelFamily: row.modelFamily.trim(),
    problem: row.problem.trim(),
    symptoms: splitPipeList(row.symptoms),
    solutionSteps: splitPipeList(row.solutionSteps),
    nextIfNotSolved: row.nextIfNotSolved.trim(),
    escalationMessage: row.escalationMessage.trim(),
    imageUrl: row.imageUrl.trim(),
    videoUrl: row.videoUrl.trim(),
    active: row.active.trim().toLowerCase() !== 'false',
  };
}

export function simpleCsvToKnowledge(csv: string) {
  return parseSimpleSupportCsv(csv).map(simpleCsvRowToKnowledge);
}

function scoreText(haystack: string, needle: string) {
  const text = normalizeText(haystack);
  const term = normalizeText(needle);

  if (!text || !term) return 0;
  if (text === term) return term.length + 25;
  if (text.includes(term)) return term.length + 10;

  const words = term.split(' ').filter((word) => word.length > 2);
  const matched = words.filter((word) => text.includes(word)).length;

  return matched >= 2 ? matched * 3 : matched;
}

function problemScore(item: SimpleSupportKnowledgeItem, input: SimpleMatchInput) {
  const message = input.message || '';
  const problem = input.problem || '';
  const symptomScore = Math.max(...item.symptoms.map((symptom) => scoreText(message, symptom)), 0);
  const issueScore = Math.max(scoreText(problem, item.problem), scoreText(message, item.problem));

  return symptomScore + issueScore;
}

function modelScore(item: SimpleSupportKnowledgeItem, productModel: string) {
  if (!productModel.trim()) return { level: 'category' as const, score: 0 };

  const exactModelScore = scoreText(productModel, item.model);
  const familyScore = scoreText(productModel, item.modelFamily);

  if (exactModelScore > 0) {
    return { level: 'model' as const, score: exactModelScore + 50 };
  }

  if (familyScore > 0) {
    return { level: 'modelFamily' as const, score: familyScore + 25 };
  }

  return { level: 'category' as const, score: 0 };
}

export function findSimpleKnowledgeMatch(input: SimpleMatchInput): SimpleKnowledgeMatch | null {
  let bestMatch: SimpleKnowledgeMatch | null = null;

  for (const item of input.knowledge) {
    if (!item.active) continue;
    if (input.category && normalizeText(item.category) !== normalizeText(input.category)) continue;

    const issueScore = problemScore(item, input);
    const model = modelScore(item, input.productModel || '');
    const categoryScore = input.category ? 10 : scoreText(input.message || '', item.category);
    const totalScore = issueScore + model.score + categoryScore;

    if (issueScore < 3) continue;

    if (!bestMatch || totalScore > bestMatch.score) {
      bestMatch = {
        item,
        score: totalScore,
        matchLevel: model.level,
      };
    }
  }

  return bestMatch;
}

export function simpleKnowledgeToFlow(item: SimpleSupportKnowledgeItem) {
  return {
    category: item.category,
    issueType: item.problem,
    symptoms: item.symptoms,
    questions: [],
    solutionSteps: item.solutionSteps,
    solvedQuestion: 'Did this solve your problem?',
    escalationMessage: item.escalationMessage,
  };
}

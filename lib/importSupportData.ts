import type { ModelWiseSupportKnowledgeItem, SupportIntentItem } from '@/types/support';

export type SupportCsvRow = {
  category: string;
  intent: string;
  issueType: string;
  englishKeywords: string;
  banglaKeywords: string;
  banglishKeywords: string;
  misspellings: string;
  diagnosticQuestions: string;
  solutionSteps: string;
  followUpQuestion: string;
  escalationMessage: string;
  priority: string;
  active: string;
};

export type ModelWiseSupportCsvRow = {
  category: string;
  brand: string;
  productModel: string;
  modelFamily: string;
  deviceType: string;
  issueType: string;
  problemKeywords: string;
  banglaKeywords: string;
  banglishKeywords: string;
  misspellings: string;
  customerSymptomExample: string;
  diagnosticQuestions: string;
  solutionSteps: string;
  repairImageUrl: string;
  repairVideoUrl: string;
  riskAfterSolution: string;
  nextPossibleProblem: string;
  nextSolutionSteps: string;
  whenToEscalate: string;
  escalationMessage: string;
  priority: string;
  active: string;
};

function splitList(value: string) {
  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function priorityValue(value: string): SupportIntentItem['priority'] {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }

  return 'medium';
}

export function supportCsvRowToIntent(row: SupportCsvRow): SupportIntentItem {
  return {
    category: row.category.trim(),
    intent: row.intent.trim(),
    issueType: row.issueType.trim(),
    englishKeywords: splitList(row.englishKeywords),
    banglaKeywords: splitList(row.banglaKeywords),
    banglishKeywords: splitList(row.banglishKeywords),
    misspellings: splitList(row.misspellings),
    diagnosticQuestions: splitList(row.diagnosticQuestions),
    solutionSteps: splitList(row.solutionSteps),
    followUpQuestion: row.followUpQuestion.trim(),
    escalationMessage: row.escalationMessage.trim(),
    priority: priorityValue(row.priority.trim().toLowerCase()),
    active: row.active.trim().toLowerCase() === 'true',
  };
}

export function modelWiseCsvRowToKnowledge(row: ModelWiseSupportCsvRow): ModelWiseSupportKnowledgeItem {
  return {
    category: row.category.trim(),
    brand: row.brand.trim(),
    productModel: row.productModel.trim(),
    modelFamily: row.modelFamily.trim(),
    deviceType: row.deviceType.trim(),
    issueType: row.issueType.trim(),
    problemKeywords: splitList(row.problemKeywords),
    banglaKeywords: splitList(row.banglaKeywords),
    banglishKeywords: splitList(row.banglishKeywords),
    misspellings: splitList(row.misspellings),
    customerSymptomExample: row.customerSymptomExample.trim(),
    diagnosticQuestions: splitList(row.diagnosticQuestions),
    solutionSteps: splitList(row.solutionSteps),
    repairImageUrl: row.repairImageUrl.trim(),
    repairVideoUrl: row.repairVideoUrl.trim(),
    riskAfterSolution: row.riskAfterSolution.trim(),
    nextPossibleProblem: row.nextPossibleProblem.trim(),
    nextSolutionSteps: splitList(row.nextSolutionSteps),
    whenToEscalate: row.whenToEscalate.trim(),
    escalationMessage: row.escalationMessage.trim(),
    priority: priorityValue(row.priority.trim().toLowerCase()),
    active: row.active.trim().toLowerCase() === 'true',
  };
}

// Beginner-friendly note:
// For production, use a proper CSV parser when importing uploaded Excel/CSV files.
// This helper keeps the data shape clear so a future script can convert CSV rows
// into data/supportIntents.json, data/modelWiseSupportKnowledge.json, or
// Supabase troubleshooting_flows records.

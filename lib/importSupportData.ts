import type { SupportIntentItem } from '@/types/support';

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

// Beginner-friendly note:
// For production, use a proper CSV parser when importing uploaded Excel/CSV files.
// This helper keeps the data shape clear so a future script can convert CSV rows
// into data/supportIntents.json or Supabase troubleshooting_flows records.

type UniversalSupportAnswerLike = {
  type?: string;
  category?: string;
  detectedProblem?: string;
  productName?: string;
  message?: string;
  possibleCauses?: unknown;
  safeChecks?: unknown;
  diagnosticQuestions?: unknown;
  nextStep?: string;
  warning?: string;
  escalationRequired?: boolean;
};

type UniversalSupportResultLike = UniversalSupportAnswerLike & {
  source?: string;
  ok?: boolean;
  data?: UniversalSupportAnswerLike;
};

export function formatUniversalSupportAnswer(aiResult: UniversalSupportResultLike) {
  const answer = aiResult.data && typeof aiResult.data === 'object'
    ? aiResult.data
    : aiResult;
  const possibleCauses = cleanStringArray(answer.possibleCauses);
  const safeChecks = cleanStringArray(answer.safeChecks);
  const diagnosticQuestions = cleanStringArray(answer.diagnosticQuestions);
  const warning = cleanCustomerWarning(answer.warning);

  return [
    answer.category || answer.detectedProblem
      ? `Detected issue:\n${answer.category || 'Support'}${answer.detectedProblem ? ` \u2192 ${answer.detectedProblem}` : ''}`
      : '',
    answer.productName ? `Device:\n${answer.productName}` : '',
    answer.message ? `Summary:\n${answer.message}` : '',
    possibleCauses.length ? `This may happen due to:\n${numberLines(possibleCauses)}` : '',
    safeChecks.length ? `Safe checks you can try first:\n${numberLines(safeChecks)}` : '',
    diagnosticQuestions.length ? `To understand better, please answer:\n${numberLines(diagnosticQuestions)}` : '',
    answer.nextStep ? `Next:\n${answer.nextStep}` : '',
    warning ? `Safety note:\n${warning}` : '',
  ].filter(Boolean).join('\n\n');
}

function cleanStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function numberLines(items: string[]) {
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

function cleanCustomerWarning(warning?: string) {
  const text = typeof warning === 'string' ? warning.trim() : '';

  if (!text) return '';
  if (/^AI fallback mode is active because OpenAI API is currently unavailable\.$/i.test(text)) return '';

  return text;
}

import 'server-only';

import {
  formatUniversalSupportAnswer,
  getUniversalSupportFallback,
  sanitizeUniversalAnswer,
  universalCategoryToTicketCategory,
  type UniversalSupportAnswer,
  type UniversalSupportRequest,
} from '@/lib/universalSupportFallbacks';

type ManualKnowledgeLikeResult = {
  responseText?: string;
  matched?: boolean;
  detectedCategory?: string;
  detectedIssueType?: string;
  needsCategorySelection?: boolean;
  updatedTicketState?: {
    currentFlowId?: string;
    activeSupportFlow?: string;
    solutionGiven?: boolean;
    awaitingLocation?: boolean;
    escalationActive?: boolean;
  };
};

type UniversalRouterInput = {
  requestUrl?: string;
  payload: UniversalSupportRequest;
  manualKnowledgeResult?: ManualKnowledgeLikeResult | null;
  hasActiveFlow?: boolean;
  detectedIntent?: string;
};

type UniversalRouterResult = {
  answer: UniversalSupportAnswer;
  source: 'api' | 'fallback';
};

const manualAnswerPatterns = [
  /Excel-approved/i,
  /approved procedure/i,
  /I found an Excel-approved/i,
  /Please share your router model/i,
  /Warranty details may need to be checked/i,
];

const noUniversalIntentPatterns = [
  /human support/i,
  /talk to person/i,
  /engineer/i,
  /nearest csp/i,
  /\bcsp\b/i,
  /not solved/i,
  /still problem/i,
  /same problem/i,
  /kaj hoy nai/i,
  /ekhono problem/i,
];

function envFlagEnabled(value: string | undefined) {
  return String(value || '').toLowerCase() === 'true';
}

export function isUniversalSupportEnabled() {
  return envFlagEnabled(process.env.ENABLE_UNIVERSAL_AI_SUPPORT);
}

function isLegacyDiagnosticQuestion(result?: ManualKnowledgeLikeResult | null) {
  const flowId = result?.updatedTicketState?.currentFlowId || '';
  const text = result?.responseText || '';

  return Boolean(
    flowId.includes('::') &&
      /You may be asking about|To understand better, please answer/i.test(text)
  );
}

export function manualKnowledgeHasApprovedAnswer(result?: ManualKnowledgeLikeResult | null) {
  if (!result?.matched || !result.responseText) return false;
  if (manualAnswerPatterns.some((pattern) => pattern.test(result.responseText || ''))) return true;

  const flowId = result.updatedTicketState?.currentFlowId || '';
  const hasNonLegacyFlowId = Boolean(flowId && !flowId.includes('::') && flowId !== 'UNIVERSAL_AI_SUPPORT');

  return hasNonLegacyFlowId && !isLegacyDiagnosticQuestion(result);
}

function userAskedForEscalationOrFollowUp(message: string) {
  return noUniversalIntentPatterns.some((pattern) => pattern.test(message));
}

export function shouldUseUniversalSupport(input: UniversalRouterInput) {
  if (!isUniversalSupportEnabled()) return false;
  if (input.detectedIntent === 'non_support') return false;
  if (input.detectedIntent === 'purchase_query') return false;
  if (userAskedForEscalationOrFollowUp(input.payload.message)) return false;
  if (manualKnowledgeHasApprovedAnswer(input.manualKnowledgeResult)) return false;
  if (input.manualKnowledgeResult?.needsCategorySelection) return false;
  if (!input.manualKnowledgeResult?.matched) return true;

  return !input.hasActiveFlow && isLegacyDiagnosticQuestion(input.manualKnowledgeResult);
}

export async function getUniversalSupportResponse(input: UniversalRouterInput): Promise<UniversalRouterResult | null> {
  if (!shouldUseUniversalSupport(input)) return null;

  const fallback = getUniversalSupportFallback(input.payload);

  if (!input.requestUrl) {
    return { answer: fallback, source: 'fallback' };
  }

  try {
    const apiUrl = new URL('/api/universal-ai-support', input.requestUrl);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.payload),
      cache: 'no-store',
    });

    if (!response.ok) {
      return { answer: fallback, source: 'fallback' };
    }

    const data = await response.json();

    return { answer: sanitizeUniversalAnswer(data, input.payload), source: 'api' };
  } catch {
    return { answer: fallback, source: 'fallback' };
  }
}

export function universalAnswerToTicketCategory(answer: UniversalSupportAnswer, fallbackCategory = '') {
  return universalCategoryToTicketCategory(answer.category) || fallbackCategory;
}

export function universalAnswerToChatContent(answer: UniversalSupportAnswer) {
  return formatUniversalSupportAnswer(answer);
}

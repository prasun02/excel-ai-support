import 'server-only';

import { applyCategoryContextUpdate } from '@/lib/supportContextManager';
import {
  detectUniversalCategoryContext,
  type UniversalCategoryContext,
} from '@/lib/universalCategoryDetector';
import { findBestProductMatches, type ProductMatchResult } from '@/lib/productModelMatcher';
import { parseProductInfo, type ProductInfoResult } from '@/lib/productInfoParser';
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
  source: 'openai' | 'fallback';
};

type UniversalRoutingPreparationInput = {
  message: string;
  categoryHint?: string;
  currentState?: Record<string, unknown>;
};

type UniversalRoutingPreparation = {
  detectedContext: UniversalCategoryContext;
  updatedState: Record<string, unknown>;
  resetApplied: boolean;
  resetReason?: string;
  productMatches: ProductMatchResult;
  productInfo: ProductInfoResult;
  effectiveCategory: string;
};

const approvedManualAnswerPatterns = [
  /Here are the Excel-approved safe troubleshooting steps/i,
  /Here is the approved procedure/i,
  /approved procedure/i,
];

const genericManualQuestionPatterns = [
  /Please share your router model/i,
  /Warranty details may need to be checked/i,
  /You may be asking about/i,
  /To understand better, please answer/i,
  /Do you want step-by-step guidance/i,
  /I can guide you with safe checks first/i,
  /I do not have an Excel-approved exact solution/i,
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

function logUniversalSupportDev(message: string, value?: string | boolean) {
  if (process.env.NODE_ENV !== 'development') return;

  console.log(value === undefined ? message : `${message}: ${value}`);
}

export function isUniversalSupportEnabled() {
  return envFlagEnabled(process.env.ENABLE_UNIVERSAL_AI_SUPPORT);
}

function normalizeModel(model: string) {
  return model.replace(/\b(?:ver|version|v)\s*\.?\s*\d+(?:\.\d+)?\b/i, '').trim();
}

function categoryForMatching(context: UniversalCategoryContext, categoryHint?: string) {
  if (context.detectedCategory === 'Non Support') return categoryHint || '';
  if (context.confidence >= 0.6) return context.detectedCategory;

  return categoryHint || context.detectedCategory;
}

function stateText(state: Record<string, unknown>, key: string) {
  const value = state[key];

  return typeof value === 'string' ? value : '';
}

function mergeDetectedProductContext(
  detectedContext: UniversalCategoryContext,
  productMatches: ProductMatchResult,
  productInfo: ProductInfoResult
): UniversalCategoryContext {
  const bestProduct = productMatches.bestMatch;
  const confidentProduct = bestProduct && ['high', 'medium'].includes(productMatches.confidence);
  const detectedModel = normalizeModel(
    productInfo.model ||
      (confidentProduct ? bestProduct?.model || bestProduct?.itemCode || '' : '') ||
      detectedContext.detectedModel ||
      ''
  );
  const detectedProductName =
    (confidentProduct ? bestProduct?.itemName : '') ||
    detectedContext.detectedProductName ||
    (detectedModel ? detectedModel : undefined);

  return {
    ...detectedContext,
    detectedBrand: (confidentProduct ? bestProduct?.brand : '') || detectedContext.detectedBrand,
    detectedModel: detectedModel || undefined,
    detectedProductName,
  };
}

export function prepareUniversalSupportRouting(input: UniversalRoutingPreparationInput): UniversalRoutingPreparation {
  const currentState = input.currentState || {};
  const initialDetectedContext = detectUniversalCategoryContext({
    message: input.message,
    previousCategory:
      stateText(currentState, 'currentCategory') ||
      stateText(currentState, 'selectedCategory') ||
      stateText(currentState, 'category') ||
      input.categoryHint,
    previousProductName: stateText(currentState, 'currentProductName'),
    previousModel: stateText(currentState, 'currentModel') || stateText(currentState, 'productModel'),
    previousProblemName: stateText(currentState, 'currentProblemName') || stateText(currentState, 'issueType'),
  });
  const productMatches = findBestProductMatches({
    text: input.message,
    categoryHint: categoryForMatching(initialDetectedContext, input.categoryHint),
    maxResults: 3,
  });
  const productInfo = parseProductInfo(input.message);
  const detectedContext = mergeDetectedProductContext(initialDetectedContext, productMatches, productInfo);
  const contextUpdate = applyCategoryContextUpdate({
    message: input.message,
    currentState,
    detectedContext,
  });
  const effectiveCategory =
    detectedContext.detectedCategory === 'Non Support'
      ? input.categoryHint || stateText(currentState, 'selectedCategory') || stateText(currentState, 'category') || ''
      : stateText(contextUpdate.updatedState, 'selectedCategory') ||
        stateText(contextUpdate.updatedState, 'category') ||
        detectedContext.detectedCategory;

  return {
    detectedContext,
    updatedState: contextUpdate.updatedState,
    resetApplied: contextUpdate.resetApplied,
    resetReason: contextUpdate.resetReason,
    productMatches,
    productInfo,
    effectiveCategory,
  };
}

function isLegacyDiagnosticQuestion(result?: ManualKnowledgeLikeResult | null) {
  const flowId = result?.updatedTicketState?.currentFlowId || '';
  const text = result?.responseText || '';

  return Boolean(
    flowId.includes('::') &&
      /You may be asking about|To understand better, please answer/i.test(text)
  );
}

function isGenericManualQuestion(result?: ManualKnowledgeLikeResult | null) {
  if (!result?.responseText) return false;

  return genericManualQuestionPatterns.some((pattern) => pattern.test(result.responseText || '')) ||
    isLegacyDiagnosticQuestion(result);
}

export function manualKnowledgeHasApprovedAnswer(result?: ManualKnowledgeLikeResult | null) {
  if (!result?.matched || !result.responseText) return false;
  if (isGenericManualQuestion(result)) return false;

  const flowId = result.updatedTicketState?.currentFlowId || '';
  const hasExactManualFlowId = Boolean(
    flowId &&
      !flowId.includes('::') &&
      flowId !== 'UNIVERSAL_AI_SUPPORT'
  );
  const solutionGiven = Boolean(result.updatedTicketState?.solutionGiven);

  return solutionGiven && (
    approvedManualAnswerPatterns.some((pattern) => pattern.test(result.responseText || '')) ||
      hasExactManualFlowId
  );
}

function userAskedForEscalationOrFollowUp(message: string) {
  return noUniversalIntentPatterns.some((pattern) => pattern.test(message));
}

export function shouldUseUniversalSupport(input: UniversalRouterInput) {
  const universalEnabled = isUniversalSupportEnabled();

  logUniversalSupportDev('UNIVERSAL_AI_ENABLED', universalEnabled);

  if (!universalEnabled) return false;
  if (input.detectedIntent === 'non_support') return false;
  if (input.detectedIntent === 'location_reply') return false;
  if (userAskedForEscalationOrFollowUp(input.payload.message)) return false;
  if (manualKnowledgeHasApprovedAnswer(input.manualKnowledgeResult)) return false;
  if (input.manualKnowledgeResult?.needsCategorySelection) return false;

  return true;
}

export async function getUniversalSupportResponse(input: UniversalRouterInput): Promise<UniversalRouterResult | null> {
  if (!shouldUseUniversalSupport(input)) return null;

  const fallback = getUniversalSupportFallback(input.payload);

  logUniversalSupportDev('CALLING_UNIVERSAL_AI');

  if (!input.requestUrl) {
    logUniversalSupportDev('UNIVERSAL_AI_RESULT_SOURCE', 'fallback');

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
      logUniversalSupportDev('UNIVERSAL_AI_RESULT_SOURCE', 'fallback');

      return { answer: fallback, source: 'fallback' };
    }

    const data = await response.json();
    const source = response.headers.get('X-Universal-AI-Source') === 'openai'
      ? 'openai'
      : 'fallback';

    logUniversalSupportDev('UNIVERSAL_AI_RESULT_SOURCE', source);

    return { answer: sanitizeUniversalAnswer(data, input.payload), source };
  } catch {
    logUniversalSupportDev('UNIVERSAL_AI_RESULT_SOURCE', 'fallback');

    return { answer: fallback, source: 'fallback' };
  }
}

export function universalAnswerToTicketCategory(answer: UniversalSupportAnswer, fallbackCategory = '') {
  return universalCategoryToTicketCategory(answer.category) || fallbackCategory;
}

export function universalAnswerToChatContent(answer: UniversalSupportAnswer) {
  return formatUniversalSupportAnswer(answer);
}

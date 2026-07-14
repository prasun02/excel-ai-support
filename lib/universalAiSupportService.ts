import 'server-only';

import {
  buildAiResponseCacheKey,
  getCachedAiResponse,
  setCachedAiResponse,
} from '@/lib/aiResponseCache';
import {
  getUniversalSupportFallback,
  sanitizeUniversalAnswer,
  type UniversalSupportAnswer,
  type UniversalSupportRequest,
} from '@/lib/universalSupportFallbacks';

export type UniversalAiResultSource = 'openai' | 'fallback' | 'cache';

export type UniversalAiSupportResult = {
  answer: UniversalSupportAnswer;
  source: UniversalAiResultSource;
  errorReason?: string;
  fallbackNote?: string;
};

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const FALLBACK_DISPLAY_NOTE = 'AI fallback mode is active because OpenAI API is currently unavailable.';
const MAX_AI_PAYLOAD_BYTES = 2200;

type CompactOpenAIPayload = {
  latestMessage: string;
  category: string;
  detectedProblem: string;
  productName?: string;
  model?: string;
  hardwareVersion?: string;
  language?: string;
  previousContext?: {
    currentCategory?: string;
    currentProblemName?: string;
    currentProductName?: string;
    currentModel?: string;
    currentHardwareVersion?: string;
    activeSupportFlow?: string;
  };
};

const SYSTEM_INSTRUCTION = `You are Excel Service AI, a professional customer support assistant for Excel Technologies Ltd.
You answer product service-related questions.
You may provide possible causes, safe checks, and diagnostic questions.
Do not claim confirmed diagnosis.
Do not approve warranty, replacement, or RMA.
Do not provide dangerous repair instructions.
If the issue is risky or exact model-specific, ask for model, hardware version, SN/sticker photo, or recommend Excel CSP.
Respond in the customer language when possible.
Return only valid JSON with keys:
type, language, category, detectedProblem, productName, message, possibleCauses, safeChecks, diagnosticQuestions, nextStep, warning, escalationRequired.`;

export function sanitizeUniversalSupportInput(body: unknown): UniversalSupportRequest {
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const previousContext = record.previousContext && typeof record.previousContext === 'object'
    ? record.previousContext as Record<string, unknown>
    : {};

  return {
    message: cleanText(record.message),
    category: cleanText(record.category, 120),
    productName: cleanText(record.productName, 180),
    model: cleanText(record.model, 120),
    detectedProduct: cleanText(record.detectedProduct, 180) || cleanText(record.productName, 180),
    detectedModel: cleanText(record.detectedModel, 120) || cleanText(record.model, 120),
    detectedProblem: cleanText(record.detectedProblem, 120),
    hardwareVersion: cleanText(record.hardwareVersion, 80),
    language: cleanText(record.language, 40),
    previousContext: {
      currentCategory: cleanText(previousContext.currentCategory, 120),
      currentProblemName: cleanText(previousContext.currentProblemName, 120),
      currentProductName: cleanText(previousContext.currentProductName, 180),
      currentModel: cleanText(previousContext.currentModel, 120),
      currentHardwareVersion: cleanText(previousContext.currentHardwareVersion, 80),
      activeSupportFlow: cleanText(previousContext.activeSupportFlow, 120),
    },
  };
}

export async function getUniversalAiSupportAnswer(input: UniversalSupportRequest): Promise<UniversalAiSupportResult> {
  const fallback = getUniversalSupportFallback(input);

  if (
    input.message &&
    process.env.ENABLE_UNIVERSAL_AI_SUPPORT === 'true' &&
    process.env.AI_PROVIDER === 'openai' &&
    process.env.OPENAI_API_KEY?.trim()
  ) {
    const aiPayload = buildCompactOpenAIPayload(input);
    const cacheKey = buildAiResponseCacheKey({
      category: aiPayload.category,
      detectedProblem: aiPayload.detectedProblem,
      productName: aiPayload.productName || aiPayload.model || '',
      message: aiPayload.latestMessage,
    });
    const cachedAnswer = getCachedAiResponse(cacheKey);

    if (cachedAnswer) {
      logAiDev('AI_SOURCE', 'cache');

      return {
        answer: { ...cachedAnswer, source: 'cache' },
        source: 'cache',
      };
    }

    try {
      const answer = await callOpenAI(aiPayload);
      const sanitized = sanitizeUniversalAnswer(answer, input);
      const openAiAnswer = { ...sanitized, source: 'openai' as const };

      setCachedAiResponse(cacheKey, openAiAnswer);
      logAiDev('AI_SOURCE', 'openai');

      return {
        answer: openAiAnswer,
        source: 'openai',
      };
    } catch (error) {
      logAiDev('AI_SOURCE', 'fallback');

      return fallbackResult(fallback, safeErrorReason(error));
    }
  }

  logAiDev('AI_SOURCE', 'fallback');

  return fallbackResult(fallback, 'OpenAI is not enabled or configured.');
}

function cleanText(value: unknown, maxLength = 1600) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

async function callOpenAI(payload: CompactOpenAIPayload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const maxOutputTokens = Number(process.env.AI_MAX_OUTPUT_TOKENS || 450);
  const temperature = Number(process.env.AI_TEMPERATURE || 0.3);
  const payloadText = JSON.stringify(payload);

  logAiDev('AI_PAYLOAD_SIZE', String(payloadText.length));
  logAiDev('AI_MODEL', model);
  logAiDev('AI_MAX_OUTPUT_TOKENS', String(maxOutputTokens));

  try {
    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxOutputTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          {
            role: 'user',
            content: JSON.stringify({
              instruction: 'Classify and answer this Excel product service request using only safe general support guidance.',
              input: payload,
            }),
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await readOpenAIErrorBody(response);

      logOpenAIErrorBody(errorBody);
      throw new OpenAIRequestError(response.status, getOpenAIErrorReason(response.status, errorBody));
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content !== 'string') {
      throw new Error('OpenAI returned no content.');
    }

    return JSON.parse(content);
  } finally {
    clearTimeout(timeout);
  }
}

function fallbackResult(answer: UniversalSupportAnswer, errorReason: string): UniversalAiSupportResult {
  return {
    answer: {
      ...answer,
      source: 'fallback',
      warning: FALLBACK_DISPLAY_NOTE,
    },
    source: 'fallback',
    errorReason,
    fallbackNote: FALLBACK_DISPLAY_NOTE,
  };
}

function buildCompactOpenAIPayload(input: UniversalSupportRequest): CompactOpenAIPayload {
  const payload: CompactOpenAIPayload = {
    latestMessage: cleanText(input.message, 800),
    category: cleanText(input.category, 120),
    detectedProblem: cleanText(input.detectedProblem, 120),
    productName: cleanText(input.productName || input.detectedProduct, 180),
    model: cleanText(input.model || input.detectedModel, 120),
    hardwareVersion: cleanText(input.hardwareVersion, 80),
    language: cleanText(input.language, 40),
    previousContext: trimPreviousContext(input.previousContext, 120),
  };

  if (!hasPreviousContext(payload.previousContext)) {
    delete payload.previousContext;
  }

  if (getPayloadSize(payload) > MAX_AI_PAYLOAD_BYTES) {
    payload.previousContext = trimPreviousContext(payload.previousContext, 60);
  }

  if (payload.previousContext && getPayloadSize(payload) > MAX_AI_PAYLOAD_BYTES) {
    delete payload.previousContext;
  }

  return removeEmptyFields(payload);
}

function trimPreviousContext(
  previousContext: UniversalSupportRequest['previousContext'],
  maxLength: number
) {
  if (!previousContext) return undefined;

  return {
    currentCategory: cleanText(previousContext.currentCategory, maxLength),
    currentProblemName: cleanText(previousContext.currentProblemName, maxLength),
    currentProductName: cleanText(previousContext.currentProductName, maxLength),
    currentModel: cleanText(previousContext.currentModel, maxLength),
    currentHardwareVersion: cleanText(previousContext.currentHardwareVersion, maxLength),
    activeSupportFlow: cleanText(previousContext.activeSupportFlow, maxLength),
  };
}

function hasPreviousContext(previousContext: CompactOpenAIPayload['previousContext']) {
  return Boolean(previousContext && Object.values(previousContext).some(Boolean));
}

function removeEmptyFields(payload: CompactOpenAIPayload): CompactOpenAIPayload {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === undefined || value === '') return false;
      if (typeof value === 'object' && !Array.isArray(value)) {
        return Object.values(value).some(Boolean);
      }

      return true;
    })
  ) as CompactOpenAIPayload;
}

function getPayloadSize(payload: CompactOpenAIPayload) {
  return JSON.stringify(payload).length;
}

class OpenAIRequestError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'OpenAIRequestError';
  }
}

async function readOpenAIErrorBody(response: Response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function logOpenAIErrorBody(errorBody: string) {
  if (process.env.NODE_ENV !== 'development') return;

  console.log('OpenAI error body:', errorBody);
}

function logAiDev(label: string, value: string) {
  if (process.env.NODE_ENV !== 'development') return;

  console.log(`${label}: ${value}`);
}

function getOpenAIErrorReason(status: number, errorBody: string) {
  const message = extractOpenAIErrorMessage(errorBody);

  if (status === 429 || /rate limit|quota|billing/i.test(message)) {
    return 'OpenAI API rate limit, quota, or billing limit reached. Please check OpenAI billing/usage limits.';
  }

  return message
    ? `OpenAI request failed with status ${status}: ${message}`
    : `OpenAI request failed with status ${status}.`;
}

function extractOpenAIErrorMessage(errorBody: string) {
  try {
    const parsed = JSON.parse(errorBody) as {
      error?: {
        message?: unknown;
      };
    };
    const message = parsed.error?.message;

    return typeof message === 'string' ? message : '';
  } catch {
    return errorBody.trim().slice(0, 300);
  }
}

function safeErrorReason(error: unknown) {
  if (error instanceof OpenAIRequestError) return error.message;
  if (error instanceof SyntaxError) return 'OpenAI returned invalid JSON.';
  if (error instanceof Error && error.name === 'AbortError') return 'OpenAI request timed out.';
  if (error instanceof Error && error.message === 'OpenAI returned no content.') return error.message;

  return 'OpenAI network error or request failed.';
}

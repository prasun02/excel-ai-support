import {
  getUniversalSupportFallback,
  sanitizeUniversalAnswer,
  type UniversalSupportRequest,
} from '@/lib/universalSupportFallbacks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

const SYSTEM_INSTRUCTION = `You are Excel Service AI, a professional support assistant for Excel Technologies Ltd.
You help customers with Excel product service-related issues.
You may provide possible causes, safe basic checks, and diagnostic questions.
You must not invent final exact technical repair solutions.
You must not claim warranty approval, replacement approval, or confirmed diagnosis.
You must not provide exact firmware file, risky reset/configuration/repair steps, or internal hardware repair steps unless manual Excel-approved knowledge is provided.
If the customer asks about firmware, reset, repair, warranty, RMA, replacement, board burn, internal damage, or exact model-specific procedure, ask for exact model, hardware version, SN/sticker photo if needed, and recommend Excel CSP if unsure.
Router support is free online/CSP, but replacement/warranty may still need verification.
For non-router products, warranty/replacement/RMA may require SN/invoice/warranty portal/CSP verification.
Respond in the customer's language when possible.
Return only valid JSON with keys:
type, language, category, detectedProblem, message, possibleCauses, safeChecks, diagnosticQuestions, nextStep, warning, escalationRequired.`;

export async function POST(req: Request) {
  const input = sanitizeInput(await readBody(req));
  const fallback = getUniversalSupportFallback(input);

  if (!input.message) {
    return Response.json(fallback, { status: 400 });
  }

  if (process.env.AI_PROVIDER === 'openai' && process.env.OPENAI_API_KEY?.trim()) {
    try {
      const answer = await callOpenAI(input);

      return Response.json(sanitizeUniversalAnswer(answer, input));
    } catch {
      return Response.json(fallback);
    }
  }

  return Response.json(fallback);
}

async function readBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function cleanText(value: unknown, maxLength = 1600) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function sanitizeInput(body: unknown): UniversalSupportRequest {
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const previousContext = record.previousContext && typeof record.previousContext === 'object'
    ? record.previousContext as Record<string, unknown>
    : {};

  return {
    message: cleanText(record.message),
    category: cleanText(record.category, 120),
    detectedProduct: cleanText(record.detectedProduct, 180),
    detectedModel: cleanText(record.detectedModel, 120),
    hardwareVersion: cleanText(record.hardwareVersion, 80),
    language: cleanText(record.language, 40),
    previousContext: {
      currentCategory: cleanText(previousContext.currentCategory, 120),
      currentProblemName: cleanText(previousContext.currentProblemName, 120),
      currentModel: cleanText(previousContext.currentModel, 120),
      currentHardwareVersion: cleanText(previousContext.currentHardwareVersion, 80),
      activeSupportFlow: cleanText(previousContext.activeSupportFlow, 120),
    },
  };
}

async function callOpenAI(input: UniversalSupportRequest) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          {
            role: 'user',
            content: JSON.stringify({
              instruction: 'Classify and answer this Excel product service request using only safe general support guidance.',
              input,
            }),
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status}`);
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

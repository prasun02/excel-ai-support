export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const FALLBACK_DISPLAY_NOTE = 'AI fallback mode is active because OpenAI API is currently unavailable.';

type EnvCheck = {
  universalEnabled: string | undefined;
  aiProvider: string | undefined;
  model: string | undefined;
  hasOpenAIKey: boolean;
};

type FallbackData = {
  type: 'universal_support_answer';
  category: 'UPS / Inverter';
  detectedProblem: 'Backup Low';
  productName: 'Marsriva 2KW Inverter';
  message: string;
  possibleCauses: string[];
  safeChecks: string[];
  diagnosticQuestions: string[];
  nextStep: string;
  warning: string;
  escalationRequired: false;
};

const fallbackData: FallbackData = {
  type: 'universal_support_answer',
  category: 'UPS / Inverter',
  detectedProblem: 'Backup Low',
  productName: 'Marsriva 2KW Inverter',
  message: 'This issue may happen due to battery aging, overload, charging issue, or inverter fault.',
  possibleCauses: [
    'Battery aging or weak battery',
    'Connected load is higher than rated capacity',
    'Charging issue or unstable input power',
    'Battery capacity mismatch or inverter fault',
  ],
  safeChecks: [
    'Fully charge before testing backup',
    'Reduce connected load',
    'Test with one low-power device',
    'Check battery age and capacity if known',
    'Check charging indicator and input voltage',
  ],
  diagnosticQuestions: [
    'What is the exact model?',
    'How old is the battery?',
    'What devices are connected?',
    'How long is backup after full charge?',
  ],
  nextStep: 'Please share model, battery age, connected load, and backup time after full charge.',
  warning: 'Do not open UPS/Inverter or touch internal battery wiring unless you are a qualified technician.',
  escalationRequired: false,
};

export async function GET() {
  const envCheck = getEnvCheck();

  if (
    process.env.ENABLE_UNIVERSAL_AI_SUPPORT !== 'true' ||
    process.env.AI_PROVIDER !== 'openai' ||
    !process.env.OPENAI_API_KEY?.trim()
  ) {
    logAiDev('AI_SOURCE', 'fallback');

    return fallbackResponse('OpenAI is not enabled or configured.', envCheck);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const maxOutputTokens = Number(process.env.AI_MAX_OUTPUT_TOKENS || 450);
  const temperature = Number(process.env.AI_TEMPERATURE || 0.3);
  const requestBody = {
    model,
    messages: [
      {
        role: 'system',
        content: 'You are Excel Service AI, a professional customer support assistant for Excel Technologies Ltd. Return only valid JSON. Do not use markdown.',
      },
      {
        role: 'user',
        content: 'Return JSON for this support issue: my inverter backup is low. Category: UPS / Inverter. Product: Marsriva 2KW Inverter. Include source, type, category, detectedProblem, message, possibleCauses, safeChecks, diagnosticQuestions, nextStep, warning, escalationRequired.',
      },
    ],
    temperature,
    max_tokens: maxOutputTokens,
  };

  logAiDev('AI_PAYLOAD_SIZE', String(JSON.stringify(requestBody).length));
  logAiDev('AI_MODEL', model);
  logAiDev('AI_MAX_OUTPUT_TOKENS', String(maxOutputTokens));

  try {
    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await readOpenAIErrorBody(response);

      logOpenAIErrorBody(errorBody);
      logAiDev('AI_SOURCE', 'fallback');
      return fallbackResponse(getOpenAIErrorReason(response.status, errorBody), envCheck);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      logAiDev('AI_SOURCE', 'fallback');
      return fallbackResponse('OpenAI returned no message content.', envCheck);
    }

    const parsedJson = parseOpenAIJson(content);

    if (!parsedJson) {
      logAiDev('AI_SOURCE', 'fallback');
      return fallbackResponse('OpenAI returned invalid JSON.', envCheck);
    }

    logAiDev('AI_SOURCE', 'openai');

    return Response.json({
      source: 'openai',
      ok: true,
      data: parsedJson,
      envCheck,
    });
  } catch {
    logAiDev('AI_SOURCE', 'fallback');

    return fallbackResponse('OpenAI call failed.', envCheck);
  } finally {
    clearTimeout(timeout);
  }
}

function getEnvCheck(): EnvCheck {
  return {
    universalEnabled: process.env.ENABLE_UNIVERSAL_AI_SUPPORT,
    aiProvider: process.env.AI_PROVIDER,
    model: process.env.OPENAI_MODEL,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
  };
}

function fallbackResponse(errorReason: string, envCheck: EnvCheck) {
  return Response.json({
    source: 'fallback',
    ok: false,
    errorReason,
    fallbackNote: FALLBACK_DISPLAY_NOTE,
    data: {
      ...fallbackData,
      warning: FALLBACK_DISPLAY_NOTE,
    },
    envCheck,
  });
}

function parseOpenAIJson(content: string) {
  try {
    return JSON.parse(content.replace(/```json|```/g, '').trim());
  } catch {
    return null;
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

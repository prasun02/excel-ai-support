import {
  getUniversalAiSupportAnswer,
  sanitizeUniversalSupportInput,
} from '@/lib/universalAiSupportService';
import type { UniversalSupportAnswer } from '@/lib/universalSupportFallbacks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const input = sanitizeUniversalSupportInput(await readBody(req));
  const result = await getUniversalAiSupportAnswer(input);
  const responseInit = {
    headers: { 'X-Universal-AI-Source': result.source },
  };

  if (!input.message) {
    return Response.json(toApiResponse(result), {
      status: 400,
      ...responseInit,
    });
  }

  return Response.json(toApiResponse(result), responseInit);
}

function toApiResponse(result: {
  answer: UniversalSupportAnswer;
  source: 'openai' | 'fallback' | 'cache';
  errorReason?: string;
  fallbackNote?: string;
}) {
  const answer = result.answer;
  const ok = result.source === 'openai' || result.source === 'cache';

  return {
    source: result.source,
    ok,
    data: {
      type: answer.type,
      category: answer.category,
      detectedProblem: answer.detectedProblem,
      productName: answer.productName || '',
      message: answer.message,
      possibleCauses: answer.possibleCauses,
      safeChecks: answer.safeChecks,
      diagnosticQuestions: answer.diagnosticQuestions,
      nextStep: answer.nextStep,
      warning: answer.warning || '',
      escalationRequired: Boolean(answer.escalationRequired),
    },
    ...(process.env.NODE_ENV === 'development'
      ? {
          envCheck: {
            universalEnabled: process.env.ENABLE_UNIVERSAL_AI_SUPPORT,
            aiProvider: process.env.AI_PROVIDER,
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
          },
        }
      : {}),
    ...(result.source === 'fallback'
      ? {
          errorReason: result.errorReason || 'OpenAI is currently unavailable.',
          fallbackNote: result.fallbackNote || 'AI fallback mode is active because OpenAI API is currently unavailable.',
        }
      : {}),
  };
}

async function readBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

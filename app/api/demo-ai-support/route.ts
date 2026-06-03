import { getRuleBasedDemoAnswer } from '@/lib/demoSupportFallbacks';
import type { SupportCategory } from '@/lib/aiSupportTypes';

type DemoAiBody = {
  message: string;
  category?: SupportCategory;
  problemName?: string;
  language?: string;
  riskLevel?: string;
  model?: string;
  hardwareVersion?: string;
};

const systemInstruction = `You are Excel Service AI demo support assistant.
You help classify and explain product support issues for Excel Technologies Ltd.
Manual approved support knowledge is the final source of truth.
You may provide possible causes and safe basic checks for demo support.
You must not claim warranty approval, replacement approval, or confirmed diagnosis.
You must not provide risky model-specific firmware, reset, BIOS, flash, repair, or configuration steps unless provided in manual knowledge.
If unsure, ask a clarifying question or recommend CSP/human support.
Respond in the customer's language if possible.
Return only valid JSON with: message, possibleCauses, safeSteps, nextQuestion, warning.`;

function parseJson(text: string) {
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim()) as {
      message?: string;
      possibleCauses?: string[];
      safeSteps?: string[];
      nextQuestion?: string;
      warning?: string;
    };
  } catch {
    return null;
  }
}

async function getOpenAiDemoAnswer(body: DemoAiBody, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: JSON.stringify(body) },
      ],
    }),
  });

  if (!response.ok) return null;

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return parseJson(data.choices?.[0]?.message?.content || '');
}

async function getGeminiDemoAnswer(body: DemoAiBody, apiKey: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemInstruction}\n\n${JSON.stringify(body)}` }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) return null;

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  return parseJson(data.candidates?.[0]?.content?.parts?.[0]?.text || '');
}

export async function POST(req: Request) {
  const body = (await req.json()) as DemoAiBody;
  const category = body.category || 'Other Product';
  const fallback = getRuleBasedDemoAnswer(category, body.problemName, body.message, body.language);
  let aiAnswer: ReturnType<typeof parseJson> = null;

  if (process.env.AI_PROVIDER === 'openai' && process.env.OPENAI_API_KEY) {
    aiAnswer = await getOpenAiDemoAnswer(body, process.env.OPENAI_API_KEY);
  } else if (process.env.AI_PROVIDER === 'gemini' && process.env.GEMINI_API_KEY) {
    aiAnswer = await getGeminiDemoAnswer(body, process.env.GEMINI_API_KEY);
  }

  return Response.json({
    message: aiAnswer?.message || fallback.message,
    possibleCauses: aiAnswer?.possibleCauses?.length ? aiAnswer.possibleCauses : fallback.possibleCauses,
    safeSteps: aiAnswer?.safeSteps?.length ? aiAnswer.safeSteps : fallback.safeSteps,
    nextQuestion: aiAnswer?.nextQuestion || fallback.nextQuestion,
    warning: aiAnswer?.warning || fallback.warning,
  });
}

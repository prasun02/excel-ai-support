import type { AiIntentMatch } from '@/types/support';

type AiIntentInput = {
  message: string;
  selectedCategory?: string;
  productModel?: string;
};

const systemInstruction = `
You classify Excel Technologies product support messages.
Return only JSON with category, problem, confidence, and matchedKeywords.
AI is used for intent matching only. Manual knowledge base is the source of truth for solutions.
Do not write troubleshooting steps or invent any solution.
`;

function parseJsonMatch(text: string): AiIntentMatch | null {
  try {
    const cleanText = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanText) as Partial<AiIntentMatch>;

    if (!parsed.category || !parsed.problem) return null;

    return {
      category: String(parsed.category),
      problem: String(parsed.problem),
      confidence: Number(parsed.confidence || 0),
      matchedKeywords: Array.isArray(parsed.matchedKeywords)
        ? parsed.matchedKeywords.map(String)
        : [],
    };
  } catch {
    return null;
  }
}

async function matchWithOpenAi(input: AiIntentInput, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        { role: 'system', content: systemInstruction },
        {
          role: 'user',
          content: JSON.stringify({
            message: input.message,
            selectedCategory: input.selectedCategory || '',
            productModel: input.productModel || '',
          }),
        },
      ],
    }),
  });

  if (!response.ok) return null;

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return parseJsonMatch(data.choices?.[0]?.message?.content || '');
}

async function matchWithGemini(input: AiIntentInput, apiKey: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${systemInstruction}\n\n${JSON.stringify({
                  message: input.message,
                  selectedCategory: input.selectedCategory || '',
                  productModel: input.productModel || '',
                })}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) return null;

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  return parseJsonMatch(data.candidates?.[0]?.content?.parts?.[0]?.text || '');
}

export async function matchIntentWithOptionalAi(input: AiIntentInput): Promise<AiIntentMatch | null> {
  const provider = process.env.AI_PROVIDER;
  const openAiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  try {
    if (provider === 'openai' && openAiKey) {
      return await matchWithOpenAi(input, openAiKey);
    }

    if (provider === 'gemini' && geminiKey) {
      return await matchWithGemini(input, geminiKey);
    }
  } catch (error) {
    console.error('Optional AI intent matching failed:', error);
  }

  return null;
}

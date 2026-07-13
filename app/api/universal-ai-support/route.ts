import {
  getUniversalAiSupportAnswer,
  sanitizeUniversalSupportInput,
} from '@/lib/universalAiSupportService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const input = sanitizeUniversalSupportInput(await readBody(req));
  const result = await getUniversalAiSupportAnswer(input);
  const responseInit = {
    headers: { 'X-Universal-AI-Source': result.source },
  };

  if (!input.message) {
    return Response.json(result.answer, {
      status: 400,
      ...responseInit,
    });
  }

  return Response.json(result.answer, responseInit);
}

async function readBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

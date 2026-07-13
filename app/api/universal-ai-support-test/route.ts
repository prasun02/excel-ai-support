import { getUniversalAiSupportAnswer } from '@/lib/universalAiSupportService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await getUniversalAiSupportAnswer({
    message: 'my router not work properly',
    category: 'Router / Internet',
    language: 'en',
  });

  return Response.json(result.answer, {
    headers: { 'X-Universal-AI-Source': result.source },
  });
}

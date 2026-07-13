export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    universalEnabled: process.env.ENABLE_UNIVERSAL_AI_SUPPORT,
    aiProvider: process.env.AI_PROVIDER,
    model: process.env.OPENAI_MODEL,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    keyPrefix: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.slice(0, 7) : null,
  });
}

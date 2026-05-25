import { createQuestionLog, readQuestionLogs } from '@/lib/questions';

export const runtime = 'nodejs';

type QuestionRequestBody = {
  ticketId?: unknown;
  category?: unknown;
  question?: unknown;
  language?: unknown;
  understood?: unknown;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET() {
  const questions = await readQuestionLogs();

  return Response.json({ questions });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as QuestionRequestBody;
    const question = cleanText(body.question);

    if (!question) {
      return Response.json(
        { error: 'Question is required.' },
        { status: 400 }
      );
    }

    const log = await createQuestionLog({
      ticketId: cleanText(body.ticketId),
      category: cleanText(body.category),
      question,
      language: body.language === 'bn' ? 'bn' : 'en',
      understood: Boolean(body.understood),
    });

    return Response.json({ log }, { status: 201 });
  } catch {
    return Response.json(
      { error: 'Unable to save question log.' },
      { status: 500 }
    );
  }
}

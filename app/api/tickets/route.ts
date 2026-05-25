import { createTicket, readTickets } from '@/lib/tickets';

export const runtime = 'nodejs';

type TicketRequestBody = {
  subject?: unknown;
  description?: unknown;
  category?: unknown;
  requesterName?: unknown;
  requesterContact?: unknown;
  source?: unknown;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET() {
  const tickets = await readTickets();

  return Response.json({ tickets });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TicketRequestBody;
    const subject = cleanText(body.subject);
    const description = cleanText(body.description);
    const category = cleanText(body.category) || 'General Support';

    if (!subject || !description) {
      return Response.json(
        { error: 'Subject and description are required.' },
        { status: 400 }
      );
    }

    const ticket = await createTicket({
      subject,
      description,
      category,
      requesterName: cleanText(body.requesterName),
      requesterContact: cleanText(body.requesterContact),
      source: body.source === 'manual' ? 'manual' : 'chat',
    });

    return Response.json({ ticket }, { status: 201 });
  } catch {
    return Response.json(
      { error: 'Unable to create support ticket.' },
      { status: 500 }
    );
  }
}

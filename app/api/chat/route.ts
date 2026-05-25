<<<<<<< HEAD
import { getNextTroubleshootingResponse } from '@/lib/troubleshootingEngine';
import type { ChatApiResponse, LocalSupportTicket } from '@/types/support';
import { generateTicketId } from '@/utils/ticket';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function POST(req: Request) {
  const body = await req.json();
  const messages = (body.messages || []) as ChatMessage[];
  const latestMessage = messages[messages.length - 1]?.content || '';
  const categoryHint = typeof body.category === 'string' ? body.category.trim() : '';
  const ticketContext = (body.ticketContext || {}) as Partial<LocalSupportTicket>;

  // Reuse a ticket if the browser already has one; otherwise create a demo ticket ID.
  const ticketId =
    typeof body.ticketId === 'string' && body.ticketId.trim()
      ? body.ticketId.trim()
      : generateTicketId();

  const result = getNextTroubleshootingResponse({
    message: latestMessage,
    selectedCategory: categoryHint,
    ticketState: ticketContext,
  });

  return Response.json({
    role: 'assistant',
    ticketId,
    category: result.detectedCategory,
    issue: latestMessage,
    solution: result.responseText,
    nextSteps: '',
    supportNotice: '',
    supportLink: 'https://www.excelbd.com/support/',
    language: result.language,
    matched: result.matched,
    understood: result.matched,
    ticketContext: result.updatedTicketState,
    content: result.responseText,
  } satisfies ChatApiResponse);
}
=======
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {

  try {

    const { messages } = await req.json();

    const genAI = new GoogleGenerativeAI(
      process.env.GOOGLE_GENERATIVE_AI_API_KEY!
    );

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
    });

    const lastMessage =
      messages[messages.length - 1]?.content || '';

    const prompt = `
You are Excel Technologies AI Smart Support Assistant.

You support customers in BOTH English and Bengali.

Help customers solve:
- Slow internet
- Router disconnecting
- Router setup
- Firmware update
- Weak WiFi signal
- WiFi password reset
- No internet connection

Rules:
- Answer simply
- Be professional
- Give step-by-step support
- Use easy language
- If user writes in Bengali, reply in Bengali
- If user writes in English, reply in English

User Question:
${lastMessage}
`;

    const result =
      await model.generateContent(prompt);

    const response = await result.response;

    const text = response.text();

    return Response.json({
      role: 'assistant',
      content: text,
    });

  } catch (error) {

    console.error(error);

    return Response.json({
      role: 'assistant',
      content:
        'Sorry, something went wrong.',
    });

  }
}
>>>>>>> fa8cc45 (Excel AI chatbot upgraded)

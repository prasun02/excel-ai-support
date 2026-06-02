import { matchIntentWithOptionalAi } from '@/lib/aiIntentMatcher';
import { getNextTroubleshootingResponse } from '@/lib/troubleshootingEngine';
import type { ChatApiResponse, LocalSupportTicket, SimpleSupportKnowledgeItem } from '@/types/support';
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
  const importedSimpleKnowledge = Array.isArray(body.importedSimpleKnowledge)
    ? (body.importedSimpleKnowledge as SimpleSupportKnowledgeItem[])
    : [];

  // Reuse a ticket if the browser already has one; otherwise create a demo ticket ID.
  const ticketId =
    typeof body.ticketId === 'string' && body.ticketId.trim()
      ? body.ticketId.trim()
      : generateTicketId();

  const aiIntent = await matchIntentWithOptionalAi({
    message: latestMessage,
    selectedCategory: categoryHint,
    productModel: ticketContext.productModel || '',
  });

  const result = getNextTroubleshootingResponse({
    message: latestMessage,
    selectedCategory: categoryHint,
    ticketState: ticketContext,
    importedSimpleKnowledge,
    aiIntent,
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

import { matchIntentWithOptionalAi } from '@/lib/aiIntentMatcher';
import { detectCategoryAndIntent } from '@/lib/categoryIntentDetector';
import { answerDemoHybridSupport } from '@/lib/demoHybridSupportEngine';
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

  const detected = detectCategoryAndIntent({
    message: latestMessage,
    previousCategory: ticketContext.selectedCategory || ticketContext.category || categoryHint,
    activeProblemId: ticketContext.issueType,
    activeSolutionId: ticketContext.currentFlowId,
    waitingForLocation: Boolean(ticketContext.awaitingLocation),
  });
  const effectiveCategory =
    detected.intent === 'non_support'
      ? categoryHint
      : detected.categoryChanged || !categoryHint
        ? detected.category
        : categoryHint;
  const effectiveTicketContext: Partial<LocalSupportTicket> = detected.shouldResetFlow
    ? {
        ...ticketContext,
        selectedCategory: detected.category,
        category: detected.category,
        issueType: '',
        currentFlowId: '',
        currentQuestionIndex: 0,
        currentStep: 0,
        askedQuestions: [],
        userAnswers: [],
        solutionGiven: false,
        solvedStatus: 'pending',
        awaitingLocation: false,
        escalationActive: false,
        escalationCompleted: false,
      }
    : ticketContext;

  const aiIntent = await matchIntentWithOptionalAi({
    message: latestMessage,
    selectedCategory: effectiveCategory,
    productModel: effectiveTicketContext.productModel || '',
  });

  const result = getNextTroubleshootingResponse({
    message: latestMessage,
    selectedCategory: effectiveCategory,
    ticketState: effectiveTicketContext,
    importedSimpleKnowledge,
    aiIntent,
  });
  const shouldUseDemoHybrid =
    process.env.ENABLE_DEMO_HYBRID_AI !== 'false' &&
    !result.matched &&
    detected.intent !== 'non_support' &&
    !result.needsCategorySelection;
  const hybridResult = shouldUseDemoHybrid
    ? await answerDemoHybridSupport({
        message: latestMessage,
        previousCategory: ticketContext.selectedCategory || ticketContext.category || categoryHint,
        selectedCategory: effectiveCategory,
        activeProblemId: effectiveTicketContext.issueType,
        activeSolutionId: effectiveTicketContext.currentFlowId,
        waitingForLocation: Boolean(effectiveTicketContext.awaitingLocation),
        model: effectiveTicketContext.productModel || '',
        productId: '',
        hardwareVersion: '',
        manualKnowledgeResult: result,
      })
    : null;
  const responseContent = hybridResult?.message || result.responseText;
  const responseCategory = hybridResult?.category || result.detectedCategory;
  const responseIssue = hybridResult?.problemName || result.detectedIssueType;
  const updatedTicketContext: Partial<LocalSupportTicket> = {
    ...result.updatedTicketState,
    ...(hybridResult
      ? {
          selectedCategory: responseCategory || effectiveCategory,
          category: responseCategory || effectiveCategory,
          issueType: responseIssue || result.detectedIssueType,
          currentFlowId: hybridResult.shouldResetFlow ? '' : result.updatedTicketState.currentFlowId,
          currentQuestionIndex: hybridResult.shouldResetFlow ? 0 : result.updatedTicketState.currentQuestionIndex,
          currentStep: hybridResult.shouldResetFlow ? 0 : result.updatedTicketState.currentStep,
          askedQuestions: hybridResult.shouldResetFlow ? [] : result.updatedTicketState.askedQuestions,
          userAnswers: hybridResult.shouldResetFlow ? [] : result.updatedTicketState.userAnswers,
          solutionGiven: false,
          solvedStatus: hybridResult.escalationRequired ? 'not_solved' : 'pending',
          awaitingLocation: hybridResult.escalationRequired,
          escalationActive: hybridResult.escalationRequired,
          escalationCompleted: hybridResult.type === 'location_reply',
        }
      : {}),
  };

  return Response.json({
    role: 'assistant',
    ticketId,
    category: responseCategory,
    issue: latestMessage,
    solution: responseContent,
    nextSteps: '',
    supportNotice: '',
    supportLink: 'https://www.excelbd.com/support/',
    language: result.language,
    matched: result.matched || Boolean(hybridResult && hybridResult.type !== 'non_support'),
    understood: result.matched || Boolean(hybridResult && hybridResult.type !== 'non_support'),
    ticketContext: updatedTicketContext,
    content: responseContent,
  } satisfies ChatApiResponse);
}

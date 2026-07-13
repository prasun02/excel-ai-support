import { matchIntentWithOptionalAi } from '@/lib/aiIntentMatcher';
import { detectCategoryAndIntent } from '@/lib/categoryIntentDetector';
import { answerDemoHybridSupport } from '@/lib/demoHybridSupportEngine';
import { getRouterFollowUpAnswer, getRouterGuidedProcess, getRouterInitialAdvice } from '@/lib/routerGuidedSupport';
import { detectRouterProblem } from '@/lib/routerProblemDetector';
import { analyzeStickerImagePlaceholder } from '@/lib/stickerImageAnalyzer';
import { getNextTroubleshootingResponse } from '@/lib/troubleshootingEngine';
import {
  getUniversalSupportResponse,
  isUniversalSupportEnabled,
  manualKnowledgeHasApprovedAnswer,
  prepareUniversalSupportRouting,
  universalAnswerToChatContent,
  universalAnswerToTicketCategory,
} from '@/lib/universalSupportRouter';
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
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl : '';
  const fileName = typeof body.fileName === 'string' ? body.fileName : '';

  // Reuse a ticket if the browser already has one; otherwise create a demo ticket ID.
  const ticketId =
    typeof body.ticketId === 'string' && body.ticketId.trim()
      ? body.ticketId.trim()
      : generateTicketId();

  if (isGreeting(latestMessage)) {
    const content = 'Welcome to Excel Service AI. Please write your Excel product or service problem, or share your product model if available.';

    return Response.json({
      role: 'assistant',
      ticketId,
      category: ticketContext.category || categoryHint || '',
      issue: latestMessage,
      solution: content,
      nextSteps: '',
      supportNotice: '',
      supportLink: 'https://www.excelbd.com/support/',
      language: resultLanguage(latestMessage),
      matched: true,
      understood: true,
      ticketContext,
      content,
    } satisfies ChatApiResponse);
  }

  const universalRouting = prepareUniversalSupportRouting({
    message: latestMessage,
    categoryHint,
    currentState: ticketContext,
  });
  const universalDetected = universalRouting.detectedContext;
  const effectiveCategory = universalRouting.effectiveCategory;
  const effectiveTicketContext = universalRouting.updatedState as Partial<LocalSupportTicket>;

  if (universalDetected.detectedCategory === 'Non Support') {
    const content = "I'm here to help with Excel Technologies product support only. Please describe your product issue.";

    return Response.json({
      role: 'assistant',
      ticketId,
      category: effectiveTicketContext.category || categoryHint || ticketContext.category || '',
      issue: latestMessage,
      solution: content,
      nextSteps: '',
      supportNotice: '',
      supportLink: 'https://www.excelbd.com/support/',
      language: resultLanguage(latestMessage),
      matched: false,
      understood: false,
      ticketContext: effectiveTicketContext,
      content,
    } satisfies ChatApiResponse);
  }

  const detected = detectCategoryAndIntent({
    message: latestMessage,
    previousCategory: effectiveCategory || effectiveTicketContext.selectedCategory || effectiveTicketContext.category || categoryHint,
    activeProblemId: effectiveTicketContext.issueType,
    activeSolutionId: effectiveTicketContext.currentFlowId,
    waitingForLocation: Boolean(effectiveTicketContext.awaitingLocation),
  });

  const aiIntent = await matchIntentWithOptionalAi({
    message: latestMessage,
    selectedCategory: effectiveCategory,
    productModel: effectiveTicketContext.productModel || '',
  });

  if (imageUrl || /\.(png|jpe?g|webp)$/i.test(fileName)) {
    const sticker = analyzeStickerImagePlaceholder({ imageUrl, fileName });
    return Response.json({
      role: 'assistant',
      ticketId,
      category: effectiveCategory || ticketContext.category || '',
      issue: latestMessage,
      solution: `Image received. ${sticker.message}`,
      nextSteps: '',
      supportNotice: '',
      supportLink: 'https://www.excelbd.com/support/',
      language: resultLanguage(latestMessage),
      matched: true,
      understood: true,
      ticketContext: {
        ...effectiveTicketContext,
        awaitingLocation: false,
        escalationActive: false,
      },
      content: `Image received. ${sticker.message}`,
    } satisfies ChatApiResponse);
  }

  const productMatches = universalRouting.productMatches;
  const productInfo = universalRouting.productInfo;
  const bestProductMatch = getConfidentProductMatch(productMatches);
  const routerProblem = detectRouterProblem({ message: latestMessage });
  const universalSupportEnabled = isUniversalSupportEnabled();
  const hasActiveRouterProblem = Boolean(
    (effectiveTicketContext.selectedCategory || effectiveTicketContext.category || effectiveCategory) === 'Router / Internet' &&
      effectiveTicketContext.issueType
  );
  const routerFollowUpAnswer = hasActiveRouterProblem ? getRouterFollowUpAnswer(latestMessage) : '';
  if (!universalSupportEnabled && routerFollowUpAnswer) {
    return apiResult({
      ticketId,
      latestMessage,
      category: 'Router / Internet',
      content: routerFollowUpAnswer,
      language: resultLanguage(latestMessage),
      ticketContext: effectiveTicketContext,
      matched: true,
    });
  }

  const asksForGuidedRouter =
    hasActiveRouterProblem &&
    /(yes|yes i want|solution|guide me|bolo|bolen|chai|start|how update firmware|firmware|update|router page|router ip|192\.168\.0\.1|192\.168\.1\.1|how configure|quick setup)/i.test(latestMessage);

  if (!universalSupportEnabled && asksForGuidedRouter) {
    const guided = getRouterGuidedProcess({
      brand: bestProductMatch?.brand || '',
      model: effectiveTicketContext.productModel || bestProductMatch?.model || '',
      hardwareVersion: effectiveTicketContext.currentHardwareVersion || extractHardwareVersion(effectiveTicketContext.productModel || latestMessage),
      problemName: effectiveTicketContext.issueType || routerProblem.problemName,
      customerHasConfirmedModel: Boolean(effectiveTicketContext.productModel),
    });
    const content = guided.message;

    return Response.json({
      role: 'assistant',
      ticketId,
      category: 'Router / Internet',
      issue: latestMessage,
      solution: content,
      nextSteps: '',
      supportNotice: '',
      supportLink: 'https://www.excelbd.com/support/',
      language: resultLanguage(latestMessage),
      matched: true,
      understood: true,
      ticketContext: {
        ...effectiveTicketContext,
        selectedCategory: 'Router / Internet',
        category: 'Router / Internet',
        issueType: effectiveTicketContext.issueType || routerProblem.problemName,
        currentFlowId: effectiveTicketContext.currentFlowId || 'ROUTER_GUIDED_SUPPORT',
        productModel: normalizeModel(productInfo.model || effectiveTicketContext.productModel || bestProductMatch?.model || ''),
        currentModel: normalizeModel(productInfo.model || effectiveTicketContext.currentModel || effectiveTicketContext.productModel || bestProductMatch?.model || ''),
        currentHardwareVersion: productInfo.hardwareVersion || effectiveTicketContext.currentHardwareVersion || extractHardwareVersion(effectiveTicketContext.productModel || latestMessage),
        serialNumber: productInfo.serialNumber || effectiveTicketContext.serialNumber,
        currentSN: productInfo.serialNumber || effectiveTicketContext.currentSN || effectiveTicketContext.serialNumber,
        solutionGiven: true,
        waitingForGuidedConfirmation: false,
      },
      content,
    } satisfies ChatApiResponse);
  }

  const isModelOnlyMessage =
    productMatches.bestMatch &&
    ['high', 'medium'].includes(productMatches.confidence) &&
    isSpecificProductMatch(productMatches.bestMatch) &&
    !routerProblem.isRouterProblem &&
    !effectiveTicketContext.issueType;

  if (isModelOnlyMessage) {
    const bestProduct = productMatches.bestMatch;
    if (!bestProduct) throw new Error('Product match was expected but missing.');

    const matches = productMatches.matches;
    const topScore = matches[0]?.score || 0;
    const closeMatches = matches.filter((match) => topScore - match.score <= 15);
    const shouldConfirmMultiple = closeMatches.length > 1 && productMatches.confidence !== 'high';
    const content = shouldConfirmMultiple
      ? `I found multiple possible devices. Please confirm which one is correct:\n\n${matches.map((match, index) => `${index + 1}. ${match.itemName}`).join('\n')}`
      : `As per your input, I found this device: ${bestProduct.itemName}. If this is the correct model, please share the problem you are facing.`;

    return Response.json({
      role: 'assistant',
      ticketId,
      category: bestProduct.category || effectiveCategory || 'Router / Internet',
      issue: latestMessage,
      solution: content,
      nextSteps: '',
      supportNotice: '',
      supportLink: 'https://www.excelbd.com/support/',
      language: resultLanguage(latestMessage),
      matched: true,
      understood: true,
      ticketContext: {
        ...effectiveTicketContext,
        selectedCategory: bestProduct.category || effectiveCategory || 'Router / Internet',
        category: bestProduct.category || effectiveCategory || 'Router / Internet',
        productModel: normalizeModel(bestProduct.model || productInfo.model || bestProduct.itemCode || effectiveTicketContext.productModel || ''),
        currentProductId: bestProduct.productId,
        currentProductName: bestProduct.itemName,
        currentModel: normalizeModel(bestProduct.model || productInfo.model || bestProduct.itemCode || ''),
        currentHardwareVersion: productInfo.hardwareVersion || effectiveTicketContext.currentHardwareVersion,
        serialNumber: productInfo.serialNumber || effectiveTicketContext.serialNumber,
        currentSN: productInfo.serialNumber || effectiveTicketContext.currentSN || effectiveTicketContext.serialNumber,
        productInfoAsked: true,
        issueType: '',
        currentFlowId: '',
      },
      content,
    } satisfies ChatApiResponse);
  }

  const result = getNextTroubleshootingResponse({
    message: latestMessage,
    selectedCategory: effectiveCategory,
    ticketState: effectiveTicketContext,
    importedSimpleKnowledge,
    aiIntent,
  });

  if (manualKnowledgeHasApprovedAnswer(result)) {
    return apiResult({
      ticketId,
      latestMessage,
      category: result.detectedCategory || effectiveCategory || effectiveTicketContext.category || '',
      content: result.responseText,
      language: result.language,
      ticketContext: result.updatedTicketState,
      matched: true,
    });
  }

  const universalResult = await getUniversalSupportResponse({
    requestUrl: req.url,
    payload: {
      message: latestMessage,
      category: result.detectedCategory || effectiveCategory || effectiveTicketContext.category || '',
      detectedProduct: bestProductMatch?.itemName || universalDetected.detectedProductName || bestProductMatch?.brand || '',
      detectedModel: normalizeModel(productInfo.model || effectiveTicketContext.productModel || bestProductMatch?.model || universalDetected.detectedModel || ''),
      detectedProblem: universalDetected.detectedProblem || result.detectedIssueType || effectiveTicketContext.currentProblemName || effectiveTicketContext.issueType || '',
      hardwareVersion: productInfo.hardwareVersion || effectiveTicketContext.currentHardwareVersion || extractHardwareVersion(effectiveTicketContext.productModel || latestMessage),
      language: universalDetected.language,
      previousContext: {
        currentCategory: effectiveTicketContext.currentCategory || effectiveTicketContext.selectedCategory || effectiveTicketContext.category || effectiveCategory,
        currentProblemName: effectiveTicketContext.currentProblemName || effectiveTicketContext.issueType || result.detectedIssueType,
        currentProductName: effectiveTicketContext.currentProductName || bestProductMatch?.itemName || '',
        currentModel: effectiveTicketContext.currentModel || effectiveTicketContext.productModel || bestProductMatch?.model || '',
        currentHardwareVersion: effectiveTicketContext.currentHardwareVersion || productInfo.hardwareVersion || '',
        activeSupportFlow: effectiveTicketContext.activeSupportFlow || effectiveTicketContext.currentFlowId || '',
      },
    },
    manualKnowledgeResult: result,
    hasActiveFlow: Boolean(effectiveTicketContext.currentFlowId),
    detectedIntent: detected.intent,
  });

  if (universalResult) {
    const answer = universalResult.answer;
    const ticketCategory = universalAnswerToTicketCategory(
      answer,
      result.detectedCategory || effectiveCategory || effectiveTicketContext.category || ''
    );
    const productModel = normalizeModel(productInfo.model || effectiveTicketContext.productModel || bestProductMatch?.model || '');
    const hardwareVersion =
      productInfo.hardwareVersion ||
      effectiveTicketContext.currentHardwareVersion ||
      extractHardwareVersion(effectiveTicketContext.productModel || latestMessage);

    return apiResult({
      ticketId,
      latestMessage,
      category: ticketCategory || answer.category,
      content: universalAnswerToChatContent(answer),
      language: chatLanguageFromUniversal(answer.language),
      ticketContext: {
        ...effectiveTicketContext,
        ...result.updatedTicketState,
        selectedCategory: ticketCategory || result.detectedCategory || effectiveCategory || effectiveTicketContext.selectedCategory,
        category: ticketCategory || result.detectedCategory || effectiveCategory || effectiveTicketContext.category,
        currentCategory: ticketCategory || result.detectedCategory || effectiveCategory || effectiveTicketContext.currentCategory,
        currentProblemName: answer.detectedProblem,
        currentProductId: bestProductMatch?.productId || effectiveTicketContext.currentProductId,
        currentProductName: bestProductMatch?.itemName || effectiveTicketContext.currentProductName,
        productModel,
        currentModel: productModel || effectiveTicketContext.currentModel,
        currentHardwareVersion: hardwareVersion,
        serialNumber: productInfo.serialNumber || effectiveTicketContext.serialNumber,
        currentSN: productInfo.serialNumber || effectiveTicketContext.currentSN || effectiveTicketContext.serialNumber,
        issueType: answer.detectedProblem,
        currentFlowId: 'UNIVERSAL_AI_SUPPORT',
        activeSupportFlow: 'universal_ai_support',
        activeProblemId: answer.detectedProblem,
        currentQuestionIndex: 0,
        currentStep: 0,
        askedQuestions: [],
        userAnswers: [],
        solutionGiven: answer.type !== 'clarifying_question' && answer.type !== 'non_support',
        solvedStatus: 'pending',
        awaitingLocation: false,
        escalationActive: false,
        escalationCompleted: false,
        waitingForGuidedConfirmation: ticketCategory === 'Router / Internet',
      },
      matched: answer.type !== 'non_support',
    });
  }

  if (routerProblem.isRouterProblem) {
    if (
      result.matched &&
      !/Please share your router model or upload a clear photo/i.test(result.responseText) &&
      /Possible causes|Excel-approved|safe checks/i.test(result.responseText)
    ) {
      return apiResult({
        ticketId,
        latestMessage,
        category: result.detectedCategory || 'Router / Internet',
        content: result.responseText,
        language: result.language,
        ticketContext: {
          ...result.updatedTicketState,
          selectedCategory: 'Router / Internet',
          category: 'Router / Internet',
          currentCategory: 'Router / Internet',
          currentProblemName: result.detectedIssueType,
          waitingForGuidedConfirmation: true,
        },
        matched: true,
      });
    }

    const product = productMatches.bestMatch &&
      ['high', 'medium'].includes(productMatches.confidence) &&
      isSpecificProductMatch(productMatches.bestMatch)
      ? productMatches.bestMatch
      : undefined;
    const advice = getRouterInitialAdvice({
      product,
      problemName: routerProblem.problemName,
      message: latestMessage,
    });
    const modelRequest = product || effectiveTicketContext.productModel
      ? ''
      : '\n\nPlease upload a clear photo of the backside sticker or write model and hardware version, for example TL-WR845N Ver 4.';
    const content = [
      product ? `Detected device: ${product.itemName}` : '',
      `Detected problem: ${routerProblem.problemName}`,
      '',
      advice.message,
      ...advice.possibleCauses.map((cause, index) => `${index + 1}. ${cause}`),
      '',
      'Please check these safe points first:',
      ...advice.safeChecks.map((check, index) => `${index + 1}. ${check}`),
      modelRequest.trim(),
      '',
      advice.offerGuidedTroubleshooting,
    ].filter((line) => line !== '').join('\n');

    return Response.json({
      role: 'assistant',
      ticketId,
      category: 'Router / Internet',
      issue: latestMessage,
      solution: content,
      nextSteps: '',
      supportNotice: '',
      supportLink: 'https://www.excelbd.com/support/',
      language: resultLanguage(latestMessage),
      matched: true,
      understood: true,
      ticketContext: {
        ...effectiveTicketContext,
        selectedCategory: 'Router / Internet',
        category: 'Router / Internet',
        currentCategory: 'Router / Internet',
        currentProblemName: routerProblem.problemName,
        currentProductId: product?.productId || effectiveTicketContext.currentProductId,
        currentProductName: product?.itemName || effectiveTicketContext.currentProductName,
        productModel: normalizeModel(product?.model || productInfo.model || effectiveTicketContext.productModel || ''),
        currentModel: normalizeModel(product?.model || productInfo.model || effectiveTicketContext.currentModel || effectiveTicketContext.productModel || ''),
        currentHardwareVersion: productInfo.hardwareVersion || effectiveTicketContext.currentHardwareVersion || extractHardwareVersion(latestMessage),
        serialNumber: productInfo.serialNumber || effectiveTicketContext.serialNumber,
        currentSN: productInfo.serialNumber || effectiveTicketContext.currentSN || effectiveTicketContext.serialNumber,
        productInfoAsked: Boolean(product || effectiveTicketContext.productModel),
        issueType: routerProblem.problemName,
        currentFlowId: 'ROUTER_GUIDED_SUPPORT',
        activeSupportFlow: 'router_guided_support',
        activeProblemId: routerProblem.problemName,
        currentQuestionIndex: 0,
        currentStep: 0,
        askedQuestions: [],
        userAnswers: [],
        solutionGiven: false,
        solvedStatus: 'pending',
        awaitingLocation: false,
        escalationActive: false,
        escalationCompleted: false,
        waitingForGuidedConfirmation: true,
      },
      content,
    } satisfies ChatApiResponse);
  }

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

function apiResult(input: {
  ticketId: string;
  latestMessage: string;
  category: string;
  content: string;
  language: 'en' | 'bn';
  ticketContext: Partial<LocalSupportTicket>;
  matched: boolean;
}) {
  return Response.json({
    role: 'assistant',
    ticketId: input.ticketId,
    category: input.category,
    issue: input.latestMessage,
    solution: input.content,
    nextSteps: '',
    supportNotice: '',
    supportLink: 'https://www.excelbd.com/support/',
    language: input.language,
    matched: input.matched,
    understood: input.matched,
    ticketContext: input.ticketContext,
    content: input.content,
  } satisfies ChatApiResponse);
}

function resultLanguage(message: string): 'en' | 'bn' {
  return /[\u0980-\u09FF]/.test(message) ? 'bn' : 'en';
}

function chatLanguageFromUniversal(language: string): 'en' | 'bn' {
  return language === 'bn' || language === 'banglish' || language === 'mixed' ? 'bn' : 'en';
}

function extractHardwareVersion(text: string) {
  return text.match(/\b(?:ver|v)\s*\.?\s*(\d+(?:\.\d+)?)\b/i)?.[0] || '';
}

function normalizeModel(model: string) {
  return model.replace(/\b(?:ver|version|v)\s*\.?\s*\d+(?:\.\d+)?\b/i, '').trim();
}

function getConfidentProductMatch<T extends { matchedBy: string[] }>(productMatches: {
  bestMatch?: T;
  confidence: 'high' | 'medium' | 'low' | 'none';
}) {
  const bestMatch = productMatches.bestMatch;

  if (!bestMatch) return undefined;

  return ['high', 'medium'].includes(productMatches.confidence) || isSpecificProductMatch(bestMatch)
    ? bestMatch
    : undefined;
}

function isGreeting(message: string) {
  return /^(hi|hello|hey|assalamu alaikum|salam|good morning|good afternoon|good evening)$/i.test(message.trim());
}

function isSpecificProductMatch(match: { matchedBy: string[] }) {
  return match.matchedBy.some((reason) => /^(exact|compact-exact|compact-text|partial):/i.test(reason));
}

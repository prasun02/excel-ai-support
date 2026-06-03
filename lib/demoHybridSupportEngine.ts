import { detectCategoryAndIntent } from '@/lib/categoryIntentDetector';
import { getRuleBasedDemoAnswer } from '@/lib/demoSupportFallbacks';
import type { SupportCategory } from '@/lib/aiSupportTypes';

type DemoHybridInput = {
  message: string;
  previousCategory?: string;
  selectedCategory?: string;
  activeProblemId?: string;
  activeSolutionId?: string;
  activeStepGroupId?: string;
  activeProcedureId?: string;
  waitingForLocation?: boolean;
  model?: string;
  productId?: string;
  hardwareVersion?: string;
  manualKnowledgeResult?: {
    matched?: boolean;
    responseText?: string;
    detectedCategory?: string;
    detectedIssueType?: string;
  } | null;
};

type DemoHybridOutput = {
  type:
    | 'manual_answer'
    | 'ai_possible_solution'
    | 'clarifying_question'
    | 'category_switch'
    | 'warranty_guidance'
    | 'location_reply'
    | 'escalation'
    | 'non_support';
  language: string;
  category?: string;
  problemName?: string;
  message: string;
  suggestedQuestions?: string[];
  safeSteps?: string[];
  warning?: string;
  confidence: 'high' | 'medium' | 'low';
  sourceMode: 'manual' | 'demo_ai' | 'manual_plus_demo_ai';
  shouldResetFlow?: boolean;
  escalationRequired?: boolean;
};

function formatDemoMessage(answer: ReturnType<typeof getRuleBasedDemoAnswer>, sourceMode: 'demo_ai' | 'manual_plus_demo_ai') {
  const causes = answer.possibleCauses.map((cause, index) => `${index + 1}. ${cause}`).join('\n');
  const steps = answer.safeSteps.map((step, index) => `${index + 1}. ${step}`).join('\n');
  const note = sourceMode === 'demo_ai'
    ? '\n\nNote: This is general guidance. For warranty, replacement, or exact model-specific repair, Excel support may need to verify details.'
    : '';
  const warning = answer.warning ? `\n\nWarning: ${answer.warning}` : '';

  return `${answer.message}\n\nPossible causes:\n${causes}\n\nSafe checks you can try:\n${steps}\n\nTo understand better, please answer:\n${answer.nextQuestion}${warning}${note}`;
}

function isDemoEnabled() {
  return process.env.ENABLE_DEMO_HYBRID_AI !== 'false';
}

export async function answerDemoHybridSupport(input: DemoHybridInput): Promise<DemoHybridOutput> {
  const detection = detectCategoryAndIntent({
    message: input.message,
    previousCategory: input.previousCategory || input.selectedCategory,
    activeProblemId: input.activeProblemId,
    activeSolutionId: input.activeSolutionId,
    waitingForLocation: input.waitingForLocation,
  });

  if (detection.intent === 'non_support') {
    return {
      type: 'non_support',
      language: detection.language,
      category: detection.category,
      message: "I'm here to help with Excel Technologies product support and technology-related support only. Please describe your product issue.",
      confidence: 'high',
      sourceMode: 'demo_ai',
      escalationRequired: false,
    };
  }

  if (detection.intent === 'location_reply') {
    return {
      type: 'location_reply',
      language: detection.language,
      category: input.previousCategory || input.selectedCategory || detection.category,
      message: 'Thank you. Please contact your nearest Excel Customer Support Point directly for further support. You may visit the service center physically with your device if needed. If you have any other support issue or query, please write it.',
      confidence: 'medium',
      sourceMode: 'demo_ai',
      shouldResetFlow: true,
      escalationRequired: false,
    };
  }

  const manual = input.manualKnowledgeResult;
  if (manual?.matched && manual.responseText) {
    return {
      type: 'manual_answer',
      language: detection.language,
      category: manual.detectedCategory || detection.category,
      problemName: manual.detectedIssueType || detection.problemName,
      message: manual.responseText,
      confidence: 'high',
      sourceMode: 'manual',
      shouldResetFlow: detection.shouldResetFlow,
      escalationRequired: false,
    };
  }

  if ((detection.intent === 'follow_up' || /not solved|still problem|no solved/i.test(input.message)) && !manual?.matched) {
    return {
      type: 'escalation',
      language: detection.language,
      category: input.previousCategory || detection.category,
      problemName: detection.problemName,
      message: detection.language === 'bn'
        ? 'দুঃখিত। অনুগ্রহ করে আপনার লোকেশন লিখুন, তাহলে আমরা আপনাকে নিকটস্থ Excel Customer Support Point-এর তথ্য দিতে সহায়তা করব।'
        : 'Sorry to hear that. Please provide your location so we can guide you to the nearest Excel Customer Support Point.',
      confidence: 'medium',
      sourceMode: 'demo_ai',
      escalationRequired: true,
    };
  }

  if (!isDemoEnabled()) {
    return {
      type: 'escalation',
      language: detection.language,
      category: detection.category,
      problemName: detection.problemName,
      message: 'I do not have an Excel-approved exact solution for this issue yet. I can forward this to human support.',
      confidence: 'low',
      sourceMode: 'manual',
      escalationRequired: true,
    };
  }

  const category = (input.selectedCategory || detection.category) as SupportCategory;
  const fallback = getRuleBasedDemoAnswer(category, detection.problemName, input.message, detection.language);
  const warning = detection.riskLevel === 'high'
    ? 'Risky actions need exact model/hardware version and Excel-approved or official instructions. If unsure, please contact CSP support.'
    : fallback.warning;
  const type = detection.categoryChanged ? 'category_switch' : detection.intent === 'warranty_query' ? 'warranty_guidance' : 'ai_possible_solution';
  const message = formatDemoMessage({ ...fallback, warning }, 'demo_ai');

  return {
    type,
    language: detection.language,
    category,
    problemName: detection.problemName,
    message,
    suggestedQuestions: [fallback.nextQuestion],
    safeSteps: fallback.safeSteps,
    warning,
    confidence: detection.confidence >= 0.7 ? 'high' : detection.confidence >= 0.45 ? 'medium' : 'low',
    sourceMode: 'demo_ai',
    shouldResetFlow: detection.shouldResetFlow,
    escalationRequired: false,
  };
}

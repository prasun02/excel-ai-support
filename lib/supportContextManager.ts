import type { UniversalCategoryContext } from '@/lib/universalCategoryDetector';

type ContextUpdateInput = {
  message: string;
  currentState: Record<string, unknown>;
  detectedContext: UniversalCategoryContext;
};

type ContextUpdateResult = {
  updatedState: Record<string, unknown>;
  resetApplied: boolean;
  resetReason?: string;
};

const activeFlowDefaults: Record<string, unknown> = {
  activeProblemId: '',
  activeSolutionId: '',
  activeStepGroupId: '',
  activeProcedureId: '',
  activeSupportFlow: '',
  waitingForGuidedConfirmation: false,
  waitingForModelOrSticker: false,
  waitingForProblemDetails: false,
  waitingForLocation: false,
  currentProblemName: '',
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
};

const productDefaults: Record<string, unknown> = {
  currentProductId: '',
  currentProductName: '',
  currentModel: '',
  currentHardwareVersion: '',
  productModel: '',
  currentSN: '',
  serialNumber: '',
};

function shouldUseDetectedCategory(detectedContext: UniversalCategoryContext) {
  return detectedContext.detectedCategory !== 'Non Support' && detectedContext.confidence >= 0.6;
}

function shouldClearProductContext(detectedContext: UniversalCategoryContext, currentState: Record<string, unknown>) {
  const hasPreviousProduct = Boolean(
    currentState?.currentProductId ||
      currentState?.currentProductName ||
      currentState?.currentModel ||
      currentState?.productModel ||
      currentState?.serialNumber ||
      currentState?.currentSN
  );

  return detectedContext.productChanged || (detectedContext.categoryChanged && hasPreviousProduct);
}

export function applyCategoryContextUpdate(input: ContextUpdateInput): ContextUpdateResult {
  const detectedContext = input.detectedContext;
  const updatedState = { ...(input.currentState || {}) };
  const resetReasons: string[] = [];
  const resetFlow = detectedContext.shouldResetSupportFlow && detectedContext.confidence >= 0.6;
  const clearProduct = shouldClearProductContext(detectedContext, updatedState);

  if (resetFlow) {
    Object.assign(updatedState, activeFlowDefaults);
    resetReasons.push(detectedContext.reason || 'latest message changed active support context');
  }

  if (clearProduct) {
    Object.assign(updatedState, productDefaults);
    resetReasons.push('cleared stale product/model/SN context');
  }

  if (shouldUseDetectedCategory(detectedContext)) {
    updatedState.selectedCategory = detectedContext.detectedCategory;
    updatedState.category = detectedContext.detectedCategory;
    updatedState.currentCategory = detectedContext.detectedCategory;
  }

  if (detectedContext.detectedProblem && detectedContext.detectedCategory !== 'Non Support') {
    updatedState.currentProblemName = detectedContext.detectedProblem;
  }

  if (detectedContext.detectedProductName) {
    updatedState.currentProductName = detectedContext.detectedProductName;
  }

  if (detectedContext.detectedModel) {
    updatedState.currentModel = detectedContext.detectedModel;
    updatedState.productModel = detectedContext.detectedModel;
  }

  return {
    updatedState,
    resetApplied: resetReasons.length > 0,
    resetReason: resetReasons.join('; ') || undefined,
  };
}

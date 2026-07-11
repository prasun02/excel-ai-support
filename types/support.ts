export type ReplyLanguage = 'en' | 'bn';

export type LocalTicketStatus = 'Open' | 'In Progress' | 'Solved' | 'Escalated' | 'AI_HANDLED';

export type SupportChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
};

export type SolvedStatus = 'pending' | 'solved' | 'not_solved';

export type TroubleshootingContext = {
  issueType: string;
  currentFlowId: string;
  currentQuestionIndex: number;
  currentStep: number;
  askedQuestions: string[];
  userAnswers: string[];
  solutionGiven: boolean;
  solvedStatus: SolvedStatus;
  productInfoAsked?: boolean;
  awaitingLocation?: boolean;
  escalationActive?: boolean;
  escalationCompleted?: boolean;
};

export type LocalSupportTicket = {
  ticketId: string;
  customerName: string;
  customerContact: string;
  productModel: string;
  serialNumber: string;
  currentCategory?: string;
  currentProblemName?: string;
  currentProductId?: string;
  currentProductName?: string;
  currentModel?: string;
  currentHardwareVersion?: string;
  currentSN?: string;
  activeSupportFlow?: string;
  activeProblemId?: string;
  activeSolutionId?: string;
  activeStepGroupId?: string;
  activeProcedureId?: string;
  waitingForGuidedConfirmation?: boolean;
  waitingForLocation?: boolean;
  productInfoAsked: boolean;
  selectedCategory: string;
  messages: SupportChatMessage[];
  issueType: string;
  currentFlowId: string;
  currentQuestionIndex: number;
  currentStep: number;
  askedQuestions: string[];
  userAnswers: string[];
  solutionGiven: boolean;
  solvedStatus: SolvedStatus;
  awaitingLocation: boolean;
  escalationActive: boolean;
  escalationCompleted: boolean;
  category: string;
  issue: string;
  solution: string;
  status: LocalTicketStatus;
  assignedPerson?: string;
  internalRemarks?: string;
  createdAt: string;
  updatedAt: string;
};

export type LocalizedText = {
  en: string;
  bn: string;
};

export type SupportKnowledgeItem = {
  category: string;
  keywords: string[];
  solution: LocalizedText;
  escalation_message: LocalizedText;
};

export type TroubleshootingFlow = {
  category: string;
  issueType: string;
  symptoms: string[];
  questions: string[];
  solutionSteps: string[];
  solvedQuestion: string;
  escalationMessage: string;
};

export type SupportIntentItem = {
  category: string;
  intent: string;
  issueType: string;
  englishKeywords: string[];
  banglaKeywords: string[];
  banglishKeywords: string[];
  misspellings: string[];
  diagnosticQuestions: string[];
  solutionSteps: string[];
  followUpQuestion: string;
  escalationMessage: string;
  priority: 'high' | 'medium' | 'low';
  active: boolean;
};

export type ModelWiseSupportKnowledgeItem = {
  category: string;
  brand: string;
  productModel: string;
  modelFamily: string;
  deviceType: string;
  issueType: string;
  problemKeywords: string[];
  banglaKeywords: string[];
  banglishKeywords: string[];
  misspellings: string[];
  customerSymptomExample: string;
  diagnosticQuestions: string[];
  solutionSteps: string[];
  repairImageUrl: string;
  repairVideoUrl: string;
  riskAfterSolution: string;
  nextPossibleProblem: string;
  nextSolutionSteps: string[];
  whenToEscalate: string;
  escalationMessage: string;
  priority: 'high' | 'medium' | 'low';
  active: boolean;
};

export type SimpleSupportKnowledgeItem = {
  category: string;
  brand: string;
  model: string;
  modelFamily: string;
  problem: string;
  symptoms: string[];
  solutionSteps: string[];
  nextIfNotSolved: string;
  escalationMessage: string;
  imageUrl: string;
  videoUrl: string;
  active: boolean;
};

export type SimpleKnowledgeMatch = {
  item: SimpleSupportKnowledgeItem;
  score: number;
  matchLevel: 'model' | 'modelFamily' | 'category';
};

export type AiIntentMatch = {
  category: string;
  problem: string;
  confidence: number;
  matchedKeywords: string[];
};

export type SupportMatch = {
  matched: boolean;
  category: string;
  solution: string;
  escalationMessage: string;
  matchedKeyword?: string;
  score: number;
};

export type ChatApiResponse = {
  role: 'assistant';
  ticketId: string;
  category: string;
  issue: string;
  solution: string;
  nextSteps: string;
  supportNotice: string;
  supportLink: string;
  language: ReplyLanguage;
  matched: boolean;
  understood: boolean;
  ticketContext?: Partial<LocalSupportTicket>;
  content: string;
};

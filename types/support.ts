export type ReplyLanguage = 'en' | 'bn';

export type LocalTicketStatus = 'AI_HANDLED';

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
};

export type LocalSupportTicket = {
  ticketId: string;
  customerName: string;
  customerContact: string;
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
  category: string;
  issue: string;
  solution: string;
  status: LocalTicketStatus;
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

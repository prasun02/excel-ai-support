import type { LocalSupportTicket, SupportChatMessage } from '@/types/support';

const TICKETS_KEY = 'supportTickets';
const ACTIVE_TICKET_KEY = 'activeSupportTicket';
const ACTIVE_CATEGORY_KEY = 'activeSupportCategory';

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function normalizeTicket(ticket: Partial<LocalSupportTicket>): LocalSupportTicket {
  const now = new Date().toISOString();
  const ticketId = ticket.ticketId || 'EXL-LOCAL-0000';
  const category = ticket.selectedCategory || ticket.category || 'General Support';
  const messages = Array.isArray(ticket.messages)
    ? ticket.messages
    : [];

  return {
    ticketId,
    customerName: ticket.customerName || '',
    customerContact: ticket.customerContact || '',
    selectedCategory: category,
    messages,
    issueType: ticket.issueType || '',
    currentFlowId: ticket.currentFlowId || '',
    currentQuestionIndex: ticket.currentQuestionIndex ?? ticket.currentStep ?? 0,
    currentStep: ticket.currentStep || 0,
    askedQuestions: ticket.askedQuestions || [],
    userAnswers: ticket.userAnswers || [],
    solutionGiven: Boolean(ticket.solutionGiven),
    solvedStatus: ticket.solvedStatus || 'pending',
    category,
    issue: ticket.issue || '',
    solution: ticket.solution || '',
    status: ticket.status || 'AI_HANDLED',
    createdAt: ticket.createdAt || now,
    updatedAt: ticket.updatedAt || ticket.createdAt || now,
  };
}

export function loadTickets() {
  if (!canUseStorage()) return [];

  try {
    const savedTickets = window.localStorage.getItem(TICKETS_KEY);
    const tickets = savedTickets ? (JSON.parse(savedTickets) as Partial<LocalSupportTicket>[]) : [];

    return tickets
      .map(normalizeTicket)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
}

export function saveTickets(tickets: LocalSupportTicket[]) {
  if (!canUseStorage()) return;

  window.localStorage.setItem(TICKETS_KEY, JSON.stringify(tickets));
}

export function loadActiveTicket() {
  if (!canUseStorage()) return null;

  try {
    const savedTicket = window.localStorage.getItem(ACTIVE_TICKET_KEY);

    return savedTicket ? normalizeTicket(JSON.parse(savedTicket) as Partial<LocalSupportTicket>) : null;
  } catch {
    return null;
  }
}

export function saveActiveTicket(ticket: LocalSupportTicket) {
  if (!canUseStorage()) return;

  window.localStorage.setItem(ACTIVE_TICKET_KEY, JSON.stringify(ticket));
}

export function clearActiveTicket() {
  if (!canUseStorage()) return;

  window.localStorage.removeItem(ACTIVE_TICKET_KEY);
  window.localStorage.removeItem(ACTIVE_CATEGORY_KEY);
}

export function loadActiveCategory() {
  if (!canUseStorage()) return '';

  return window.localStorage.getItem(ACTIVE_CATEGORY_KEY) || '';
}

export function saveActiveCategory(category: string) {
  if (!canUseStorage()) return;

  window.localStorage.setItem(ACTIVE_CATEGORY_KEY, category);
}

export function upsertTicket(ticket: LocalSupportTicket) {
  const tickets = loadTickets();
  const nextTickets = [
    ticket,
    ...tickets.filter((item) => item.ticketId !== ticket.ticketId),
  ];

  saveTickets(nextTickets);
  saveActiveTicket(ticket);

  return nextTickets;
}

export function appendMessagesToTicket(
  ticket: LocalSupportTicket,
  messages: SupportChatMessage[],
  updates: Partial<LocalSupportTicket> = {}
) {
  const now = new Date().toISOString();
  const nextTicket: LocalSupportTicket = {
    ...ticket,
    ...updates,
    messages: [...ticket.messages, ...messages],
    updatedAt: now,
  };

  return {
    ticket: nextTicket,
    tickets: upsertTicket(nextTicket),
  };
}

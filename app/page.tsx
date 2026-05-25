'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  FaHeadset,
  FaMicrophone,
  FaMoon,
  FaPaperPlane,
  FaPlus,
  FaRegCircle,
  FaShieldAlt,
  FaSun,
  FaTools,
  FaWifi,
} from 'react-icons/fa';
import {
  analyzeSupportMessage,
  escalationLocationReply,
  isHumanHelpRequest,
  nonSupportReply,
} from '@/lib/languageUnderstanding';
import { isProductInfoSkip, parseProductInfo } from '@/lib/productInfoParser';
import {
  appendMessagesToTicket,
  clearActiveTicket,
  loadActiveCategory,
  loadActiveTicket,
  loadTickets,
  saveActiveCategory,
  upsertTicket,
} from '@/lib/ticketStorage';
import type { ChatApiResponse, LocalSupportTicket, ReplyLanguage, SupportChatMessage } from '@/types/support';
import { detectLanguage, hasBangla } from '@/utils/text';
import { generateTicketId } from '@/utils/ticket';

type SupportCategory = {
  icon: typeof FaWifi;
  label: string;
  banglaLabel?: string;
  value: string;
};

type SpeechRecognitionResultEvent = Event & {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type SpeechRecognitionConstructor = new () => {
  lang: string;
  start: () => void;
  onresult: (event: SpeechRecognitionResultEvent) => void;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const categories: SupportCategory[] = [
  { icon: FaWifi, label: 'Router / Internet', value: 'Router / Internet' },
  { icon: FaTools, label: 'Camera / DVR / NVR', value: 'Camera / DVR / NVR' },
  { icon: FaTools, label: 'Printer', value: 'Printer' },
  { icon: FaShieldAlt, label: 'Warranty', value: 'Warranty' },
  { icon: FaTools, label: 'UPS / Inverter', value: 'UPS / Inverter' },
  {
    icon: FaHeadset,
    label: 'New Product Purchase',
    banglaLabel: '???? ???? ????',
    value: 'New Product Purchase',
  },
  { icon: FaHeadset, label: 'Other Product', value: 'General' },
];

const categoryAliases: Record<string, string> = {
  '1': 'Router / Internet',
  r: 'Router / Internet',
  router: 'Router / Internet',
  internet: 'Router / Internet',
  wifi: 'Router / Internet',
  '2': 'Camera / DVR / NVR',
  c: 'Camera / DVR / NVR',
  camera: 'Camera / DVR / NVR',
  dvr: 'Camera / DVR / NVR',
  nvr: 'Camera / DVR / NVR',
  '3': 'Printer',
  p: 'Printer',
  printer: 'Printer',
  print: 'Printer',
  '4': 'Warranty',
  w: 'Warranty',
  warranty: 'Warranty',
  '5': 'UPS / Inverter',
  u: 'UPS / Inverter',
  ups: 'UPS / Inverter',
  inverter: 'UPS / Inverter',
  '6': 'New Product Purchase',
  n: 'New Product Purchase',
  new: 'New Product Purchase',
  buy: 'New Product Purchase',
  purchase: 'New Product Purchase',
  sales: 'New Product Purchase',
  dealer: 'New Product Purchase',
  '7': 'General',
  o: 'General',
  other: 'General',
  general: 'General',
  support: 'General',
};

function getThemeSnapshot() {
  if (typeof window === 'undefined') {
    return true;
  }

  const savedTheme = window.localStorage.getItem('theme');

  if (savedTheme) {
    return savedTheme === 'dark';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function subscribeTheme(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('theme-change', callback);

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', callback);

  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('theme-change', callback);
    mediaQuery.removeEventListener('change', callback);
  };
}

function makeMessage(role: SupportChatMessage['role'], content: string): SupportChatMessage {
  return {
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

function getCategoryByValue(value: string) {
  return categories.find((category) => category.value === value || category.label === value) || null;
}

function getCategoryFromShortcut(message: string) {
  const text = message.trim().toLowerCase();
  const directMatch = categoryAliases[text];

  if (directMatch) {
    return getCategoryByValue(directMatch);
  }

  return categories.find((category) => {
    const label = category.label.toLowerCase();
    const value = category.value.toLowerCase();
    const banglaLabel = category.banglaLabel || '';

    return (
      label.includes(text) ||
      value.includes(text) ||
      text.includes(label) ||
      text.includes(value) ||
      Boolean(banglaLabel && (message.includes(banglaLabel) || banglaLabel.includes(message)))
    );
  }) || null;
}

function getCategoryFromMessage(message: string) {
  const shortcutCategory = getCategoryFromShortcut(message);

  if (shortcutCategory) return shortcutCategory;

  const analysis = analyzeSupportMessage(message);

  return analysis.category ? getCategoryByValue(analysis.category) : null;
}

function categoryChoicePrompt(language: ReplyLanguage) {
  return language === 'bn'
    ? '??????? ??? ???? ??????? ????????? ???????? ?????'
    : 'Please select a service category.';
}

function isPurchaseCategory(category: string) {
  return category === 'New Product Purchase';
}

function shouldShowCategoryChoices(message: SupportChatMessage) {
  return (
    message.role === 'assistant' &&
    (message.content === categoryChoicePrompt('en') || message.content === categoryChoicePrompt('bn'))
  );
}

function categorySelectedMessage(category: string, language: ReplyLanguage) {
  const selectedText =
    language === 'bn'
      ? '???? ' + category + ' ????????? ???????? ???????'
      : `You selected ${category}.`;

  return `${selectedText}\n\n${
    language === 'bn'
      ? '??????? ??? ??? ????? ???????? ????? ?? ?????'
      : 'Please write or tell your issue now.'
  }`;
}

function purchaseSetupMessage(language: ReplyLanguage) {
  return language === 'bn'
    ? '???? ?????? ???? ??????? ??? ????? ????????? ?????? ?????? ???? ???? ?????? ????????? ???? ???????? ??????? ???? ??????? ???? ?????? ????'
    : 'For product purchase support, please mention your desired location. Then we can help connect you with the appropriate sales contact person.';
}

function isTechnicalCategory(category: string) {
  return Boolean(category && category !== 'New Product Purchase');
}

function optionalProductInfoMessage(language: ReplyLanguage) {
  return language === 'bn'
    ? '????? ???? ????? ??????? ??? ???????? ???? ??? ??????? ?????/SN ?????? ??? ?? ????? ????? ??? ?????? ???????? ????? ??????'
    : 'Please share your device model and serial number/SN if available. If you do not have it now, you may skip and write your problem directly.';
}

function productInfoSavedMessage(language: ReplyLanguage) {
  return language === 'bn'
    ? '???????? ????? ?????? ???? ??????? ??? ?????? ??????? ??? ???? ?? ???????? ??????? ?? ??????'
    : 'Thank you. Your product information has been noted. Please write the problem you are facing.';
}

function productInfoSkippedMessage(language: ReplyLanguage) {
  return language === 'bn'
    ? '??? ???? ??????? ??? ????? ???????? ????? ?? ?????'
    : 'No problem. Please write or tell your issue now.';
}

function createTicketFromApiResponse(
  data: ChatApiResponse,
  messages: SupportChatMessage[],
  customerName: string,
  customerContact: string
): LocalSupportTicket {
  const now = new Date().toISOString();

  return {
    ticketId: data.ticketId,
    customerName,
    customerContact,
    productModel: data.ticketContext?.productModel || '',
    serialNumber: data.ticketContext?.serialNumber || '',
    productInfoAsked: Boolean(data.ticketContext?.productInfoAsked),
    selectedCategory: data.category,
    messages,
    issueType: data.ticketContext?.issueType || '',
    currentFlowId: data.ticketContext?.currentFlowId || '',
    currentQuestionIndex: data.ticketContext?.currentQuestionIndex ?? data.ticketContext?.currentStep ?? 0,
    currentStep: data.ticketContext?.currentStep || 0,
    askedQuestions: data.ticketContext?.askedQuestions || [],
    userAnswers: data.ticketContext?.userAnswers || [],
    solutionGiven: Boolean(data.ticketContext?.solutionGiven),
    solvedStatus: data.ticketContext?.solvedStatus || 'pending',
    awaitingLocation: Boolean(data.ticketContext?.awaitingLocation),
    escalationActive: Boolean(data.ticketContext?.escalationActive),
    escalationCompleted: Boolean(data.ticketContext?.escalationCompleted),
    category: data.category,
    issue: data.issue,
    solution: data.solution,
    status: 'AI_HANDLED',
    createdAt: now,
    updatedAt: now,
  };
}

function createAutoTicket(
  category: string,
  messages: SupportChatMessage[],
  customerName: string,
  customerContact: string
): LocalSupportTicket {
  const now = new Date().toISOString();

  return {
    ticketId: generateTicketId(),
    customerName,
    customerContact,
    productModel: '',
    serialNumber: '',
    productInfoAsked: false,
    selectedCategory: category || 'General Support',
    messages,
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
    category: category || 'General Support',
    issue: '',
    solution: '',
    status: 'AI_HANDLED',
    createdAt: now,
    updatedAt: now,
  };
}

function WelcomeCard({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className="flex min-h-full items-center justify-center px-2 py-8">
      <div
        className={`w-full max-w-2xl rounded-xl border p-8 text-center shadow-xl ${
          isDarkMode
            ? 'border-slate-800 bg-[#111827] shadow-black/30'
            : 'border-slate-200 bg-white shadow-slate-200/80'
        }`}
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
          <FaHeadset className="text-2xl" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-normal sm:text-3xl">
          <span className="block">Excel Service AI</span>
          <span className="block text-lg font-medium text-blue-500 sm:text-xl">Prototype v1.5A</span>
        </h2>
        <p lang="bn" className={`mt-2 text-lg bangla-text ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
          {'?????? ??????? ????? ????????'}
        </p>
        <div className={`mx-auto mt-5 max-w-xl space-y-2 text-sm leading-6 sm:text-base ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          <p>Internal Smart Support Prototype</p>
          <p>Select a service category or type your problem to begin.</p>
          <p lang="bn" className="bangla-text">{'??????? ???? ???? ???? ????????? ???????? ???? ???? ????? ???????? ??????'}</p>
        </div>
        <div className={`mx-auto mt-6 inline-flex rounded-lg border px-4 py-2 text-sm ${isDarkMode ? 'border-slate-700 bg-[#172033] text-slate-300' : 'border-blue-100 bg-blue-50 text-blue-800'}`}>
          The system will reply in the language you use.
          <span lang="bn" className="ml-2 bangla-text">{'????????? ????? ??????? ????? ????? ?????'}</span>
        </div>
      </div>
    </div>
  );
}

function TypingText({ text }: { text: string }) {
  const [visibleText, setVisibleText] = useState('');

  useEffect(() => {
    let interval: number | undefined;
    let timeout: number | undefined;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      timeout = window.setTimeout(() => {
        setVisibleText(text);
      }, 0);

      return () => window.clearTimeout(timeout);
    }

    let index = 0;
    timeout = window.setTimeout(() => {
      setVisibleText('');

      interval = window.setInterval(() => {
        index += 2;
        setVisibleText(text.slice(0, index));

        if (index >= text.length && interval) {
          window.clearInterval(interval);
        }
      }, 12);
    }, 12);

    return () => {
      window.clearTimeout(timeout);

      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [text]);

  return (
    <>
      {visibleText}
      {visibleText.length < text.length && (
        <span className="ml-0.5 inline-block h-4 w-1 translate-y-0.5 animate-pulse rounded-full bg-current" />
      )}
    </>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<LocalSupportTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<LocalSupportTicket | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SupportCategory | null>(null);
  const [requesterName, setRequesterName] = useState('');
  const [requesterContact, setRequesterContact] = useState('');
  const [awaitingCategorySelection, setAwaitingCategorySelection] = useState(false);
  const isDarkMode = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    () => true
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedTickets = loadTickets();
      const restoredTicket = loadActiveTicket();
      const restoredCategory = getCategoryByValue(loadActiveCategory());

      setTickets(storedTickets);

      if (restoredTicket) {
        setActiveTicket(restoredTicket);
        setMessages(restoredTicket.messages);
        setRequesterName(restoredTicket.customerName);
        setRequesterContact(restoredTicket.customerContact);
        setSelectedCategory(getCategoryByValue(restoredTicket.selectedCategory || restoredTicket.category));
      } else {
        setActiveTicket(null);
        setSelectedCategory(restoredCategory);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [messages, loading]);

  function setTicketState(ticket: LocalSupportTicket, nextTickets?: LocalSupportTicket[]) {
    const category = getCategoryByValue(ticket.selectedCategory || ticket.category);

    setActiveTicket(ticket);
    setTickets(nextTickets || upsertTicket(ticket));
    setSelectedCategory(category);

    if (category) {
      saveActiveCategory(category.value);
    }
  }

  function toggleTheme() {
    window.localStorage.setItem('theme', isDarkMode ? 'light' : 'dark');
    window.dispatchEvent(new Event('theme-change'));
  }

  async function requestSupportAnswer(
    issue: string,
    baseMessages: SupportChatMessage[],
    ticket: LocalSupportTicket | null,
    preferredCategory: string
  ) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [makeMessage('user', issue)],
        category: preferredCategory,
        ticketId: ticket?.ticketId,
        ticketContext: ticket,
        requesterName,
        requesterContact,
      }),
    });

    if (!res.ok) {
      throw new Error('Support request failed');
    }

    const data = (await res.json()) as ChatApiResponse;
    const assistantMessage = makeMessage('assistant', data.content);
    const nextMessages = [...baseMessages, assistantMessage];

    if (ticket) {
      const unsavedBaseMessages = baseMessages.slice(ticket.messages.length);
      const saved = appendMessagesToTicket(ticket, [...unsavedBaseMessages, assistantMessage], {
        customerName: requesterName,
        customerContact: requesterContact,
        productModel: data.ticketContext?.productModel || ticket.productModel,
        serialNumber: data.ticketContext?.serialNumber || ticket.serialNumber,
        productInfoAsked: data.ticketContext?.productInfoAsked ?? ticket.productInfoAsked,
        selectedCategory: data.category,
        category: data.category,
        issueType: data.ticketContext?.issueType || ticket.issueType,
        currentFlowId: data.ticketContext?.currentFlowId || ticket.currentFlowId,
        currentQuestionIndex: data.ticketContext?.currentQuestionIndex ?? ticket.currentQuestionIndex,
        currentStep: data.ticketContext?.currentStep ?? ticket.currentStep,
        askedQuestions: data.ticketContext?.askedQuestions || ticket.askedQuestions,
        userAnswers: data.ticketContext?.userAnswers || ticket.userAnswers,
        solutionGiven: data.ticketContext?.solutionGiven ?? ticket.solutionGiven,
        solvedStatus: data.ticketContext?.solvedStatus || ticket.solvedStatus,
        awaitingLocation: data.ticketContext?.awaitingLocation ?? ticket.awaitingLocation,
        escalationActive: data.ticketContext?.escalationActive ?? ticket.escalationActive,
        escalationCompleted: data.ticketContext?.escalationCompleted ?? ticket.escalationCompleted,
        issue: ticket.issue || data.issue,
        solution: data.solution,
      });

      setTicketState(saved.ticket, saved.tickets);
    } else {
      const newTicket = createTicketFromApiResponse(
        data,
        nextMessages,
        requesterName,
        requesterContact
      );
      setTicketState(newTicket);
    }

    setMessages(nextMessages);
    setAwaitingCategorySelection(false);

    void fetch('/api/questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ticketId: data.ticketId,
        category: data.category,
        question: issue,
        language: hasBangla(issue) ? 'bn' : 'en',
        understood: data.understood,
      }),
    }).catch((error) => {
      console.error('Question log failed:', error);
    });
  }

  function chooseCategory(category: SupportCategory) {
    if (loading) return;

    const language: ReplyLanguage = 'en';
    const userMessage = makeMessage('user', category.label);
    const shouldAskProductInfo =
      isTechnicalCategory(category.value) && !activeTicket?.productInfoAsked;
    const assistantMessage = makeMessage(
      'assistant',
      isPurchaseCategory(category.value)
        ? `You selected ${category.value}.\n\n${purchaseSetupMessage(language)}`
        : shouldAskProductInfo
          ? `You selected ${category.value}.\n\n${optionalProductInfoMessage(language)}`
          : categorySelectedMessage(category.value, language)
    );
    const nextMessages = [...messages, userMessage, assistantMessage];

    setSelectedCategory(category);
    saveActiveCategory(category.value);
    setMessages(nextMessages);

    if (activeTicket) {
      const saved = appendMessagesToTicket(activeTicket, [userMessage, assistantMessage], {
        selectedCategory: category.value,
        category: category.value,
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
        productInfoAsked: activeTicket.productInfoAsked || isTechnicalCategory(category.value),
        customerName: requesterName,
        customerContact: requesterContact,
      });
      setTicketState(saved.ticket, saved.tickets);
      return;
    }

    const ticket = createAutoTicket(category.value, nextMessages, requesterName, requesterContact);
    setTicketState({
      ...ticket,
      productInfoAsked: shouldAskProductInfo,
    });
    setAwaitingCategorySelection(false);
  }

  async function submitMessage(content: string) {
    const trimmedContent = content.trim();

    if (!trimmedContent || loading) return;

    const userMessage = makeMessage('user', trimmedContent);
    const language = detectLanguage(trimmedContent);
    const analysis = analyzeSupportMessage(trimmedContent);
    const currentMessages = [...messages, userMessage];
    let workingTicket = activeTicket;

    setInput('');
    setMessages((current) => [...current, userMessage]);
    setLoading(true);

    try {
      if (!workingTicket) {
        workingTicket = createAutoTicket('', [], requesterName, requesterContact);
        setTicketState(workingTicket);
      }

      const currentCategory = selectedCategory?.value || workingTicket.selectedCategory || workingTicket.category;
      const hasRealCategory = Boolean(currentCategory && currentCategory !== 'General Support');
      const productInfo = parseProductInfo(trimmedContent);

      if (productInfo.hasProductInfo && !analysis.issueType) {
        const assistantMessage = makeMessage('assistant', productInfoSavedMessage(language));
        const saved = appendMessagesToTicket(workingTicket, [userMessage, assistantMessage], {
          customerName: requesterName,
          customerContact: requesterContact,
          productModel: productInfo.model || workingTicket.productModel,
          serialNumber: productInfo.serialNumber || workingTicket.serialNumber,
          productInfoAsked: true,
        });

        setTicketState(saved.ticket, saved.tickets);
        setMessages([...messages, userMessage, assistantMessage]);
        setAwaitingCategorySelection(false);
        return;
      }

      if (
        hasRealCategory &&
        isTechnicalCategory(currentCategory) &&
        workingTicket.productInfoAsked &&
        !workingTicket.currentFlowId &&
        !workingTicket.issueType &&
        isProductInfoSkip(trimmedContent) &&
        !analysis.issueType
      ) {
        const assistantMessage = makeMessage('assistant', productInfoSkippedMessage(language));
        const saved = appendMessagesToTicket(workingTicket, [userMessage, assistantMessage], {
          customerName: requesterName,
          customerContact: requesterContact,
          productInfoAsked: true,
        });

        setTicketState(saved.ticket, saved.tickets);
        setMessages([...messages, userMessage, assistantMessage]);
        setAwaitingCategorySelection(false);
        return;
      }

      if (!hasRealCategory || awaitingCategorySelection) {
        const shortcutCategory = getCategoryFromShortcut(trimmedContent);
        const detectedCategory = shortcutCategory || getCategoryFromMessage(trimmedContent);

        if (isHumanHelpRequest(trimmedContent)) {
          const assistantMessage = makeMessage('assistant', escalationLocationReply(language));
          const saved = appendMessagesToTicket(workingTicket, [userMessage, assistantMessage], {
            customerName: requesterName,
            customerContact: requesterContact,
            solvedStatus: 'not_solved',
            awaitingLocation: true,
            escalationActive: true,
            escalationCompleted: false,
          });

          setTicketState(saved.ticket, saved.tickets);
          setMessages([...messages, userMessage, assistantMessage]);
          setAwaitingCategorySelection(false);
          return;
        }

        if (analysis.isNonSupport || (!analysis.isSupportRelated && !detectedCategory)) {
          const assistantMessage = makeMessage('assistant', nonSupportReply(language));
          const saved = appendMessagesToTicket(workingTicket, [userMessage, assistantMessage], {
            customerName: requesterName,
            customerContact: requesterContact,
          });

          setTicketState(saved.ticket, saved.tickets);
          setMessages([...messages, userMessage, assistantMessage]);
          setAwaitingCategorySelection(false);
          return;
        }

        if (!detectedCategory) {
          const assistantMessage = makeMessage('assistant', categoryChoicePrompt(language));
          const saved = appendMessagesToTicket(workingTicket, [userMessage, assistantMessage], {
            customerName: requesterName,
            customerContact: requesterContact,
          });

          setTicketState(saved.ticket, saved.tickets);
          setMessages([...messages, userMessage, assistantMessage]);
          setAwaitingCategorySelection(true);
          return;
        }

        if (shortcutCategory && !analysis.issueType) {
          const assistantText = isPurchaseCategory(shortcutCategory.value)
            ? `${categorySelectedMessage(shortcutCategory.value, language)}\n\n${purchaseSetupMessage(language)}`
            : workingTicket.productInfoAsked
              ? categorySelectedMessage(shortcutCategory.value, language)
              : `${categorySelectedMessage(shortcutCategory.value, language)}\n\n${optionalProductInfoMessage(language)}`;
          const assistantMessage = makeMessage('assistant', assistantText);
          const saved = appendMessagesToTicket(workingTicket, [userMessage, assistantMessage], {
            selectedCategory: shortcutCategory.value,
            category: shortcutCategory.value,
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
            productInfoAsked: workingTicket.productInfoAsked || isTechnicalCategory(shortcutCategory.value),
            customerName: requesterName,
            customerContact: requesterContact,
          });

          setSelectedCategory(shortcutCategory);
          saveActiveCategory(shortcutCategory.value);
          setAwaitingCategorySelection(false);
          setTicketState(saved.ticket, saved.tickets);
          setMessages([...messages, userMessage, assistantMessage]);
          return;
        }

        await requestSupportAnswer(
          trimmedContent,
          currentMessages,
          workingTicket,
          detectedCategory.value
        );
        return;
      }

      await requestSupportAnswer(
        trimmedContent,
        currentMessages,
        workingTicket,
        currentCategory
      );
    } catch (error) {
      console.error(error);
      setMessages((current) => [
        ...current,
        makeMessage(
          'assistant',
          hasBangla(trimmedContent)
            ? '??????, support service ?????????? unavailable. ???? ??? ???? ?????? ?????'
            : 'Sorry, support is temporarily unavailable. Please try again in a moment.'
        ),
      ]);
    } finally {
      setLoading(false);
    }
  }
  function startNewCustomer() {
    clearActiveTicket();

    setActiveTicket(null);
    setSelectedCategory(null);
    setInput('');
    setMessages([]);
    setAwaitingCategorySelection(false);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    await submitMessage(input);
  }

  function startVoiceInput() {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Voice recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = 'bn-BD';
    recognition.start();

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };
  }

  const shellClass = isDarkMode
    ? 'bg-[#0B0F19] text-slate-100'
    : 'bg-[#F3F6FA] text-slate-950';
  const panelClass = isDarkMode
    ? 'border-slate-800 bg-[#111827]'
    : 'border-slate-200 bg-white';
  const mutedTextClass = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const subtleSurfaceClass = isDarkMode
    ? 'border-slate-800 bg-[#172033]'
    : 'border-slate-200 bg-slate-50';
  const inputClass = isDarkMode
    ? 'border-slate-700 bg-[#172033] text-white placeholder:text-slate-500'
    : 'border-slate-300 bg-slate-50 text-slate-950 placeholder:text-slate-400';

  return (
    <main className={`h-[100dvh] overflow-hidden ${shellClass}`}>
      <div className="flex h-full flex-col">
        <header
          className={`flex min-h-20 items-center justify-between border-b px-4 py-4 sm:px-6 ${panelClass}`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-white ring-1 ring-slate-200">
              <Image
                src="/logo.png"
                alt="Excel Logo"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-normal sm:text-2xl">
                Excel Service AI
              </h1>
              <div className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${mutedTextClass}`}>
                <FaRegCircle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
                <span>Prototype v1.5A</span>
                <span className="hidden sm:inline">·</span>
                <span>Internal Smart Support Prototype</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startNewCustomer}
              className={`hidden h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition sm:flex ${subtleSurfaceClass}`}
            >
              <FaPlus />
              New Customer
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDarkMode ? 'Light mode' : 'Dark mode'}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg border transition ${
                isDarkMode
                  ? 'border-slate-700 bg-[#172033] text-amber-300 hover:bg-[#202C45]'
                  : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {isDarkMode ? <FaSun /> : <FaMoon />}
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className={`hidden min-h-0 overflow-y-auto border-r p-5 lg:block ${panelClass}`}>
            <div className="mb-6">
              <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${mutedTextClass}`}>
                Current Session
              </p>
              <div className={`mt-3 rounded-lg border p-4 ${subtleSurfaceClass}`}>
                <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${mutedTextClass}`}>
                  Current Ticket No.
                </p>
                <p className="mt-1 font-semibold">
                  Ticket No: {activeTicket?.ticketId || 'No ticket yet'}
                </p>
                <p className={`mt-4 text-xs font-semibold uppercase tracking-[0.14em] ${mutedTextClass}`}>
                  Users Amount
                </p>
                <p className="mt-1 text-2xl font-semibold">{Math.max(tickets.length, activeTicket ? 1 : 0)}</p>
                {(activeTicket?.productModel || activeTicket?.serialNumber) && (
                  <div className={`mt-3 space-y-1 border-t pt-3 text-sm ${mutedTextClass}`}>
                    {activeTicket.productModel && <p>Model: {activeTicket.productModel}</p>}
                    {activeTicket.serialNumber && <p>SN: {activeTicket.serialNumber}</p>}
                  </div>
                )}
              </div>
            </div>

            <div className="mb-6">
              <p className={`mb-3 text-xs font-semibold uppercase tracking-[0.14em] ${mutedTextClass}`}>
                Categories
              </p>
              <div className="space-y-2">
                {categories.map((category) => {
                  const CategoryIcon = category.icon;
                  const isSelected = selectedCategory?.value === category.value;

                  return (
                    <button
                      key={category.value}
                      type="button"
                      onClick={() => chooseCategory(category)}
                      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                        isSelected
                          ? 'border-blue-500 bg-blue-600 text-white'
                          : isDarkMode
                            ? 'border-slate-800 bg-[#172033] hover:border-slate-700 hover:bg-[#202C45]'
                            : 'border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-blue-50'
                      }`}
                    >
                      <CategoryIcon />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{category.label}</span>
                        {category.banglaLabel && (
                          <span className="block truncate text-xs opacity-80">{category.banglaLabel}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

          </aside>

          <section className="flex min-h-0 flex-col">
            <div className={`flex gap-2 overflow-x-auto border-b px-4 py-3 lg:hidden ${panelClass}`}>
              {categories.map((category) => {
                const CategoryIcon = category.icon;
                const isSelected = selectedCategory?.value === category.value;

                return (
                  <button
                    key={category.value}
                    type="button"
                    onClick={() => chooseCategory(category)}
                    className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : isDarkMode
                          ? 'border-slate-800 bg-[#172033] text-slate-100'
                          : 'border-slate-200 bg-white text-slate-800'
                    }`}
                  >
                    <CategoryIcon className={isSelected ? 'text-white' : 'text-blue-500'} />
                    <span className="whitespace-nowrap">
                      {category.label}
                      {category.banglaLabel ? ` / ${category.banglaLabel}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              <div className="mx-auto flex min-h-full max-w-4xl flex-col">
                {messages.length === 0 ? (
                  <WelcomeCard isDarkMode={isDarkMode} />
                ) : (
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <div
                        key={`${message.createdAt || 'message'}-${index}`}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[min(42rem,90%)] whitespace-pre-line rounded-lg border px-4 py-3 text-sm leading-6 shadow-sm sm:text-base ${
                            message.role === 'user'
                              ? 'border-blue-500 bg-blue-600 text-white'
                              : isDarkMode
                                ? 'border-slate-800 bg-[#172033] text-slate-100'
                                : 'border-slate-200 bg-white text-slate-800'
                          }`}
                        >
                          {message.role === 'assistant' ? (
                            <TypingText text={message.content} />
                          ) : (
                            message.content
                          )}
                          {shouldShowCategoryChoices(message) && (
                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                              {categories.map((category) => {
                                const CategoryIcon = category.icon;

                                return (
                                  <button
                                    key={category.value}
                                    type="button"
                                    onClick={() => chooseCategory(category)}
                                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                                      isDarkMode
                                        ? 'border-slate-700 bg-[#111827] hover:border-blue-400 hover:bg-[#202C45]'
                                        : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50'
                                    }`}
                                  >
                                    <CategoryIcon className="shrink-0 text-blue-500" />
                                    <span className="min-w-0">
                                      <span className="block font-medium">{category.label}</span>
                                      {category.banglaLabel && (
                                        <span className={`block truncate text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                          {category.banglaLabel}
                                        </span>
                                      )}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {loading && (
                  <div className="mt-4 flex justify-start">
                    <div
                      className={`flex max-w-xs items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-sm ${subtleSurfaceClass}`}
                    >
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.2s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.1s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500" />
                      </span>
                      AI is typing...
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className={`border-t px-4 py-4 sm:px-6 ${panelClass}`}>
              <form
                onSubmit={sendMessage}
                className="mx-auto flex max-w-4xl items-end gap-2"
              >
                <label className="sr-only" htmlFor="support-message">
                  Describe your problem
                </label>
                <textarea
                  id="support-message"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void submitMessage(input);
                    }
                  }}
                  placeholder="Describe your problem..."
                  rows={1}
                  className={`min-h-12 flex-1 resize-none rounded-lg border px-4 py-3 leading-6 outline-none transition focus:ring-2 focus:ring-blue-500 ${inputClass}`}
                />

                <button
                  type="button"
                  onClick={startVoiceInput}
                  aria-label="Start voice input"
                  title="Voice input"
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-lg border transition ${
                    isDarkMode
                      ? 'border-slate-700 bg-[#172033] text-slate-100 hover:bg-[#202C45]'
                      : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <FaMicrophone />
                </button>

                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  aria-label="Send message"
                  title="Send"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  <FaPaperPlane />
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}



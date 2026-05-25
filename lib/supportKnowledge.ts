import cameraKnowledge from '@/data/camera.json';
import generalKnowledge from '@/data/general.json';
import printerKnowledge from '@/data/printer.json';
import purchaseKnowledge from '@/data/purchase.json';
import routerKnowledge from '@/data/router.json';
import upsKnowledge from '@/data/ups.json';
import warrantyKnowledge from '@/data/warranty.json';
import type { ReplyLanguage, SupportKnowledgeItem, SupportMatch } from '@/types/support';
import { normalizeText } from '@/utils/text';

const supportKnowledge = [
  ...routerKnowledge,
  ...cameraKnowledge,
  ...printerKnowledge,
  ...upsKnowledge,
  ...warrantyKnowledge,
  ...purchaseKnowledge,
  ...generalKnowledge,
] as SupportKnowledgeItem[];

export const SUPPORT_LINK = 'https://www.excelbd.com/support/';

export const SUPPORT_NOTICE = {
  en: `The AI support service is currently upgrading. For any query, please contact your nearest Excel Customer Support Point. Visit: ${SUPPORT_LINK}`,
  bn: `AI support service বর্তমানে upgrade হচ্ছে। যেকোনো query এর জন্য nearest Excel Customer Support Point-এ যোগাযোগ করুন। Visit: ${SUPPORT_LINK}`,
};

function fallbackMatch(language: ReplyLanguage): SupportMatch {
  return {
    matched: false,
    category: 'General Support',
    solution:
      language === 'bn'
        ? 'আমি প্রশ্নটি পুরোপুরি বুঝতে পারিনি। অনুগ্রহ করে product model, serial number, problem কখন থেকে হচ্ছে এবং কোনো error message থাকলে লিখুন।'
        : 'I could not fully match this issue yet. Please share the product model, serial number, when the problem started, and any error message.',
    escalationMessage:
      language === 'bn'
        ? 'আরও detail দিলে আমি available support data থেকে better step-by-step answer দিতে পারব।'
        : 'With more details, I can check the available support data and give a better step-by-step answer.',
    score: 0,
  };
}

function scoreKeyword(message: string, keyword: string) {
  const normalizedKeyword = normalizeText(keyword);

  if (!normalizedKeyword) return 0;
  if (message === normalizedKeyword) return normalizedKeyword.length + 30;
  if (message.includes(normalizedKeyword)) return normalizedKeyword.length + 15;

  const keywordWords = normalizedKeyword.split(' ');
  const matchedWords = keywordWords.filter((word) => message.includes(word));

  return matchedWords.length > 0 ? matchedWords.length : 0;
}

function scoreCategory(message: string, category: string) {
  const normalizedCategory = normalizeText(category);
  const categoryWords = normalizedCategory
    .split(' ')
    .filter((word) => word.length > 2 && word !== 'dvr' && word !== 'nvr');

  if (message.includes(normalizedCategory)) return normalizedCategory.length + 20;

  return categoryWords.filter((word) => message.includes(word)).length * 4;
}

function findCategoryFallback(categoryHint: string | undefined, language: ReplyLanguage) {
  if (!categoryHint) return null;

  const normalizedHint = normalizeText(categoryHint);
  const fallback = supportKnowledge.find(
    (item) => normalizeText(item.category) === normalizedHint
  );

  if (!fallback) return null;

  return {
    matched: true,
    category: fallback.category,
    solution: fallback.solution[language],
    escalationMessage: fallback.escalation_message[language],
    score: 1,
  } satisfies SupportMatch;
}

export function matchSupportKnowledge(
  message: string,
  language: ReplyLanguage,
  categoryHint?: string
): SupportMatch {
  const normalizedMessage = normalizeText(message);
  let bestMatch: (SupportKnowledgeItem & { matchedKeyword?: string; score: number }) | null = null;

  // Keep the matching local and fast so the demo has no API-key or quota dependency.
  for (const item of supportKnowledge) {
    const categoryScore = scoreCategory(normalizedMessage, item.category);

    if (categoryScore > 0 && (!bestMatch || categoryScore > bestMatch.score)) {
      bestMatch = {
        ...item,
        matchedKeyword: item.category,
        score: categoryScore,
      };
    }

    for (const keyword of item.keywords) {
      const score = scoreKeyword(normalizedMessage, keyword);

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          ...item,
          matchedKeyword: keyword,
          score,
        };
      }
    }
  }

  if (!bestMatch || bestMatch.score < 3) {
    return findCategoryFallback(categoryHint, language) || fallbackMatch(language);
  }

  return {
    matched: true,
    category: bestMatch.category,
    solution: bestMatch.solution[language],
    escalationMessage: bestMatch.escalation_message[language],
    matchedKeyword: bestMatch.matchedKeyword,
    score: bestMatch.score,
  };
}

export function getSupportKnowledge() {
  return supportKnowledge;
}

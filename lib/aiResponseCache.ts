import 'server-only';

import type { UniversalSupportAnswer } from '@/lib/universalSupportFallbacks';

type CachedAiResponse = {
  answer: UniversalSupportAnswer;
  expiresAt: number;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, CachedAiResponse>();

export function buildAiResponseCacheKey(input: {
  category?: string;
  detectedProblem?: string;
  productName?: string;
  message: string;
}) {
  return [
    normalizeForCache(input.category || ''),
    normalizeForCache(input.detectedProblem || ''),
    normalizeForCache(input.productName || ''),
    normalizeForCache(input.message),
  ].join('|');
}

export function getCachedAiResponse(key: string) {
  const cached = cache.get(key);

  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return cached.answer;
}

export function setCachedAiResponse(key: string, answer: UniversalSupportAnswer) {
  cache.set(key, {
    answer,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function normalizeForCache(value: string) {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s./]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

import type { ReplyLanguage } from '@/types/support';

export function hasBangla(value: string) {
  return /[\u0980-\u09FF]/.test(value);
}

export function detectLanguage(value: string): ReplyLanguage {
  return hasBangla(value) ? 'bn' : 'en';
}

export function normalizeText(value: string) {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[।,.;:!?()[\]{}"'`~|\\/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

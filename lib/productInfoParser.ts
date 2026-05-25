export type ProductInfoResult = {
  model: string;
  serialNumber: string;
  hasProductInfo: boolean;
};

const MODEL_LABEL_PATTERN = /\b(?:model|mdl|product model)\s*[:#-]?\s*([a-z0-9][a-z0-9._/-]*(?:\s+[a-z0-9][a-z0-9._/-]*){0,3})/i;
const SERIAL_LABEL_PATTERN = /\b(?:serial number|serial no|serial|sn|s\/n)\s*[:#-]?\s*([a-z0-9-]{5,})/i;
const COMPACT_MODEL_PATTERN = /\b(?:archer|tp-link|tplink|d-link|hikvision|ds-|wr|c|tl-|rt-|ups|dvr|nvr)[a-z0-9._/-]*(?:\s+[a-z0-9._/-]+){0,2}\b/i;
const SERIAL_LIKE_PATTERN = /\b(?=[a-z0-9-]*\d)(?=[a-z0-9-]*[a-z])[a-z0-9-]{8,}\b/i;
const NUMERIC_SERIAL_PATTERN = /\b\d{8,}\b/;

function cleanValue(value = '') {
  return value
    .replace(/\b(?:sn|s\/n|serial|serial no|serial number|problem|issue)\b.*$/i, '')
    .replace(/[,:;]+$/g, '')
    .trim();
}

export function parseProductInfo(message: string): ProductInfoResult {
  const modelMatch = message.match(MODEL_LABEL_PATTERN);
  const serialMatch = message.match(SERIAL_LABEL_PATTERN);
  const compactModelMatch = message.match(COMPACT_MODEL_PATTERN);
  const serialLikeMatch = message.match(SERIAL_LIKE_PATTERN);
  const numericSerialMatch = message.match(NUMERIC_SERIAL_PATTERN);

  const serialNumber = cleanValue(serialMatch?.[1] || serialLikeMatch?.[0] || numericSerialMatch?.[0] || '');
  const rawModel = cleanValue(modelMatch?.[1] || compactModelMatch?.[0] || '');
  const model = serialNumber ? cleanValue(rawModel.replace(serialNumber, '')) : rawModel;

  return {
    model,
    serialNumber,
    hasProductInfo: Boolean(model || serialNumber),
  };
}

export function isProductInfoSkip(message: string) {
  const text = message.trim().toLowerCase();

  return [
    'skip',
    "don't have",
    'dont have',
    'do not have',
    'no',
    'nai',
    'nei',
    'model nai',
    'sn nai',
    'serial nai',
    'নেই',
    'নাই',
    'জানি না',
    'স্কিপ',
  ].some((item) => text.includes(item));
}

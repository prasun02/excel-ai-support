export type ProductInfoResult = {
  model: string;
  hardwareVersion: string;
  serialNumber: string;
  hasProductInfo: boolean;
};

const MODEL_LABEL_PATTERN = /\b(?:model|mdl|product model)\s*[:#-]?\s*([a-z0-9][a-z0-9._/-]*(?:\s+[a-z0-9][a-z0-9._/-]*){0,4})/i;
const SERIAL_LABEL_PATTERN = /\b(?:serial number|serial no|serial|sn|s\/n)\s*[:#-]?\s*([a-z0-9-]{5,})/i;
const COMPACT_MODEL_PATTERN = /\b(?:tl[-\s]?[a-z0-9][a-z0-9._/-]*|wr[0-9][a-z0-9._/-]*|archer\s+[a-z0-9][a-z0-9._/-]*|deco\s+[a-z0-9][a-z0-9._/-]*|mercusys\s+[a-z0-9][a-z0-9._/-]*|ds[-\s]?[a-z0-9][a-z0-9._/-]+|(?:dvr|nvr)[-\s]?[a-z0-9][a-z0-9._/-]+|mr[-\s]?(?:spf|lbp)[a-z0-9._/-]*|l(?:8050|3210|1300|1800))\b/i;
const SERIAL_LIKE_PATTERN = /\b(?=[a-z0-9-]*\d)(?=[a-z0-9-]*[a-z])[a-z0-9-]{8,}\b/i;
const NUMERIC_SERIAL_PATTERN = /\b\d{8,}\b/;
const HARDWARE_VERSION_PATTERN = /\b(?:ver|version|v)\s*\.?\s*(\d+(?:\.\d+)?)\b/i;
const MODEL_PREFIX_PATTERN = /^(?:tl-|wr|archer|tp-link|tplink|mercusys|ds-|dvr|nvr|mr-|l8050|l3210|l1300|l1800)/i;

function cleanValue(value = '') {
  return value
    .replace(/\b(?:sn|s\/n|serial|serial no|serial number|problem|issue)\b.*$/i, '')
    .replace(/[,:;]+$/g, '')
    .trim();
}

export function parseProductInfo(message: string): ProductInfoResult {
  const modelMatch = message.match(MODEL_LABEL_PATTERN);
  const compactModelMatch = message.match(COMPACT_MODEL_PATTERN);
  const serialMatch = message.match(SERIAL_LABEL_PATTERN);
  const serialLikeMatch = !compactModelMatch ? message.match(SERIAL_LIKE_PATTERN) : null;
  const numericSerialMatch = !compactModelMatch ? message.match(NUMERIC_SERIAL_PATTERN) : null;
  const hardwareVersionMatch = message.match(HARDWARE_VERSION_PATTERN);

  const serialCandidate = cleanValue(serialMatch?.[1] || serialLikeMatch?.[0] || numericSerialMatch?.[0] || '');
  const serialNumber = MODEL_PREFIX_PATTERN.test(serialCandidate) ? '' : serialCandidate;
  const hardwareVersion = hardwareVersionMatch ? `Ver ${hardwareVersionMatch[1]}` : '';
  const rawModel = cleanValue(modelMatch?.[1] || compactModelMatch?.[0] || '');
  const modelWithoutSerial = serialNumber ? cleanValue(rawModel.replace(serialNumber, '')) : rawModel;
  const model = hardwareVersion
    ? cleanValue(modelWithoutSerial.replace(HARDWARE_VERSION_PATTERN, ''))
    : modelWithoutSerial;

  return {
    model,
    hardwareVersion,
    serialNumber,
    hasProductInfo: Boolean(model || hardwareVersion || serialNumber),
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

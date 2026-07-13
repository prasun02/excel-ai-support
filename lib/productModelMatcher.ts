import productsData from '@/data/support-knowledge/products.json';

type ProductRecord = {
  productId: string;
  itemName?: string;
  itemCode?: string;
  itemGroup?: string;
  brand?: string;
  category?: string;
  deviceType?: string;
  model?: string;
  modelFamily?: string;
  active?: boolean;
};

export type ProductMatch = {
  productId: string;
  itemName: string;
  itemCode?: string;
  brand?: string;
  category?: string;
  deviceType?: string;
  model?: string;
  modelFamily?: string;
  score: number;
  matchedBy: string[];
};

export type ProductMatchResult = {
  matches: ProductMatch[];
  bestMatch?: ProductMatch;
  confidence: 'high' | 'medium' | 'low' | 'none';
};

type ProductMatchInput = {
  text: string;
  categoryHint?: string;
  brandHint?: string;
  maxResults?: number;
};

const products = productsData as ProductRecord[];

function normalize(value: string) {
  return String(value || '')
    .normalize('NFKD')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(value: string) {
  return normalize(value).replace(/\s+/g, '');
}

function tokens(value: string) {
  return normalize(value).split(' ').filter((token) => token.length >= 2);
}

function displayName(product: ProductRecord) {
  return product.itemName || [product.brand, product.model || product.itemCode].filter(Boolean).join(' ') || product.productId;
}

function isRouterText(text: string) {
  return /(ROUTER|WIFI|WI FI|NET|INTERNET|TL WR|ARCHER|MERCUSYS)/.test(normalize(text));
}

function brandFromText(text: string) {
  const normalized = normalize(text);

  if (/TP LINK|TPLINK/.test(normalized)) return 'TP-Link';
  if (/MERCUSYS/.test(normalized)) return 'Mercusys';
  return '';
}

function scoreProduct(product: ProductRecord, input: ProductMatchInput): ProductMatch {
  const text = normalize(input.text);
  const compactText = compact(input.text);
  const textTokens = new Set(tokens(input.text));
  const brandHint = input.brandHint || brandFromText(input.text);
  const candidates = [
    product.productId,
    product.itemCode || '',
    product.model || '',
    product.itemName || '',
    product.modelFamily || '',
    product.itemGroup || '',
  ].filter(Boolean);
  const matchedBy: string[] = [];
  let score = 0;

  for (const candidate of candidates) {
    const normalizedCandidate = normalize(candidate);
    const compactCandidate = compact(candidate);

    if (!normalizedCandidate) continue;

    if (text === normalizedCandidate) {
      score += 120;
      matchedBy.push(`exact:${candidate}`);
    } else if (compactText === compactCandidate) {
      score += 110;
      matchedBy.push(`compact-exact:${candidate}`);
    } else if (compactCandidate && compactText.includes(compactCandidate)) {
      score += 85;
      matchedBy.push(`compact-text:${candidate}`);
    } else if (compactText && compactCandidate.includes(compactText) && compactText.length >= 3) {
      score += compactText.length >= 5 ? 70 : 40;
      matchedBy.push(`partial:${candidate}`);
    }

    const tokenMatches = tokens(candidate).filter((token) => textTokens.has(token));
    if (tokenMatches.length > 0) {
      score += tokenMatches.length * 12;
      matchedBy.push(`tokens:${tokenMatches.join('+')}`);
    }
  }

  if (input.categoryHint && normalize(product.category || '').includes(normalize(input.categoryHint))) score += 18;
  if (isRouterText(input.text) && normalize(product.category || '').includes('ROUTER')) score += 22;
  if (brandHint && normalize(product.brand || '') === normalize(brandHint)) score += 20;

  return {
    productId: product.productId,
    itemName: displayName(product),
    itemCode: product.itemCode,
    brand: product.brand,
    category: product.category,
    deviceType: product.deviceType,
    model: product.model,
    modelFamily: product.modelFamily,
    score,
    matchedBy: [...new Set(matchedBy)],
  };
}

function confidenceFromScore(score: number): ProductMatchResult['confidence'] {
  if (score >= 90) return 'high';
  if (score >= 45) return 'medium';
  if (score >= 20) return 'low';
  return 'none';
}

export function findBestProductMatches(input: ProductMatchInput): ProductMatchResult {
  const maxResults = input.maxResults || 3;
  const matches = products
    .filter((product) => product.active !== false)
    .map((product) => scoreProduct(product, input))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, maxResults);
  const bestMatch = matches[0];

  return {
    matches,
    bestMatch,
    confidence: bestMatch ? confidenceFromScore(bestMatch.score) : 'none',
  };
}

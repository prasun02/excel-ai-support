import { hasBangla, normalizeText } from '@/utils/text';

export type RouterProblemName =
  | 'Slow Internet'
  | 'No Internet'
  | 'Auto Disconnect'
  | 'Range Problem'
  | 'Red Light / WAN Issue'
  | 'Router Not Working'
  | 'Router Hang'
  | 'No Power'
  | 'Configuration Issue'
  | 'Unknown Router Issue';

type RouterProblemInput = {
  message: string;
};

type RouterProblemResult = {
  isRouterProblem: boolean;
  problemName: RouterProblemName;
  keywords: string[];
  language: 'en' | 'bn' | 'banglish' | 'mixed' | 'unknown';
  confidence: number;
};

const patterns: Array<{ problemName: RouterProblemName; keywords: string[] }> = [
  {
    problemName: 'Slow Internet',
    keywords: ['slow internet', 'internet slow', 'net slow', 'speed slow', 'slow speed', 'khub slow', 'khubi slow', 'slow kaj kore', 'net slow kaj kore', 'browsing slow', 'স্লো'],
  },
  {
    problemName: 'No Internet',
    keywords: ['no internet', 'internet not working', 'net kaj kore na', 'net kaj karena', 'internet nai', 'connected no internet', 'wan connected no internet', 'নেট নাই'],
  },
  {
    problemName: 'Auto Disconnect',
    keywords: ['auto disconnect', 'disconnect hoy', 'disconnect hocche', 'bar bar disconnect', 'connection drops', 'net chole jay', 'wifi chole jay', 'বার বার চলে যায়'],
  },
  {
    problemName: 'Range Problem',
    keywords: ['range problem', 'range paina', 'range pay na', 'signal kom', 'wifi range kom', 'signal weak', 'dur theke pay na', 'রেঞ্জ পাচ্ছি না'],
  },
  {
    problemName: 'Red Light / WAN Issue',
    keywords: ['red light', 'lal bati', 'lal light', 'los red', 'wan blinking', 'wan light blinking', 'internet light red', 'লাল বাতি'],
  },
  {
    problemName: 'Router Not Working',
    keywords: ['router not working', 'router kaj kore na', 'router kaj karena', 'only power light', 'no response', 'রাউটার কাজ করে না'],
  },
  {
    problemName: 'Router Hang',
    keywords: ['hang kore', 'hang kare', 'router hang', 'freeze', 'stuck', 'হ্যাং'],
  },
  {
    problemName: 'No Power',
    keywords: ['no power', 'power nai', 'light jole na', 'kono light nai', 'dead', 'পাওয়ার নাই', 'লাইট জ্বলে না'],
  },
  {
    problemName: 'Configuration Issue',
    keywords: ['setup problem', 'configure problem', 'configuration', 'pppoe', 'dynamic ip', 'password set', 'ssid', 'wifi password', 'quick setup'],
  },
];

const routerWords = ['router', 'wifi', 'wi fi', 'internet', 'net', 'wan', 'lan', 'onu', 'tplink', 'tp-link', 'mercusys', 'রাউটার', 'ওয়াইফাই', 'নেট'];
const banglishMarkers = ['kaj kore na', 'karena', 'hoy', 'hocche', 'paina', 'pay na', 'khub', 'khubi', 'jale', 'bati'];

function language(message: string): RouterProblemResult['language'] {
  const normalized = normalizeText(message);
  const bangla = hasBangla(message);
  const english = /[a-z]/i.test(message);
  const banglish = banglishMarkers.some((marker) => normalized.includes(marker));

  if (bangla && english) return 'mixed';
  if (bangla) return 'bn';
  if (banglish) return 'banglish';
  if (english) return 'en';
  return 'unknown';
}

function scoreKeyword(message: string, keyword: string) {
  const normalizedKeyword = normalizeText(keyword);

  if (!normalizedKeyword) return 0;
  if (message.includes(normalizedKeyword)) return normalizedKeyword.length > 4 ? 5 : 2;

  return normalizedKeyword
    .split(' ')
    .filter((word) => word.length > 2 && message.includes(word)).length;
}

export function detectRouterProblem(input: RouterProblemInput): RouterProblemResult {
  const normalized = normalizeText(input.message);
  const routerScore = routerWords.reduce((total, word) => total + scoreKeyword(normalized, word), 0);
  let best: { problemName: RouterProblemName; score: number; keywords: string[] } = {
    problemName: 'Unknown Router Issue',
    score: 0,
    keywords: [],
  };

  for (const pattern of patterns) {
    const matched = pattern.keywords.filter((keyword) => scoreKeyword(normalized, keyword) > 0);
    const score = matched.reduce((total, keyword) => total + scoreKeyword(normalized, keyword), 0);

    if (score > best.score) {
      best = { problemName: pattern.problemName, score, keywords: matched };
    }
  }

  const totalScore = best.score + routerScore;
  const isRouterProblem = totalScore >= 3;

  return {
    isRouterProblem,
    problemName: isRouterProblem && best.score > 0 ? best.problemName : 'Unknown Router Issue',
    keywords: best.keywords,
    language: language(input.message),
    confidence: Math.min(0.98, totalScore / 25),
  };
}

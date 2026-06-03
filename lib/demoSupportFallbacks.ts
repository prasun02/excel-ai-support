import type { SupportCategory } from '@/lib/aiSupportTypes';
import { normalizeText } from '@/utils/text';

export type DemoFallbackAnswer = {
  message: string;
  possibleCauses: string[];
  safeSteps: string[];
  nextQuestion: string;
  warning?: string;
};

const fallbackByCategory: Record<SupportCategory, DemoFallbackAnswer> = {
  'Router / Internet': {
    message: 'You may be facing a Router / Internet issue.',
    possibleCauses: [
      'Power/adapter issue',
      'ISP/ONU line instability',
      'WAN/LAN cable issue',
      'Router configuration issue',
      'Too many connected users',
    ],
    safeSteps: [
      'Restart router and ONU.',
      'Check adapter and power connection.',
      'Check ONU LOS/PON status.',
      'Test with LAN cable if possible.',
      'Move router to an open area.',
    ],
    nextQuestion: 'Is the router power light on and stable?',
  },
  'Camera / DVR / NVR': {
    message: 'You may be facing Camera / DVR / NVR -> Camera Offline / No View.',
    possibleCauses: [
      'Camera power issue',
      'LAN/PoE cable issue',
      'NVR/DVR channel configuration issue',
      'IP conflict or network issue',
      'Camera hardware issue',
    ],
    safeSteps: [
      'Check camera power/PoE.',
      'Check LAN cable and switch/NVR port.',
      'Restart camera and NVR/DVR.',
      'Check if camera appears online in device list.',
      'Test with another cable/port if possible.',
    ],
    nextQuestion: 'Is the camera getting power or showing any indicator light?',
  },
  Printer: {
    message: 'You may be facing a Printer issue.',
    possibleCauses: [
      'Cable/network connection issue',
      'Driver issue',
      'Paper/ink/toner issue',
      'Print queue stuck',
      'Hardware fault',
    ],
    safeSteps: [
      'Restart printer and computer.',
      'Check cable/WiFi connection.',
      'Check paper and ink/toner.',
      'Clear print queue.',
      'Try a test print.',
    ],
    nextQuestion: 'Is the printer connected by USB, LAN, or WiFi?',
  },
  'UPS / Inverter': {
    message: 'You may be facing a UPS / Inverter issue.',
    possibleCauses: [
      'Battery weak',
      'Overload',
      'Charging issue',
      'Input power issue',
      'Internal hardware fault',
    ],
    safeSteps: [
      'Check input power.',
      'Reduce load.',
      'Charge fully and test backup.',
      'Check battery/backup behavior.',
    ],
    nextQuestion: 'How long does backup last after full charge?',
  },
  Warranty: {
    message: 'This looks like a warranty or replacement query.',
    possibleCauses: [
      'Warranty status needs ERP/warranty portal verification',
      'Serial number or invoice may be required',
      'CSP inspection may be needed for replacement/RMA',
    ],
    safeSteps: [
      'Keep serial number ready if available.',
      'Keep purchase invoice ready if available.',
      'Contact nearest Excel CSP for verification.',
    ],
    nextQuestion: 'Do you have the product serial number or invoice available?',
    warning: 'Warranty or replacement approval cannot be confirmed by demo AI.',
  },
  'New Product Purchase': {
    message: 'This looks like a product purchase query.',
    possibleCauses: ['Product availability and price may vary by location and dealer channel'],
    safeSteps: ['Share desired location.', 'Mention product category or model.', 'Excel sales/CSP can guide availability.'],
    nextQuestion: 'Which location do you want to buy from?',
  },
  'Other Product': {
    message: 'You may be facing an Excel product support issue.',
    possibleCauses: ['Product category is unclear', 'More details are needed'],
    safeSteps: ['Share product name/model.', 'Describe what is not working.', 'Mention any error message if visible.'],
    nextQuestion: 'Which Excel product are you using?',
  },
};

const banglaFallbackByCategory: Partial<Record<SupportCategory, DemoFallbackAnswer>> = {
  'Router / Internet': {
    message: 'আপনি সম্ভবত Router / Internet সমস্যার কথা বলছেন।',
    possibleCauses: [
      'Power adapter বা socket সমস্যা',
      'ISP/ONU line সমস্যা',
      'WAN/LAN cable সমস্যা',
      'Router configuration সমস্যা',
      'অনেক user connected থাকা',
    ],
    safeSteps: [
      'Router এবং ONU restart করুন।',
      'Adapter এবং power connection check করুন।',
      'ONU LOS/PON light check করুন।',
      'সম্ভব হলে LAN cable দিয়ে test করুন।',
      'Router খোলা জায়গায় রাখুন।',
    ],
    nextQuestion: 'Router power light কি on এবং stable আছে?',
  },
};

export function getRuleBasedDemoAnswer(
  category: SupportCategory,
  problemName = '',
  message = '',
  language = 'en'
): DemoFallbackAnswer {
  const normalized = normalizeText(`${problemName} ${message}`);

  if (language === 'bn' || language === 'banglish' || language === 'mixed') {
    return banglaFallbackByCategory[category] || fallbackByCategory[category];
  }

  if (category === 'Router / Internet' && /(auto disconnect|disconnect|connection drops)/.test(normalized)) {
    return {
      message: 'You may be facing Router / Internet -> Auto Disconnect.',
      possibleCauses: [
        'Power adapter or power socket issue',
        'ISP/ONU line instability',
        'WiFi interference',
        'Too many connected users',
        'Router overheating',
        'Firmware issue',
      ],
      safeSteps: [
        'Restart router and ONU.',
        'Check adapter and power connection.',
        'Check ONU LOS/PON status.',
        'Test with LAN cable if possible.',
        'Move router to open area.',
        'Reduce connected users and test again.',
      ],
      nextQuestion: 'Does the router power light restart or turn off when the internet disconnects?',
    };
  }

  return fallbackByCategory[category];
}

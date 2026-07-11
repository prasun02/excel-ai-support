type RouterAdviceInput = {
  product?: {
    itemName?: string;
    brand?: string;
    model?: string;
  };
  problemName: string;
  message: string;
};

type RouterGuidedInput = {
  brand?: string;
  model?: string;
  hardwareVersion?: string;
  problemName?: string;
  customerHasConfirmedModel?: boolean;
};

const commonCauses = [
  'Adapter or power issue',
  'ISP/ONU line issue',
  'WAN/LAN cable issue',
  'Router configuration issue',
  'WiFi interference',
  'Too many connected users',
  'Old firmware',
  'Router overload or hardware issue',
];

const causesByProblem: Record<string, string[]> = {
  'Slow Internet': ['Too many connected users', 'WiFi interference', 'ISP/ONU line issue', 'Old firmware', 'Router overload'],
  'No Internet': ['ISP/ONU line issue', 'WAN cable issue', 'Wrong WAN configuration', 'Router overload or firmware issue'],
  'Auto Disconnect': ['Adapter or power issue', 'ISP/ONU line instability', 'WiFi interference', 'Old firmware', 'Router overheating'],
  'Range Problem': ['Router placement issue', 'WiFi interference', 'Antenna/coverage limitation', 'Old firmware', 'Too many connected users'],
  'Red Light / WAN Issue': ['ISP/ONU LOS/PON issue', 'WAN cable issue', 'Internet line issue', 'Configuration issue'],
  'Router Not Working': ['Power adapter issue', 'Firmware/configuration issue', 'Hardware issue', 'Router overload'],
  'Router Hang': ['Router overload', 'Too many connected users', 'Old firmware', 'Power adapter issue'],
  'No Power': ['Adapter issue', 'Power socket issue', 'Router hardware fault'],
  'Configuration Issue': ['Wrong ISP type', 'Wrong PPPoE username/password', 'SSID/password setup issue', 'WAN configuration issue'],
};

const safeChecks = [
  'Check router adapter and power connection',
  'Restart router and ONU',
  'Check ONU LOS/PON or internet line status',
  'Check WAN cable connection',
  'Test near router',
  'Reduce connected users and test',
  'Confirm exact model/version from backside sticker',
];

function routerIp(brand?: string) {
  const normalizedBrand = String(brand || '').toLowerCase();

  if (normalizedBrand.includes('mercusys')) return 'Mercusys router IP: 192.168.1.1.';
  if (normalizedBrand.includes('tp-link') || normalizedBrand.includes('tplink')) return 'TP-Link router IP: 192.168.0.1.';
  return 'the router login IP. If it is unknown, check default gateway.';
}

function deviceBrand(brand?: string, model?: string) {
  if (brand) return brand;
  if (/mercusys/i.test(model || '')) return 'Mercusys';
  return 'TP-Link';
}

function deviceName(input: RouterGuidedInput) {
  return [deviceBrand(input.brand, input.model), input.model].filter(Boolean).join(' ').trim() || 'Router';
}

function beforeStart(input: RouterGuidedInput) {
  if (input.model && !input.hardwareVersion) {
    return `I found your router model as ${input.model}. For firmware update, please confirm the hardware version from the backside sticker, for example Ver 4 or V4. Wrong firmware or power loss during update may damage the router. If you are unsure, please visit the nearest Excel CSP.`;
  }

  if (!input.model && !input.hardwareVersion) {
    return 'Please share your router model and hardware version from the backside sticker, or upload a clear photo of the sticker. Firmware update must not continue without exact model/version. Wrong firmware or power loss during update may damage the router. If you are unsure, please visit the nearest Excel CSP.';
  }

  return 'Firmware update must match exact model and hardware version. Wrong firmware or power loss during update may damage the router. If you are unsure, please visit the nearest Excel CSP.';
}

export function getRouterInitialAdvice(input: RouterAdviceInput) {
  const productText = input.product?.itemName
    ? ` for ${input.product.itemName}`
    : '';
  const possibleCauses = causesByProblem[input.problemName] || commonCauses;

  return {
    message: `Based on your problem${productText}, this may happen due to:`,
    possibleCauses,
    safeChecks,
    offerGuidedTroubleshooting:
      'If these checks do not solve the issue, I can share Excel guided troubleshooting process. Do you want guided troubleshooting?',
  };
}

export function getRouterGuidedProcess(input: RouterGuidedInput) {
  const hardwareVersion = input.hardwareVersion || 'Not confirmed yet';
  const ipText = routerIp(input.brand);
  const firmwareModelText = input.model
    ? `For ${input.model}, please confirm the version from the backside sticker before updating firmware.`
    : 'Please confirm exact model and hardware version from the backside sticker before updating firmware.';
  const message = [
    'Device:',
    deviceName(input),
    'Hardware Version:',
    hardwareVersion,
    '',
    'Before you start:',
    beforeStart(input),
    '',
    'Step 1: Basic safe checks',
    '',
    '1. Check the router adapter and power socket.',
    '2. Check ONU/ISP line status.',
    '3. Restart both router and ONU.',
    '4. Check WAN cable connection.',
    '5. Test near the router.',
    '6. Reduce connected users and test again.',
    '',
    'Step 2: Router reset and login',
    '',
    '1. If the basic checks do not solve the issue, reset the router by pressing the reset hole for about 5 seconds.',
    '2. Connect a PC to the router using LAN cable.',
    `3. Open browser and try ${ipText}`,
    '4. If it does not open, check the default gateway IP from your PC network settings.',
    '5. After reset, the router may ask you to create a new login password.',
    '',
    'Step 3: Firmware update caution',
    'Firmware update should be done only after confirming exact model and hardware version.',
    firmwareModelText,
    'Use only the correct official/approved firmware file.',
    'PC is recommended for firmware update. Mobile may work for login/configuration, but firmware update is safer by PC.',
    '',
    'Step 4: Router configuration',
    '',
    '1. Open Quick Setup.',
    '2. Select location if required.',
    '3. Select ISP type as per ISP instruction:',
    '   - Dynamic IP if ISP gives automatic WAN IP.',
    '   - PPPoE if ISP provides username and password.',
    '4. Set WiFi name/SSID.',
    '5. Set WiFi password.',
    '6. Finish setup and wait for connection.',
    '',
    'Step 5: Test result',
    '',
    '1. Test internet speed near the router.',
    '2. Test with one or two devices first.',
    '3. If internet works normally, reconnect other devices slowly.',
    '',
    'Final question:',
    'Did this solve your problem?',
    '',
    '- Yes, solved',
    '- No, not solved',
  ].join('\n');

  return {
    message,
    warning: beforeStart(input),
    steps: [],
    nextQuestion: 'Did this solve your problem?',
  };
}

export function getRouterFollowUpAnswer(message: string) {
  const text = message.toLowerCase();

  if (/where.*(router )?version|hardware version|where.*ver/.test(text)) {
    return 'The hardware version is usually printed on the backside sticker of the router. It may look like Ver 4.0, Ver:4, or V4.';
  }

  if (/where.*sn|where.*serial|serial number|s\/n/.test(text)) {
    return 'The serial number/SN is printed on the backside sticker of the router.';
  }

  if (/mobile/.test(text) && /(update|firmware)/.test(text)) {
    return 'You may open the router page from mobile if connected to the router WiFi, but firmware update is safer from a PC using LAN cable. If you are unsure, please visit Excel CSP.';
  }

  if (/192\.168\.0\.1.*(not opening|not open|open hocche na|kaj kore na)|not opening.*192\.168\.0\.1/.test(text)) {
    return 'Make sure your device is connected to the router. If 192.168.0.1 does not open, check the default gateway IP from your device network settings and open that IP in browser.';
  }

  if (/mercusys/.test(text) && /\bip\b|which ip|router ip/.test(text)) {
    return 'Mercusys routers usually use 192.168.1.1. But IP can vary by configuration, so if it does not open, check default gateway.';
  }

  return '';
}

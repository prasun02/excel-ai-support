export type UniversalSupportType =
  | 'universal_support_answer'
  | 'clarifying_question'
  | 'safe_checks'
  | 'escalation'
  | 'non_support';

export type UniversalSupportLanguage = 'en' | 'bn' | 'banglish' | 'mixed';

export type UniversalSupportCategory =
  | 'Router / Internet'
  | 'Camera / DVR / NVR'
  | 'Printer'
  | 'UPS / Inverter'
  | 'Warranty / RMA'
  | 'Other Product';

export type UniversalSupportRequest = {
  message: string;
  category?: string;
  detectedProduct?: string;
  detectedModel?: string;
  hardwareVersion?: string;
  language?: string;
  previousContext?: {
    currentCategory?: string;
    currentProblemName?: string;
    currentModel?: string;
    currentHardwareVersion?: string;
    activeSupportFlow?: string;
  };
};

export type UniversalSupportAnswer = {
  type: UniversalSupportType;
  language: UniversalSupportLanguage;
  category: string;
  detectedProblem: string;
  message: string;
  possibleCauses: string[];
  safeChecks: string[];
  diagnosticQuestions: string[];
  nextStep: string;
  warning?: string;
  escalationRequired?: boolean;
};

type UniversalFallbackTemplate = {
  possibleCauses: string[];
  safeChecks: string[];
  diagnosticQuestions: string[];
  nextStep: string;
  warning?: string;
};

type ProblemRule = {
  problem: string;
  keywords: string[];
};

const fallbackCatalog: Record<UniversalSupportCategory, Record<string, UniversalFallbackTemplate>> = {
  'Router / Internet': {
    'Slow Internet': {
      possibleCauses: [
        'ISP/ONU line issue',
        'WAN/LAN cable issue',
        'WiFi interference or router placement issue',
        'Too many connected devices',
        'Router overload, firmware, or hardware issue',
      ],
      safeChecks: [
        'Restart router and ONU, then wait 2 minutes',
        'Check WAN cable and ONU LOS/PON status',
        'Test speed near the router with one device',
        'Reduce connected users and test again',
        'Confirm router model and hardware version from the backside sticker',
      ],
      diagnosticQuestions: [
        'Is slow speed happening on WiFi only or also on LAN?',
        'How many devices are connected?',
        'Is ONU LOS red or PON unstable?',
        'What is the router model and hardware version?',
      ],
      nextStep: 'Please share router model and hardware version, or upload a clear backside sticker photo for safer guidance.',
    },
    'No Internet': {
      possibleCauses: [
        'ISP/ONU line issue',
        'WAN cable loose or connected to wrong port',
        'Wrong WAN/PPPoE configuration',
        'Router overload or firmware issue',
        'Router hardware issue',
      ],
      safeChecks: [
        'Restart router and ONU',
        'Check WAN cable connection',
        'Check ONU LOS/PON status',
        'Check if internet works directly from ONU if your ISP allows it',
        'Confirm router model and hardware version from the backside sticker',
      ],
      diagnosticQuestions: [
        'Is WAN/Internet light off, red, or blinking?',
        'Is ONU LOS light red?',
        'Did the issue start after reset or ISP change?',
        'What is the router model and hardware version?',
      ],
      nextStep: 'Please share the light status and router model/version so I can guide the next safe step.',
    },
    'Auto Disconnect': {
      possibleCauses: [
        'Power adapter or power socket issue',
        'ISP/ONU line instability',
        'WiFi interference',
        'Router overheating or overload',
        'Firmware or router hardware issue',
      ],
      safeChecks: [
        'Check adapter and power socket',
        'Restart router and ONU',
        'Place router in an open area',
        'Test with one device near the router',
        'Reduce connected users and test again',
      ],
      diagnosticQuestions: [
        'Does the router power light restart when internet disconnects?',
        'Does disconnect happen on all devices?',
        'Does LAN also disconnect?',
        'What is the router model and hardware version?',
      ],
      nextStep: 'If the same issue continues after safe checks, share model/version and the light behavior.',
    },
    'Range Problem': {
      possibleCauses: [
        'Router placement issue',
        'Walls, metal objects, or interference',
        '2.4GHz/5GHz coverage limitation',
        'Too many users or router overload',
        'Router hardware or antenna issue',
      ],
      safeChecks: [
        'Place router in a central open position',
        'Test beside the router first',
        'Use 2.4GHz for longer range if available',
        'Keep router away from metal objects and thick walls',
        'Restart router and reduce connected users',
      ],
      diagnosticQuestions: [
        'How far from the router does signal become weak?',
        'How many walls are between the router and device?',
        'Is the issue on 2.4GHz, 5GHz, or both?',
        'What is the router model?',
      ],
      nextStep: 'Please share the area size, wall count, and router model for better range guidance.',
    },
    'Router Not Working': {
      possibleCauses: [
        'Power adapter or power socket issue',
        'ONU/ISP line issue',
        'WAN/LAN cable issue',
        'Router configuration issue',
        'Firmware or overload issue',
        'Router hardware issue',
      ],
      safeChecks: [
        'Check router adapter and power socket',
        'Restart router and ONU',
        'Check WAN cable connection',
        'Check ONU LOS/PON status',
        'Test with one device near the router',
        'Confirm router model and hardware version from backside sticker',
      ],
      diagnosticQuestions: [
        'Is the router power light on?',
        'Is the internet/WAN light blinking, red, or off?',
        'Is the issue no internet, slow internet, range problem, or auto disconnect?',
        'What is the router model and hardware version?',
      ],
      nextStep: 'Please share the router model and hardware version, or upload a clear backside sticker photo. I can then guide you more accurately.',
    },
    'Red Light / WAN Issue': {
      possibleCauses: [
        'ONU/ISP LOS or fiber line issue',
        'WAN cable issue',
        'ISP service outage or unpaid line',
        'Wrong WAN configuration',
        'Router WAN port issue',
      ],
      safeChecks: [
        'Check ONU LOS/PON light',
        'Restart ONU and router',
        'Reconnect WAN cable firmly',
        'Confirm ISP line status',
        'Test with another LAN cable if available',
      ],
      diagnosticQuestions: [
        'Which light is red: ONU LOS, router WAN, or internet?',
        'Is PON light stable?',
        'Did the issue start after changing cable or resetting router?',
        'What is the router model?',
      ],
      nextStep: 'If ONU LOS is red, contact ISP first. If ONU is normal, share router light status and model.',
    },
    'Configuration Issue': {
      possibleCauses: [
        'Wrong ISP connection type',
        'Wrong PPPoE username/password',
        'WAN cable connected incorrectly',
        'Router reset without reconfiguration',
        'Model-specific setup difference',
      ],
      safeChecks: [
        'Confirm ISP connection type with ISP',
        'Check WAN cable is connected to WAN/Internet port',
        'Keep PPPoE username/password ready if your ISP uses PPPoE',
        'Confirm exact router model and hardware version',
      ],
      diagnosticQuestions: [
        'Did you reset the router?',
        'Does ISP use Dynamic IP or PPPoE?',
        'Can you open the router login page?',
        'What is the exact model and hardware version?',
      ],
      nextStep: 'Please share exact model/version and ISP connection type before any reset, firmware, or configuration step.',
      warning: 'Do not upload firmware or perform model-specific reset/configuration from a guess. Wrong firmware or unstable power can damage the router.',
    },
  },
  'Camera / DVR / NVR': {
    'No View': {
      possibleCauses: [
        'Camera power or PoE issue',
        'LAN/PoE cable issue',
        'DVR/NVR channel configuration issue',
        'IP address or network issue',
        'Camera hardware issue',
      ],
      safeChecks: [
        'Check camera power or PoE',
        'Check LAN cable and DVR/NVR/switch port',
        'Restart camera and DVR/NVR',
        'Check whether the camera appears online in device list',
        'Test with another cable or port if available',
      ],
      diagnosticQuestions: [
        'Is the camera getting power or showing any indicator light?',
        'Is only one camera affected or all cameras?',
        'Is it connected by DVR, NVR, PoE switch, or network switch?',
        'What is the camera/DVR/NVR model?',
      ],
      nextStep: 'Please share whether one camera or all cameras have no view, and the DVR/NVR/camera model if available.',
    },
    Offline: {
      possibleCauses: [
        'Camera or NVR network disconnected',
        'PoE switch or adapter issue',
        'IP conflict',
        'Password/channel configuration issue',
        'Camera hardware issue',
      ],
      safeChecks: [
        'Check camera power and network cable',
        'Restart camera and NVR/DVR',
        'Check device list for online/offline status',
        'Try another switch/NVR port if safe',
      ],
      diagnosticQuestions: [
        'Does the device list show offline?',
        'Did the network or password change recently?',
        'Is the issue with one camera or multiple cameras?',
      ],
      nextStep: 'Share the device model and whether the camera appears in the device list.',
    },
    'No Power': {
      possibleCauses: [
        'Power adapter issue',
        'PoE switch or PoE port issue',
        'Cable damage',
        'Power socket issue',
        'Camera/DVR/NVR hardware issue',
      ],
      safeChecks: [
        'Check power socket and adapter',
        'Check PoE switch power',
        'Try another known-good cable or port if available',
        'Restart the DVR/NVR or switch',
      ],
      diagnosticQuestions: [
        'Does any indicator light turn on?',
        'Is power from adapter or PoE?',
        'Did it stop after lightning, water, or power fluctuation?',
      ],
      nextStep: 'If no light appears after safe power checks, CSP inspection may be needed.',
      warning: 'Do not open the device or repair internal power parts yourself.',
    },
    'Recording Issue': {
      possibleCauses: [
        'HDD not detected or full',
        'Recording schedule disabled',
        'Date/time mismatch',
        'Channel configuration issue',
        'DVR/NVR hardware or storage issue',
      ],
      safeChecks: [
        'Check HDD/storage status from DVR/NVR menu',
        'Check date and time',
        'Confirm recording schedule is enabled',
        'Restart DVR/NVR',
      ],
      diagnosticQuestions: [
        'Is HDD detected?',
        'Is recording missing for one channel or all channels?',
        'Does playback show old recordings?',
      ],
      nextStep: 'Share DVR/NVR model and HDD status. Backup important footage before formatting storage.',
      warning: 'Do not format HDD unless important recordings are backed up.',
    },
    'Night Vision Issue': {
      possibleCauses: [
        'IR/night mode disabled',
        'Camera glass dirty or reflection',
        'Insufficient power',
        'IR LED issue',
        'Camera hardware issue',
      ],
      safeChecks: [
        'Clean camera glass',
        'Check night mode/IR setting',
        'Remove nearby reflective objects',
        'Restart camera and DVR/NVR',
      ],
      diagnosticQuestions: [
        'Does the issue happen only at night?',
        'Is the image dark, white, blurry, or no view?',
        'Is the camera getting proper power?',
      ],
      nextStep: 'Share a short description of the night image and camera model if available.',
    },
    'Network Issue': {
      possibleCauses: [
        'LAN cable or switch issue',
        'IP address conflict',
        'Router or NVR network setting issue',
        'Password or device binding issue',
        'ISP/router network change',
      ],
      safeChecks: [
        'Restart router, switch, and NVR/DVR',
        'Check LAN cable and switch port',
        'Check device IP/network status',
        'Confirm mobile app account/device binding if applicable',
      ],
      diagnosticQuestions: [
        'Is local view working but remote view not working?',
        'Did router or ISP change recently?',
        'What app or software are you using?',
      ],
      nextStep: 'Share whether local view works and the DVR/NVR model for safer network guidance.',
    },
  },
  Printer: {
    'Not Printing': {
      possibleCauses: [
        'USB/LAN/WiFi connection issue',
        'Driver or print queue issue',
        'Paper, ink, or toner issue',
        'Wrong printer selected',
        'Printer hardware issue',
      ],
      safeChecks: [
        'Restart printer and computer',
        'Check USB/LAN/WiFi connection',
        'Check paper and ink/toner',
        'Clear print queue',
        'Try a printer test page',
      ],
      diagnosticQuestions: [
        'Is the printer connected by USB, LAN, or WiFi?',
        'Does any error code appear?',
        'Can it print a test page?',
        'What is the printer model?',
      ],
      nextStep: 'Please share the printer model and connection type so I can guide the next safe check.',
    },
    'Print Quality Problem': {
      possibleCauses: [
        'Low ink or toner',
        'Dirty print head or cartridge issue',
        'Wrong paper type',
        'Driver/quality setting issue',
        'Printer hardware issue',
      ],
      safeChecks: [
        'Check ink/toner level',
        'Run cleaning/calibration from printer software if available',
        'Use clean dry paper',
        'Try a test print',
      ],
      diagnosticQuestions: [
        'Is print faded, blank, lined, or smudged?',
        'Is the issue on all documents?',
        'What is the printer model?',
      ],
      nextStep: 'Share the print quality symptom and printer model before any model-specific maintenance.',
    },
    'Paper Jam': {
      possibleCauses: [
        'Paper loaded incorrectly',
        'Damp or curled paper',
        'Foreign object in paper path',
        'Worn roller or sensor issue',
        'Printer hardware issue',
      ],
      safeChecks: [
        'Turn printer off before removing paper',
        'Gently remove visible stuck paper',
        'Reload dry, clean paper correctly',
        'Check paper tray alignment',
        'Restart printer and test one page',
      ],
      diagnosticQuestions: [
        'Where is the paper stuck?',
        'Does jam happen every time?',
        'What paper size/type are you using?',
      ],
      nextStep: 'If paper tears inside or jam repeats, stop and contact CSP for inspection.',
      warning: 'Do not force tools into the printer or pull internal parts aggressively.',
    },
    'Ink/Toner Issue': {
      possibleCauses: [
        'Ink/toner low or empty',
        'Cartridge not seated properly',
        'Wrong or incompatible supply',
        'Print head/nozzle issue',
        'Printer hardware issue',
      ],
      safeChecks: [
        'Check ink/toner level',
        'Remove and reinstall cartridge/toner if user-accessible',
        'Run cleaning/calibration if available',
        'Try a test page',
      ],
      diagnosticQuestions: [
        'Is the printer showing low ink/toner?',
        'Was cartridge/toner recently changed?',
        'What is the printer model?',
      ],
      nextStep: 'Share the printer model and exact ink/toner error message if visible.',
    },
    'Network Printer Issue': {
      possibleCauses: [
        'Printer disconnected from WiFi/LAN',
        'IP address changed',
        'Driver port mismatch',
        'Router/switch issue',
        'Printer network hardware issue',
      ],
      safeChecks: [
        'Restart printer and router/switch',
        'Check printer is connected to the same network',
        'Print network status page if available',
        'Reconnect printer in OS printer settings',
      ],
      diagnosticQuestions: [
        'Is printer connected by LAN or WiFi?',
        'Can other devices print?',
        'Did router or WiFi password change?',
      ],
      nextStep: 'Share printer model, connection type, and whether other devices can print.',
    },
  },
  'UPS / Inverter': {
    'Backup Low': {
      possibleCauses: [
        'Battery weak or aged',
        'Load is higher than rated capacity',
        'UPS/Inverter not fully charged',
        'Charging circuit issue',
        'Battery or internal hardware fault',
      ],
      safeChecks: [
        'Charge fully before testing backup',
        'Reduce connected load',
        'Test with one low-power device',
        'Check input power is stable',
        'Note backup duration after full charge',
      ],
      diagnosticQuestions: [
        'How long does backup last after full charge?',
        'What devices are connected?',
        'How old is the battery/device?',
        'Any alarm or overload indicator?',
      ],
      nextStep: 'Please share model, connected load, and backup time after full charge.',
    },
    'No Backup': {
      possibleCauses: [
        'Battery disconnected, weak, or dead',
        'Overload',
        'UPS/Inverter charging issue',
        'Input/output wiring issue',
        'Internal hardware fault',
      ],
      safeChecks: [
        'Check input power',
        'Reduce load and test again',
        'Charge fully before backup test',
        'Check for overload/alarm indicator',
      ],
      diagnosticQuestions: [
        'Does UPS/Inverter turn on?',
        'Does it show charging?',
        'What load is connected?',
        'What is the model?',
      ],
      nextStep: 'If there is still no backup after safe checks, CSP inspection may be needed.',
      warning: 'Do not open UPS/Inverter or touch internal battery wiring unless you are a qualified technician.',
    },
    'No Power': {
      possibleCauses: [
        'Power socket or input cable issue',
        'Fuse or protection triggered',
        'Battery disconnected/failed',
        'Internal circuit fault',
      ],
      safeChecks: [
        'Try another known-good power socket',
        'Remove heavy load and test',
        'Check visible switch/breaker position if available',
        'Keep the unit unplugged if there is burn smell or smoke',
      ],
      diagnosticQuestions: [
        'Does any light or display turn on?',
        'Was there overload, lightning, or power surge?',
        'Is there burn smell, heat, or sound?',
      ],
      nextStep: 'If no power remains or there is burn smell, stop using it and contact Excel CSP.',
      warning: 'Power electronics can be dangerous. Do not open or repair internal parts yourself.',
    },
    'Charging Issue': {
      possibleCauses: [
        'Input power issue',
        'Battery aged or damaged',
        'Charging cable/terminal issue',
        'Charger circuit issue',
        'Overload or protection mode',
      ],
      safeChecks: [
        'Confirm stable input power',
        'Keep connected long enough for full charge',
        'Reduce load while charging',
        'Check charging indicator behavior',
      ],
      diagnosticQuestions: [
        'Is charging indicator on?',
        'How long has it been charging?',
        'Does backup work at all?',
        'What is the model?',
      ],
      nextStep: 'Share charging indicator status, model, and battery age if known.',
    },
    Overload: {
      possibleCauses: [
        'Connected load exceeds capacity',
        'High startup current device connected',
        'Battery weak',
        'Output short or device fault',
        'UPS/Inverter internal issue',
      ],
      safeChecks: [
        'Remove high-power devices',
        'Test with one low-power device',
        'Keep load within rated capacity',
        'Restart after reducing load',
      ],
      diagnosticQuestions: [
        'What devices are connected?',
        'What is the UPS/Inverter VA/Watt rating?',
        'Does overload stop after removing load?',
      ],
      nextStep: 'If overload continues with low load, contact CSP for inspection.',
    },
  },
  'Warranty / RMA': {
    'Warranty Check': {
      possibleCauses: [
        'Warranty status needs Excel warranty portal/CSP verification',
        'Serial number or invoice may be required',
        'Warranty period and policy depend on product category',
      ],
      safeChecks: [
        'Keep product model ready if available',
        'Keep serial number ready if available',
        'Keep purchase invoice ready if available',
        'Use nearest Excel CSP or official warranty channel for verification',
      ],
      diagnosticQuestions: [
        'What is the product model?',
        'Do you have serial number or invoice available?',
        'What service issue are you facing?',
      ],
      nextStep: 'Warranty status must be checked from Excel warranty portal/CSP using serial number or invoice.',
      warning: 'AI cannot confirm warranty approval, replacement approval, or RMA approval.',
    },
    'Replacement Request': {
      possibleCauses: [
        'Replacement eligibility needs CSP inspection',
        'Serial number/invoice may be required',
        'Physical damage, burn, or policy exclusions may affect decision',
      ],
      safeChecks: [
        'Keep product, serial number, and invoice ready',
        'Describe the fault clearly',
        'Do not open or repair the product before inspection',
      ],
      diagnosticQuestions: [
        'What product and model is it?',
        'What problem is happening?',
        'Is there any physical damage, burn mark, or liquid damage?',
      ],
      nextStep: 'Please contact Excel CSP for inspection and replacement/RMA verification.',
      warning: 'Replacement cannot be approved by AI. It requires Excel verification.',
    },
    'Service Claim': {
      possibleCauses: [
        'Service eligibility depends on product category and warranty status',
        'CSP inspection may be needed',
        'Serial/invoice may be required for official claim',
      ],
      safeChecks: [
        'Keep model, serial number, and invoice ready if available',
        'Write the problem symptoms clearly',
        'Visit or contact nearest Excel CSP for service claim guidance',
      ],
      diagnosticQuestions: [
        'Which product needs service?',
        'What is the exact problem?',
        'Do you have SN or invoice?',
      ],
      nextStep: 'Share product model and problem. For official claim status, CSP/warranty portal verification is required.',
      warning: 'AI can guide required information but cannot approve service claims.',
    },
    'Serial Number Issue': {
      possibleCauses: [
        'Serial number sticker may be damaged or unclear',
        'SN may be printed on product body, box, warranty card, or invoice',
        'Warranty portal may need exact SN format',
      ],
      safeChecks: [
        'Check product backside/bottom sticker',
        'Check product box, warranty card, or invoice',
        'Take a clear photo if the sticker is unclear',
        'Do not share unnecessary personal information',
      ],
      diagnosticQuestions: [
        'Which product model is it?',
        'Is the sticker damaged or just unclear?',
        'Do you have invoice or box label?',
      ],
      nextStep: 'Please share model and, if safe, a clear sticker photo or write only the serial number needed for verification.',
      warning: 'Share only information needed for warranty/service verification.',
    },
  },
  'Other Product': {
    'General Support': {
      possibleCauses: [
        'Product category is unclear',
        'Model-specific information may be needed',
        'More symptom details are needed',
      ],
      safeChecks: [
        'Check power and cable connections if applicable',
        'Restart the device if it is safe to do so',
        'Note any error light, sound, or message',
      ],
      diagnosticQuestions: [
        'Which Excel product are you using?',
        'What is the model number?',
        'What exactly is not working?',
      ],
      nextStep: 'Please share product category, model, and the exact symptom.',
    },
  },
};

const problemRules: Record<UniversalSupportCategory, ProblemRule[]> = {
  'Router / Internet': [
    { problem: 'Slow Internet', keywords: ['slow', 'speed low', 'speed slow', 'buffer', 'net slow', 'khub slow'] },
    { problem: 'No Internet', keywords: ['no internet', 'not connected', 'connected no internet', 'net nai', 'internet nai'] },
    { problem: 'Auto Disconnect', keywords: ['disconnect', 'bar bar', 'drop', 'auto cut', 'chole jay'] },
    { problem: 'Range Problem', keywords: ['range', 'signal weak', 'range paina', 'coverage'] },
    { problem: 'Router Not Working', keywords: ['not work', 'not working', 'not work properly', 'kaj kore na', 'dead', 'no response'] },
    { problem: 'Red Light / WAN Issue', keywords: ['red light', 'lal light', 'lal bati', 'wan', 'los'] },
    { problem: 'Configuration Issue', keywords: ['configure', 'configuration', 'setup', 'pppoe', 'dynamic ip', 'password', 'router page'] },
  ],
  'Camera / DVR / NVR': [
    { problem: 'No View', keywords: ['no view', 'no display', 'no video', 'not showing', 'show kore na', 'dekha jay na'] },
    { problem: 'Offline', keywords: ['offline', 'device offline', 'camera offline'] },
    { problem: 'No Power', keywords: ['no power', 'power nai', 'light nai', 'dead'] },
    { problem: 'Recording Issue', keywords: ['recording', 'not recording', 'playback', 'hdd'] },
    { problem: 'Night Vision Issue', keywords: ['night vision', 'ir', 'night mode', 'dark at night'] },
    { problem: 'Network Issue', keywords: ['network', 'remote view', 'app offline', 'ip conflict'] },
  ],
  Printer: [
    { problem: 'Not Printing', keywords: ['not printing', 'print hocche na', 'print ditese na', 'print not', 'blank print'] },
    { problem: 'Print Quality Problem', keywords: ['quality', 'faded', 'line', 'smudge', 'blur', 'blank'] },
    { problem: 'Paper Jam', keywords: ['paper jam', 'paper stuck', 'jam'] },
    { problem: 'Ink/Toner Issue', keywords: ['ink', 'toner', 'cartridge', 'low ink', 'low toner'] },
    { problem: 'Network Printer Issue', keywords: ['network', 'wifi printer', 'lan printer', 'ip printer'] },
  ],
  'UPS / Inverter': [
    { problem: 'Backup Low', keywords: ['backup low', 'backup kom', 'low backup', 'battery low'] },
    { problem: 'No Backup', keywords: ['no backup', 'backup nai', 'backup nei'] },
    { problem: 'No Power', keywords: ['no power', 'dead', 'power nai', 'light nai'] },
    { problem: 'Charging Issue', keywords: ['charging', 'not charging', 'charge hocche na'] },
    { problem: 'Overload', keywords: ['overload', 'load', 'alarm', 'beep'] },
  ],
  'Warranty / RMA': [
    { problem: 'Warranty Check', keywords: ['warranty', 'warenty', 'warrenty', 'warranty ache kina', 'warranty status'] },
    { problem: 'Replacement Request', keywords: ['replacement', 'replace', 'change product'] },
    { problem: 'Service Claim', keywords: ['claim', 'rma', 'service claim'] },
    { problem: 'Serial Number Issue', keywords: ['serial', 'sn', 'serial number', 'sticker'] },
  ],
  'Other Product': [{ problem: 'General Support', keywords: ['support', 'service', 'problem', 'issue'] }],
};

const categoryRules: Record<UniversalSupportCategory, string[]> = {
  'Router / Internet': ['router', 'wifi', 'wi fi', 'internet', 'net', 'wan', 'lan', 'onu', 'modem', 'tp-link', 'tplink', 'mercusys'],
  'Camera / DVR / NVR': ['camera', 'cctv', 'dvr', 'nvr', 'ip camera', 'poe', 'no view'],
  Printer: ['printer', 'print', 'ink', 'toner', 'paper jam', 'cartridge'],
  'UPS / Inverter': ['ups', 'inverter', 'backup', 'battery', 'overload'],
  'Warranty / RMA': ['warranty', 'warenty', 'warrenty', 'rma', 'replacement', 'claim', 'serial', 'sn'],
  'Other Product': ['support', 'service', 'problem', 'issue'],
};

const nonSupportKeywords = [
  'poem',
  'story',
  'joke',
  'recipe',
  'song',
  'love letter',
  'weather',
  'news',
  'politics',
  'write an essay',
];

const riskyKeywords = [
  'firmware',
  'reset',
  'factory reset',
  'repair',
  'open device',
  'open the device',
  'board',
  'burn',
  'short circuit',
  'internal',
  'rma',
  'replacement',
  'warranty approval',
  'configure',
  'configuration',
];

const banglishMarkers = [
  'hocche na',
  'hoy na',
  'kaj kore na',
  'nai',
  'ache kina',
  'backup kom',
  'show kore na',
  'print hocche na',
  'net slow',
  'paina',
];

function normalize(value: string) {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s./-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(normalize(keyword)));
}

function keywordScore(text: string, keyword: string) {
  const normalizedKeyword = normalize(keyword);

  if (!normalizedKeyword) return 0;
  if (text.includes(normalizedKeyword)) return Math.max(3, normalizedKeyword.length);

  return normalizedKeyword
    .split(' ')
    .filter((word) => word.length > 2 && text.includes(word)).length;
}

function categoryScore(text: string, category: UniversalSupportCategory) {
  return categoryRules[category].reduce((total, keyword) => total + keywordScore(text, keyword), 0);
}

export function detectUniversalLanguage(message: string, languageHint?: string): UniversalSupportLanguage {
  const hint = normalize(languageHint || '');

  if (hint === 'bn' || hint === 'bangla') return 'bn';
  if (hint === 'banglish') return 'banglish';
  if (hint === 'mixed') return 'mixed';

  const hasBangla = /[\u0980-\u09FF]/.test(message);
  const hasEnglish = /[a-z]/i.test(message);
  const text = normalize(message);
  const hasBanglish = banglishMarkers.some((marker) => text.includes(marker));

  if (hasBangla && hasEnglish) return 'mixed';
  if (hasBangla) return 'bn';
  if (hasBanglish) return 'banglish';

  return 'en';
}

export function normalizeUniversalCategory(category?: string): UniversalSupportCategory {
  const text = normalize(category || '');

  if (!text) return 'Other Product';
  if (text.includes('router') || text.includes('internet') || text.includes('wifi')) return 'Router / Internet';
  if (text.includes('camera') || text.includes('dvr') || text.includes('nvr') || text.includes('cctv')) return 'Camera / DVR / NVR';
  if (text.includes('printer') || text.includes('print')) return 'Printer';
  if (text.includes('ups') || text.includes('inverter')) return 'UPS / Inverter';
  if (text.includes('warranty') || text.includes('rma') || text.includes('claim') || text.includes('serial')) return 'Warranty / RMA';

  return 'Other Product';
}

export function universalCategoryToTicketCategory(category: string) {
  const normalized = normalizeUniversalCategory(category);

  if (normalized === 'Warranty / RMA') return 'Warranty';
  if (normalized === 'Other Product') return '';

  return normalized;
}

export function detectUniversalCategory(input: UniversalSupportRequest): UniversalSupportCategory {
  const hinted = normalizeUniversalCategory(
    input.category ||
      input.previousContext?.currentCategory ||
      input.detectedProduct ||
      input.detectedModel ||
      ''
  );
  const text = normalize(`${input.message} ${input.detectedProduct || ''} ${input.detectedModel || ''}`);
  let best: { category: UniversalSupportCategory; score: number } = {
    category: hinted,
    score: hinted === 'Other Product' ? 0 : 2,
  };

  for (const category of Object.keys(categoryRules) as UniversalSupportCategory[]) {
    const score = categoryScore(text, category);

    if (score > best.score) {
      best = { category, score };
    }
  }

  return best.category;
}

export function detectUniversalProblem(message: string, category: UniversalSupportCategory, fallbackProblem?: string) {
  const text = normalize(message);
  let best = {
    problem: Object.keys(fallbackCatalog[category])[0],
    score: 0,
  };

  for (const rule of problemRules[category]) {
    const score = rule.keywords.reduce((total, keyword) => total + keywordScore(text, keyword), 0);

    if (score > best.score) {
      best = { problem: rule.problem, score };
    }
  }

  if (best.score === 0 && fallbackProblem && fallbackCatalog[category]?.[fallbackProblem]) {
    return fallbackProblem;
  }

  return best.problem;
}

export function isUniversalRiskyRequest(input: UniversalSupportRequest) {
  const text = normalize(`${input.message} ${input.category || ''} ${input.previousContext?.currentProblemName || ''}`);

  return includesAny(text, riskyKeywords);
}

export function hasUniversalModelContext(input: UniversalSupportRequest) {
  return Boolean(
    input.detectedModel?.trim() ||
      input.hardwareVersion?.trim() ||
      input.previousContext?.currentModel?.trim() ||
      input.previousContext?.currentHardwareVersion?.trim()
  );
}

export function isUniversalSupportRelated(input: UniversalSupportRequest) {
  const text = normalize(`${input.message} ${input.category || ''} ${input.detectedProduct || ''} ${input.detectedModel || ''}`);
  const category = detectUniversalCategory(input);
  const categoryDetected = category !== 'Other Product' || categoryScore(text, 'Other Product') > 0;
  const hasSupportWord = includesAny(text, [
    'problem',
    'issue',
    'not working',
    'service',
    'support',
    'offline',
    'slow',
    'backup',
    'warranty',
    'replacement',
    'repair',
    'kaj kore na',
    'hocche na',
    'nai',
  ]);
  const nonSupport = includesAny(text, nonSupportKeywords);

  return !nonSupport && (categoryDetected || hasSupportWord);
}

function localizedIntro(language: UniversalSupportLanguage, type: UniversalSupportType) {
  if (type === 'non_support') {
    return language === 'en'
      ? 'I can help with Excel product service-related issues only. Please describe the product and service problem.'
      : 'Ami Excel product service-related issue niye help korte pari. Product ar problem ta likhun.';
  }

  return language === 'en'
    ? 'I do not have an Excel-approved exact model-specific answer for this yet. I can still help with safe general checks.'
    : 'Exact model-specific approved answer ekhono nei. Ami safe general checks diye guide korte pari.';
}

function safetyWarning(input: UniversalSupportRequest, category: UniversalSupportCategory, existingWarning?: string) {
  const risky = isUniversalRiskyRequest(input);
  const lacksModelContext = !hasUniversalModelContext(input);
  const warranty = category === 'Warranty / RMA';

  if (warranty) {
    return existingWarning || 'AI cannot confirm warranty approval, replacement approval, or RMA approval.';
  }

  if (risky && lacksModelContext) {
    return 'Risky or exact model-specific actions need exact model, hardware version, SN/sticker photo, or Excel-approved instructions. Do not continue from a guess.';
  }

  return existingWarning;
}

function dedupe(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function enforceUniversalSafety(answer: UniversalSupportAnswer, input: UniversalSupportRequest): UniversalSupportAnswer {
  const category = normalizeUniversalCategory(answer.category);
  const risky = isUniversalRiskyRequest(input);
  const lacksModelContext = !hasUniversalModelContext(input);
  const warning = safetyWarning(input, category, answer.warning);
  const blockedStepPattern = /\b(upload firmware|flash|solder|open the device|open device|replace board|internal repair|approve warranty|approve replacement)\b/i;
  const safeChecks = risky
    ? answer.safeChecks.filter((check) => !blockedStepPattern.test(check))
    : answer.safeChecks;
  const diagnosticQuestions = dedupe([
    ...answer.diagnosticQuestions,
    ...(risky && lacksModelContext ? ['What is the exact model and hardware version?', 'Can you share SN/sticker photo if needed?'] : []),
  ]);
  const nextStep = risky && lacksModelContext
    ? 'Please share exact model/version/SN or a clear sticker photo. If unsure, contact Excel CSP before risky firmware, reset, repair, warranty, or replacement steps.'
    : answer.nextStep;

  return {
    ...answer,
    category,
    warning,
    safeChecks,
    diagnosticQuestions,
    nextStep,
    escalationRequired: Boolean(answer.escalationRequired || (risky && lacksModelContext) || category === 'Warranty / RMA'),
  };
}

export function getUniversalSupportFallback(input: UniversalSupportRequest): UniversalSupportAnswer {
  const language = detectUniversalLanguage(input.message, input.language);

  if (!isUniversalSupportRelated(input)) {
    return {
      type: 'non_support',
      language,
      category: 'Other Product',
      detectedProblem: 'Non-support request',
      message: localizedIntro(language, 'non_support'),
      possibleCauses: [],
      safeChecks: [],
      diagnosticQuestions: ['Please write your Excel product name/model and the service issue.'],
      nextStep: 'Describe the Excel product service problem so I can help.',
      escalationRequired: false,
    };
  }

  const category = detectUniversalCategory(input);
  const problem = detectUniversalProblem(input.message, category, input.previousContext?.currentProblemName);
  const template = fallbackCatalog[category][problem] || fallbackCatalog[category][Object.keys(fallbackCatalog[category])[0]];
  const warning = safetyWarning(input, category, template.warning);
  const type: UniversalSupportType =
    category === 'Warranty / RMA'
      ? 'clarifying_question'
      : warning
        ? 'safe_checks'
        : 'universal_support_answer';

  return enforceUniversalSafety(
    {
      type,
      language,
      category,
      detectedProblem: problem,
      message: localizedIntro(language, type),
      possibleCauses: template.possibleCauses,
      safeChecks: template.safeChecks,
      diagnosticQuestions: template.diagnosticQuestions,
      nextStep: template.nextStep,
      warning,
      escalationRequired: category === 'Warranty / RMA',
    },
    input
  );
}

export function sanitizeUniversalAnswer(value: unknown, input: UniversalSupportRequest): UniversalSupportAnswer {
  const fallback = getUniversalSupportFallback(input);
  const record = value && typeof value === 'object' ? value as Partial<UniversalSupportAnswer> : {};
  const allowedTypes: UniversalSupportType[] = [
    'universal_support_answer',
    'clarifying_question',
    'safe_checks',
    'escalation',
    'non_support',
  ];
  const allowedLanguages: UniversalSupportLanguage[] = ['en', 'bn', 'banglish', 'mixed'];
  const toStringArray = (items: unknown, fallbackItems: string[]) =>
    Array.isArray(items)
      ? items.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 8)
      : fallbackItems;

  return enforceUniversalSafety(
    {
      type: allowedTypes.includes(record.type as UniversalSupportType) ? record.type as UniversalSupportType : fallback.type,
      language: allowedLanguages.includes(record.language as UniversalSupportLanguage)
        ? record.language as UniversalSupportLanguage
        : fallback.language,
      category: typeof record.category === 'string' && record.category.trim()
        ? normalizeUniversalCategory(record.category)
        : fallback.category,
      detectedProblem: typeof record.detectedProblem === 'string' && record.detectedProblem.trim()
        ? record.detectedProblem.trim()
        : fallback.detectedProblem,
      message: typeof record.message === 'string' && record.message.trim()
        ? record.message.trim()
        : fallback.message,
      possibleCauses: toStringArray(record.possibleCauses, fallback.possibleCauses),
      safeChecks: toStringArray(record.safeChecks, fallback.safeChecks),
      diagnosticQuestions: toStringArray(record.diagnosticQuestions, fallback.diagnosticQuestions),
      nextStep: typeof record.nextStep === 'string' && record.nextStep.trim()
        ? record.nextStep.trim()
        : fallback.nextStep,
      warning: typeof record.warning === 'string' && record.warning.trim() ? record.warning.trim() : fallback.warning,
      escalationRequired: Boolean(record.escalationRequired ?? fallback.escalationRequired),
    },
    input
  );
}

export function formatUniversalSupportAnswer(answer: UniversalSupportAnswer) {
  if (answer.type === 'non_support') return answer.message;

  const useEnglish = answer.language === 'en';
  const causesHeading = useEnglish ? 'This may happen due to:' : 'Ei problem hote pare:';
  const checksHeading = useEnglish ? 'Safe checks you can try first:' : 'Safe check korte paren:';
  const questionsHeading = useEnglish ? 'To understand better, please answer:' : 'Bujte help korbe, egulo bolun:';
  const nextHeading = useEnglish ? 'Next:' : 'Next:';
  const safetyHeading = useEnglish ? 'Safety note:' : 'Safety note:';
  const numberLines = (items: string[]) => items.map((item, index) => `${index + 1}. ${item}`).join('\n');

  return [
    `Detected issue:\n${answer.category} -> ${answer.detectedProblem}`,
    answer.possibleCauses.length ? `${causesHeading}\n\n${numberLines(answer.possibleCauses)}` : '',
    answer.safeChecks.length ? `${checksHeading}\n\n${numberLines(answer.safeChecks)}` : '',
    answer.diagnosticQuestions.length ? `${questionsHeading}\n\n${numberLines(answer.diagnosticQuestions)}` : '',
    `${nextHeading}\n${answer.nextStep}`,
    answer.warning ? `${safetyHeading}\n${answer.warning}` : '',
  ].filter(Boolean).join('\n\n');
}

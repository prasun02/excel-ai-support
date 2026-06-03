export type SupportCategory =
  | 'Router / Internet'
  | 'Camera / DVR / NVR'
  | 'Printer'
  | 'UPS / Inverter'
  | 'Warranty'
  | 'New Product Purchase'
  | 'Other Product';

export type AIIntent =
  | 'support_problem'
  | 'warranty_query'
  | 'purchase_query'
  | 'follow_up'
  | 'location_reply'
  | 'non_support';

export type RiskLevel = 'low' | 'medium' | 'high';

export type DetectedLanguage = 'en' | 'bn' | 'banglish' | 'mixed' | 'unknown';

# Support Knowledge Import Template

`support_knowledge_template.csv` is a starter file for maintaining real Excel support solutions in Excel or Google Sheets.

## How to Edit

- Keep the header row unchanged.
- Use `|` between multiple keywords, questions, or solution steps.
- Set `active` to `true` for usable support answers and `false` for drafts.
- Keep solutions short and practical because customers see these during chat.

## Columns

- `category`: Support category shown in the app.
- `intent`: Stable machine-friendly name, such as `slow_internet`.
- `issueType`: Human-friendly issue name, such as `Slow Internet`.
- `englishKeywords`, `banglaKeywords`, `banglishKeywords`, `misspellings`: Matching terms.
- `diagnosticQuestions`: Questions asked one by one before solution.
- `solutionSteps`: Real support steps shown to customer.
- `followUpQuestion`: Usually `Did this solve your problem?`.
- `escalationMessage`: Human support message when the app cannot solve it.
- `priority`: `high`, `medium`, or `low`.
- `active`: `true` or `false`.

## Current Import Flow

The app currently loads JSON data at runtime for fast Vercel deployment. The helper in `lib/importSupportData.ts` shows how a CSV row can be converted into the same JSON-like structure. Later, an admin import button or script can read this CSV and generate/update JSON or Supabase rows.

## Model-Wise Support Knowledge Template

Use `public/templates/model_wise_support_knowledge_template.csv` for future model-wise real service solutions. Keep the header row unchanged and separate multiple keywords, questions, or steps with `|`.

- `category`: Router / Internet, Camera / DVR / NVR, Printer, UPS / Inverter, Warranty, New Product Purchase.
- `brand`: Product brand, for example TP-Link, Hikvision, Logitech, Excel.
- `productModel`: Exact model name such as Archer C6 or DS-2CE.
- `modelFamily`: Similar model group, such as Archer, Turbo HD, or UPS.
- `deviceType`: Device type, such as router, camera, NVR, printer, UPS.
- `issueType`: Support issue, such as Slow Internet, No Display, No Backup.
- `problemKeywords`: English customer problem words.
- `banglaKeywords`: Bangla customer problem words.
- `banglishKeywords`: Banglish customer problem words.
- `misspellings`: Common spelling mistakes.
- `customerSymptomExample`: Sample customer language.
- `diagnosticQuestions`: Questions to ask before giving solution.
- `solutionSteps`: Real service solution steps.
- `repairImageUrl`: Optional image guide link.
- `repairVideoUrl`: Optional video guide link.
- `riskAfterSolution`: Possible risk after applying solution.
- `nextPossibleProblem`: What may happen if first solution fails.
- `nextSolutionSteps`: Second-level solution steps.
- `whenToEscalate`: Condition for human support.
- `escalationMessage`: Final human support message.
- `priority`: `high`, `medium`, or `low`.
- `active`: `true` or `false`.

Future flow: imported Supabase knowledge can be checked first, uploaded local knowledge second, default JSON/model-wise knowledge third, then the app falls back to human escalation.

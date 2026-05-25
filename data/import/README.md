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

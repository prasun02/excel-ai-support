# Simple Support Knowledge Import

Use `public/templates/simple_support_knowledge_template.csv` when a support engineer wants to add real model-wise problems and solutions. The file is intentionally short so it can be edited in Excel or Google Sheets without technical knowledge.

## Columns

- `category`: Router / Internet, Camera / DVR / NVR, Printer, UPS / Inverter, Warranty, New Product Purchase, Other Product.
- `brand`: Product brand, for example TP-Link, Hikvision, Logitech, HP, Excel.
- `model`: Exact model such as Archer C6. This is optional.
- `modelFamily`: Product series or family such as Archer, WR Series, DVR, NVR, UPS. This is optional.
- `problem`: Short issue name such as Slow Internet, Camera Offline, Not Printing.
- `symptoms`: Customer words separated with `|`, for example `slow net|buffering|net hanging|wifi slow`.
- `solutionSteps`: Customer-facing solution steps separated with `|`.
- `nextIfNotSolved`: Second-level action if the first solution does not work.
- `escalationMessage`: Human support message when the app cannot solve the issue.
- `imageUrl`: Optional image guide link.
- `videoUrl`: Optional video guide link.
- `active`: Use `true` for live answers and `false` for drafts.

## How Matching Works

The app converts each CSV row into an internal support knowledge object. It then searches in this order:

1. Uploaded/imported simple CSV knowledge from the admin page.
2. Supabase knowledge when available in a future deployment.
3. Local browser imported knowledge.
4. Default JSON knowledge bundled with the app.
5. Human escalation fallback.

Matching priority:

1. Same exact model plus matching symptom/problem.
2. Same model family plus matching symptom/problem.
3. Same category plus matching symptom/problem.
4. If the issue is unclear, the app asks for clarification.
5. If no real solution exists, it escalates to human support.

## Editing Rules

- Keep the header row unchanged.
- Separate multiple symptoms and solution steps with `|`.
- Keep solutions short, practical, and safe for customers.
- Do not add invented answers. Real solutions should come from Excel service knowledge.
- Add common customer language, Banglish, and misspellings in `symptoms`.

## Optional AI Later

`OPENAI_API_KEY`, `GEMINI_API_KEY`, and `AI_PROVIDER` can be added later. AI is used only for intent matching, meaning it can help classify the customer's category/problem. AI must not invent a solution. The manual CSV/JSON knowledge base remains the source of truth for all answers.

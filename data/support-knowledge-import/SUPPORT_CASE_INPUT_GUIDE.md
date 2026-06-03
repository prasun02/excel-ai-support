# Support Case Input Guide

Use `support_case_input.csv` when you want to turn real CSP/support experience into approved Excel Service AI knowledge.

## How To Write A Case

- `supportStory`: write the real support experience in natural language. It can be long and can include what the customer said, what the CSP checked, and how the issue was solved.
- `customerVisibleSteps`: write only safe customer-facing steps. These are the first steps the chatbot can show to customers.
- `internalTechnicianSteps`: write technician-only notes. These are for admin/internal learning and should not be shown as normal customer instructions.
- `procedureSteps`: write risky or exact procedures, such as firmware update, reset, or advanced configuration. These should only be shown when the flow needs it or the customer asks for step-by-step procedure.
- Firmware cases must include exact model and hardware version. Wrong firmware can damage a router.
- Put Bangla and Banglish customer words in `banglaBanglishWords`, separated by semicolon.
- `followUpQuestions` uses semicolon-separated questions.
- `followUpAnswers` uses `||` to match the answers in the same order as `followUpQuestions`.
- Only rows with `approvedByExcel` = `TRUE` and `active` = `TRUE` are used for customer answers.

## Safety Rules

- Manual approved cases are the source of truth for exact solution steps.
- Demo AI may give possible causes and safe checks only.
- Firmware, reset, configuration, warranty, RMA, and replacement must not be guessed.
- If the customer is unsure or the case is high risk, recommend Excel CSP/human support.

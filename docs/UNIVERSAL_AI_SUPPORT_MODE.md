# Universal AI Support Mode

Universal AI Support Mode lets Excel Service AI answer general Excel product service questions when exact manual/product-specific knowledge is not available yet.

## Flow Order

1. The chat API detects category, product, model, hardware version, and conversation context.
2. Existing manual Excel support knowledge is checked first through `supportKnowledgeEngine` and the current troubleshooting system.
3. If an approved manual answer exists, the app uses that answer.
4. If there is no exact approved answer and `ENABLE_UNIVERSAL_AI_SUPPORT=true`, the app calls `/api/universal-ai-support`.
5. The universal API uses OpenAI only from the server when `AI_PROVIDER=openai` and `OPENAI_API_KEY` is set.
6. If OpenAI is unavailable or no key is configured, the API returns local fallback templates from `lib/universalSupportFallbacks.ts`.

## What Universal Mode Can Answer

Universal mode is limited to Excel product service-related questions. It can provide:

- Possible causes
- Safe basic checks
- Diagnostic questions
- A safe next step
- Safety warnings for risky or unclear issues

It should not claim a confirmed diagnosis, warranty approval, replacement approval, exact firmware file, exact model-specific repair, or internal hardware procedure unless that comes from approved manual knowledge.

## Risky Issue Safety Rules

Universal mode treats firmware, reset, repair, board burn, internal damage, exact configuration, warranty, RMA, and replacement requests as risky or verification-heavy. For these cases it asks for exact model, hardware version, SN/sticker photo if needed, and recommends Excel CSP when unsure.

`UNIVERSAL_AI_ALLOW_RISKY_STEPS=false` is documented as the expected safety setting. The current implementation keeps risky steps out of universal answers and asks for verification instead.

## Warranty / RMA Rules

Warranty, RMA, service claim, replacement, and serial number questions require verification through Excel warranty portal/CSP records. Universal mode can ask for model, serial number, invoice, or sticker photo if needed, but it cannot approve warranty, RMA, or replacement.

Do not ask for unnecessary personal information. Ask only for service verification details when needed.

## Router Free Support Rule

Router support can be guided online or through Excel CSP even when warranty details are not immediately available. Replacement or warranty decisions still require verification.

## Environment Variables

Add these values to `.env.local` for local development:

```env
ENABLE_UNIVERSAL_AI_SUPPORT=true
AI_PROVIDER=openai
OPENAI_MODEL=gpt-4o-mini
OPENAI_API_KEY=your_openai_api_key_here
UNIVERSAL_AI_ALLOW_RISKY_STEPS=false
AI_MAX_OUTPUT_TOKENS=450
AI_TEMPERATURE=0.3
GEMINI_API_KEY=
```

The OpenAI key is read only inside server route handlers. Do not add it to client components or `NEXT_PUBLIC_` variables.

## Cost Control

- Use `gpt-4o-mini` by default for Universal AI support.
- Keep output capped with `AI_MAX_OUTPUT_TOKENS=450`.
- Keep responses deterministic and compact with `AI_TEMPERATURE=0.3`.
- Do not send the product database, warranty claim history, full chat history, or full support knowledge database to OpenAI.
- Send only the latest user message, detected category/problem, detected product/model, hardware version, language, and short previous context when needed.
- Cache repeated same questions for 10 minutes so the same category/problem/product/message does not call OpenAI again.
- Return local fallback support answers if OpenAI is unavailable, rate-limited, quota-limited, billing-limited, or fails due to network errors.
- Keep the first OpenAI monthly usage limit low, such as `$10`, and raise it only after reviewing real usage.

## Disable Universal Mode

Set:

```env
ENABLE_UNIVERSAL_AI_SUPPORT=false
```

When disabled, the app continues using the existing manual knowledge, ticket/session state, category buttons, router guided flow, localStorage/Supabase fallback behavior, and previous demo fallback path.

## Local Test Phrases

Use the chat UI or POST to `/api/chat` with these messages:

- `my router not work properly`
- `camera no view`
- `printer print hocche na`
- `ups backup low`
- `warranty ache kina`

Expected universal answer format:

```text
Detected issue:
[Category] -> [Problem]

This may happen due to:
1. ...

Safe checks you can try first:
1. ...

To understand better, please answer:
1. ...

Next:
...

Safety note:
...
```

Bangla or Banglish messages should get simple Bangla/Banglish-style wording while keeping technical terms clear.

## How It Avoids Misinformation

- Manual approved knowledge always wins.
- Universal mode says "may happen due to" instead of "confirmed problem".
- Risky actions are filtered and replaced with verification prompts.
- Firmware/configuration/repair details require exact model/version and approved knowledge.
- Warranty, RMA, and replacement decisions are deferred to Excel warranty portal/CSP verification.
- Non-support content gets a non-support response instead of a guessed answer.

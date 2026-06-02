This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Internal AI Support Management Prototype

This project is a professional internal AI support management prototype for **Excel Technologies Ltd.** It is designed as a demo-ready customer support desk where users can choose a product category, describe a problem, receive a fast guided answer, and continue the conversation under one support ticket.

### Current Features

- Next.js app deployed on Vercel.
- Professional support desk UI with category buttons, customer detail fields, chat area, dark mode, and typing animation.
- Local ticket flow using browser state/localStorage.
- Ticket IDs in `EXL-YYYY-RANDOMNUMBER` format.
- English and Bangla language detection for support replies.
- JSON-based support knowledge database.
- Local keyword matching engine in `lib/supportKnowledge.ts`.
- Structured AI-style replies with ticket ID, detected category, suggested solution, next steps, and support link.
- Support categories for Router / Internet, Camera / DVR / NVR, Printer, UPS / Inverter, Warranty, and General Support.
- Question logging route for collecting unknown or future support questions.
- No paid AI service, API key, or external messaging integration required.

### Future Roadmap

- Admin panel for managing support knowledge and reviewing tickets.
- Real database storage for tickets, customer details, and question logs.
- Excel upload workflow for importing support knowledge.
- Better keyword scoring with synonyms, typo handling, and Bangla variants.
- Location-based CSP lookup and escalation workflow.
- Dashboard reports for common issues, unresolved questions, and category trends.
- Role-based access for support team members.

### Add New Support Knowledge

For the current MVP, the easiest path is the simplified CSV template:

- Download: `public/templates/simple_support_knowledge_template.csv`
- Admin upload page: `/admin/knowledge`
- Separate symptoms with `|`
- Separate solution steps with `|`
- Keep `active` as `true` when the answer is ready for customers

The simplified CSV supports model-wise matching. If a customer gives a model such as `Archer C6`, the app first looks for that exact model. If no exact model answer exists, it checks the model family, then the category/problem, and finally falls back to the default guided troubleshooting JSON. Optional OpenAI/Gemini keys can later improve intent matching only; the app must still use manual CSV/JSON knowledge for the final solution.

Support knowledge is stored in JSON files inside the `data/` folder:

- `data/router.json`
- `data/camera.json`
- `data/printer.json`
- `data/ups.json`
- `data/warranty.json`
- `data/general.json`

To add a new issue, open the correct category file and add a new object like this:

```json
{
  "category": "Router / Internet",
  "keywords": ["wifi slow", "slow wifi", "ওয়াইফাই স্লো"],
  "solution": {
    "en": "Restart the router, check connected devices, and keep the router in an open place.",
    "bn": "রাউটার restart করুন, connected device check করুন এবং রাউটার খোলা জায়গায় রাখুন।"
  },
  "escalation_message": {
    "en": "If the issue remains, share router model and speed test result.",
    "bn": "সমস্যা থাকলে router model এবং speed test result লিখুন।"
  }
}
```

After editing JSON files, run:

```bash
npm run lint
npm run build
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

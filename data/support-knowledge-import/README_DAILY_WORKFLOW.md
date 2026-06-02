# Daily Knowledge Workflow

1. Export product list from ERP into:

```text
data/product-master/products_raw.csv
```

2. Export warranty claim report into:

```text
data/warranty-history/warranty_claims_raw.csv
```

3. Run:

```bash
npm run generate:knowledge:all
```

4. Open:

```text
data/support-knowledge-import/warranty_problem_suggestions.csv
```

Use it to find common product problems. This file is for internal review only.

5. Add only real approved solutions into:

```text
data/support-knowledge-import/simple_support_input.csv
```

6. Set `approvedByExcel` to `TRUE` only after checking the answer.

7. Run:

```bash
npm run generate:knowledge:simple
```

8. Test chat locally:

```bash
npm run dev
```

9. Commit and deploy after checking.

## Important Rules

- Do not use warranty report rows as public customer answers.
- Do not show customer, dealer, or third-party warranty report details to end users.
- Do not enter thousands of model-specific solutions unless the model really behaves differently.
- Use common workflows for many products.
- Use model/version-specific procedures for firmware or risky special cases.
- Router support is free and should be guided first.
- Other product replacement/RMA may require serial number, invoice, and warranty portal check.
- In `simple_support_input.csv`, separate customer symptom keywords, causes, solution steps, procedure steps, and follow-up questions with semicolon `;`.
- In `simple_support_input.csv`, separate multiple follow-up answers with double pipe `||`.

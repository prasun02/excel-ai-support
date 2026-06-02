# Beginner Support Knowledge Import

This folder is for Excel support engineers who want to enter product support knowledge in simple CSV files.

Manual support knowledge is the source of truth. The app should not invent technical solutions.

## Fill Files In This Order

1. `products_input.csv`
2. `problems_input.csv`
3. `diagnostic_questions_input.csv`
4. `solution_groups_input.csv`
5. `solution_steps_input.csv`
6. `procedures_input.csv`
7. `procedure_steps_input.csv`
8. `follow_up_questions_input.csv`
9. `escalation_rules_input.csv`

Start with products and common problems. Add procedures only when a step needs detailed instructions.

## Required Fields

- `products_input.csv`: `category`, `brand`, `model`, `modelFamily`, `deviceType`
- `problems_input.csv`: `category`, `problemName`, `symptomsKeywords`
- `diagnostic_questions_input.csv`: `problemName`, `questionOrder`, `questionText`
- `solution_groups_input.csv`: `problemName`, `stepGroupCode`, `title`
- `solution_steps_input.csv`: `problemName`, `stepGroupCode`, `stepOrder`, `customerStepText`
- `procedures_input.csv`: `procedureCode`, `procedureName`, `category`, `procedureType`
- `procedure_steps_input.csv`: `procedureCode`, `stepOrder`, `instruction`
- `follow_up_questions_input.csv`: `parentType`, `parentCode`, `questionKeywords`, `answer`
- `escalation_rules_input.csv`: `category`, `condition`, `escalationMessage`

## Optional Fields

- `hardwareVersion`
- `firmwareVersion`
- `imageUrl`
- `videoUrl`
- `procedureCode`
- `warning`

If `active` is blank, the generator treats it as `TRUE`.

## Auto-Generated IDs

You do not need to manually write these IDs:

- `productId`
- `problemId`
- `stepGroupId`
- `procedureId`
- `solutionId`

Examples:

- TP-Link + Archer C6 + V4 becomes `TP_LINK_ARCHER_C6_V4`
- Router / Internet + Internet Auto Disconnect becomes `ROUTER_INTERNET_AUTO_DISCONNECT_COMMON`
- Internet Auto Disconnect + CHECK_ADAPTER becomes `ROUTER_INTERNET_AUTO_DISCONNECT_COMMON_CHECK_ADAPTER`

## How To Avoid Mistakes

- Keep product names and model names consistent.
- Use semicolon `;` between keywords, not comma.
- Do not write long paragraphs in solution steps. Use multiple rows.
- Keep `stepGroupCode` short and clear, like `CHECK_ADAPTER`.
- Use the same `problemName` everywhere for the same problem.
- Set `active` to `FALSE` for draft or unverified data.

## Reuse Common Workflows

For 5000 products, do not create full troubleshooting data for every model.

Use this pattern:

1. Add every device in `products_input.csv`.
2. Add common workflows by category or model family in `problems_input.csv`.
3. Add model-specific solution only when that model is different.
4. Add model/version-specific procedures only for special cases.
5. Link follow-up answers to a problem, step group, procedure, or solution.

## Firmware Update Warning

Firmware update must be specific to model and hardware version.

Example: Archer C6 V4 firmware should not be used for Archer C6 V3. Wrong firmware or power loss during update can damage the router. For `firmware_update` procedures, `model`, `hardwareVersion`, and `warning` should be filled.

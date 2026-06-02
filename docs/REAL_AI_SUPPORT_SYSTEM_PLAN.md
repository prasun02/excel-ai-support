# Excel Service AI Real Support System Plan

Excel Service AI should use manual Excel-approved support knowledge as the source of truth for final customer solutions.

## Data Sources

- Product list import creates the master product database.
- Warranty claim report analysis finds common real problem patterns.
- `simple_support_input.csv` is the only manual customer-facing support input file.
- Approved rows become final support knowledge.
- Warranty report suggestions are internal only.
- Draft or unapproved suggestions are not shown as final customer solutions.

## Product Master

Paste ERP product export data into:

```text
data/product-master/products_raw.csv
```

The import script normalizes product name, item code, item group, brand, category, device type, model, and serial requirement.

## Warranty History

Paste warranty claim export data into:

```text
data/warranty-history/warranty_claims_raw.csv
```

This file is only for internal analysis. It must not be shown to customers. Dealer/customer/warranty report details stay private and should be checked in ERP or the warranty portal.

## Manual Support Knowledge

Enter approved support answers only in:

```text
data/support-knowledge-import/simple_support_input.csv
```

Rows with `approvedByExcel=TRUE` and `active=TRUE` become customer-facing support knowledge. Rows that are draft or unapproved are skipped.

## Router Support Policy

Router support is free and should be guided first through online support or CSP. Do not block router troubleshooting if serial number or warranty data is unavailable. Warranty may be needed only for replacement.

## Other Product Policy

Other products may require serial number, invoice, warranty status, or RMA checks for replacement or hardware service. ERP/warranty portal remains the source for actual warranty, customer, and dealer details.

## AI And Trusted Search

Hybrid AI and trusted search are optional and disabled by default:

```text
ENABLE_HYBRID_AI=false
ENABLE_TRUSTED_SEARCH=false
```

If enabled in the future, AI or trusted search may help classify intent or explain general possible causes. It must not invent final technical repair solutions. Risky actions like firmware update, reset, configuration, BIOS/flash/upgrade, RMA, warranty, and repair must use Excel-approved manual knowledge or official/trusted sources only.

## Final Fallback

If no approved exact solution exists, the app should say it does not have an Excel-approved exact solution yet and escalate to human CSP support.

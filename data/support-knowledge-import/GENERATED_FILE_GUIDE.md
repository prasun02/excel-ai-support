# Generated File Guide

## Workflow

1. Fill the CSV templates in `data/support-knowledge-import/`.
2. Run:

```bash
npm run generate:knowledge
```

3. Check the generated JSON files in `data/support-knowledge/`.
4. Run:

```bash
npm run dev
```

5. Test the app locally.
6. Commit changes only after checking the generated JSON.

## Validation Output Examples

```text
ERROR: products_input.csv row 3 missing model
ERROR: procedure ARCHER_C6_V4_FW_UPDATE has firmware_update type but hardwareVersion is empty
WARNING: videoUrl empty for firmware procedure
```

## Backup

Before JSON files are overwritten, the generator creates a backup folder:

```text
data/support-knowledge-backups/YYYY-MM-DD-HH-mm-ss/
```

If something goes wrong, copy files back from the latest backup.

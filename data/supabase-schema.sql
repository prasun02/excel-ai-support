-- Optional Supabase upgrade fields for Excel AI Smart Support tickets.
-- Safe to run multiple times in Supabase SQL editor.

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS product_model text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS serial_number text;

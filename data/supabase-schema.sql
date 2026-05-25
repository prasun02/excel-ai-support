-- Optional Supabase upgrade fields for Excel AI Smart Support tickets.
-- Safe to run multiple times in Supabase SQL editor.

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS product_model text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS serial_number text;

-- Optional MVP columns for office support workflow.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_person text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS internal_remarks text;

-- Optional table for future model-wise support knowledge import.
CREATE TABLE IF NOT EXISTS troubleshooting_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  brand text,
  product_model text,
  model_family text,
  device_type text,
  issue_type text NOT NULL,
  problem_keywords text[] DEFAULT '{}',
  bangla_keywords text[] DEFAULT '{}',
  banglish_keywords text[] DEFAULT '{}',
  misspellings text[] DEFAULT '{}',
  diagnostic_questions text[] DEFAULT '{}',
  solution_steps text[] DEFAULT '{}',
  escalation_message text,
  priority text DEFAULT 'medium',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

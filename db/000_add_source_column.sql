-- Migration to add source column if missing
ALTER TABLE national_pricing ADD COLUMN IF NOT EXISTS source TEXT;

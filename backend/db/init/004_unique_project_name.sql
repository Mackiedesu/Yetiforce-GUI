-- Migration 004: Enforce unique project names
-- Run this once against the existing database.
-- The constraint prevents race conditions at the DB level even if
-- the application-layer duplicate check is bypassed.

DO $$
BEGIN
  -- Only add the constraint if it doesn't already exist.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_projects_name' AND conrelid = 'projects'::regclass
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT uq_projects_name UNIQUE (name);
  END IF;
END $$;

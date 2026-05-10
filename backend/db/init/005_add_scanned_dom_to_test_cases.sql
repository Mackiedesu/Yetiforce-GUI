-- Add scanned DOM metadata to test cases so each AI-generated test case
-- retains the full page snapshot it was generated from.
ALTER TABLE test_cases
  ADD COLUMN IF NOT EXISTS scanned_dom_json JSONB NULL;

COMMENT ON COLUMN test_cases.scanned_dom_json
  IS 'Snapshot of DOM elements extracted from target_url at the time of AI generation';

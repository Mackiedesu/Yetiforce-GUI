CREATE TABLE IF NOT EXISTS test_suites (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_suite_test_cases (
  id UUID PRIMARY KEY,
  suite_id UUID NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  script TEXT,
  url TEXT,
  execution_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_suite_execution_order UNIQUE (suite_id, execution_order)
);

CREATE INDEX IF NOT EXISTS idx_test_suites_project_id ON test_suites(project_id);
CREATE INDEX IF NOT EXISTS idx_test_suite_test_cases_suite_id ON test_suite_test_cases(suite_id);

CREATE OR REPLACE FUNCTION set_test_suites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_test_suites_updated_at ON test_suites;
CREATE TRIGGER trg_test_suites_updated_at
BEFORE UPDATE ON test_suites
FOR EACH ROW
EXECUTE FUNCTION set_test_suites_updated_at();

CREATE OR REPLACE FUNCTION set_test_suite_test_cases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_test_suite_test_cases_updated_at ON test_suite_test_cases;
CREATE TRIGGER trg_test_suite_test_cases_updated_at
BEFORE UPDATE ON test_suite_test_cases
FOR EACH ROW
EXECUTE FUNCTION set_test_suite_test_cases_updated_at();

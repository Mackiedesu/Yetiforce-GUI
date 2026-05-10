CREATE TABLE IF NOT EXISTS test_cases (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  expected_result TEXT,
  script_content TEXT,
  target_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_case_steps (
  id UUID PRIMARY KEY,
  test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  parent_step_id UUID NULL REFERENCES test_case_steps(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  expected_result TEXT,
  step_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_test_case_steps_no_self_parent CHECK (parent_step_id IS NULL OR parent_step_id <> id)
);

CREATE TABLE IF NOT EXISTS test_case_data_sets (
  id UUID PRIMARY KEY,
  test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  data_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suite_test_case_links (
  id UUID PRIMARY KEY,
  suite_id UUID NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
  test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  execution_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_suite_test_case_link UNIQUE (suite_id, test_case_id),
  CONSTRAINT uq_suite_link_execution_order UNIQUE (suite_id, execution_order)
);

CREATE INDEX IF NOT EXISTS idx_test_cases_project_id ON test_cases(project_id);
CREATE INDEX IF NOT EXISTS idx_test_case_steps_test_case_id ON test_case_steps(test_case_id);
CREATE INDEX IF NOT EXISTS idx_test_case_data_sets_test_case_id ON test_case_data_sets(test_case_id);
CREATE INDEX IF NOT EXISTS idx_suite_test_case_links_suite_id ON suite_test_case_links(suite_id);
CREATE INDEX IF NOT EXISTS idx_suite_test_case_links_test_case_id ON suite_test_case_links(test_case_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_test_case_steps_root_order
  ON test_case_steps(test_case_id, step_order)
  WHERE parent_step_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_test_case_steps_child_order
  ON test_case_steps(test_case_id, parent_step_id, step_order)
  WHERE parent_step_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = 'test_suite_test_cases'
  ) THEN
    INSERT INTO test_cases (
      id,
      project_id,
      name,
      description,
      expected_result,
      script_content,
      target_url,
      created_at,
      updated_at
    )
    SELECT legacy_tc.id,
           ts.project_id,
           legacy_tc.name,
           legacy_tc.description,
           NULL,
           legacy_tc.script,
           legacy_tc.url,
           legacy_tc.created_at,
           legacy_tc.updated_at
      FROM test_suite_test_cases legacy_tc
      JOIN test_suites ts ON ts.id = legacy_tc.suite_id
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO suite_test_case_links (
      id,
      suite_id,
      test_case_id,
      execution_order,
      created_at,
      updated_at
    )
    SELECT legacy_tc.id,
           legacy_tc.suite_id,
           legacy_tc.id,
           legacy_tc.execution_order,
           legacy_tc.created_at,
           legacy_tc.updated_at
      FROM test_suite_test_cases legacy_tc
    ON CONFLICT (suite_id, test_case_id) DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION set_test_cases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_test_cases_updated_at ON test_cases;
CREATE TRIGGER trg_test_cases_updated_at
BEFORE UPDATE ON test_cases
FOR EACH ROW
EXECUTE FUNCTION set_test_cases_updated_at();

CREATE OR REPLACE FUNCTION set_test_case_steps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_test_case_steps_updated_at ON test_case_steps;
CREATE TRIGGER trg_test_case_steps_updated_at
BEFORE UPDATE ON test_case_steps
FOR EACH ROW
EXECUTE FUNCTION set_test_case_steps_updated_at();

CREATE OR REPLACE FUNCTION set_test_case_data_sets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_test_case_data_sets_updated_at ON test_case_data_sets;
CREATE TRIGGER trg_test_case_data_sets_updated_at
BEFORE UPDATE ON test_case_data_sets
FOR EACH ROW
EXECUTE FUNCTION set_test_case_data_sets_updated_at();

CREATE OR REPLACE FUNCTION set_suite_test_case_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_suite_test_case_links_updated_at ON suite_test_case_links;
CREATE TRIGGER trg_suite_test_case_links_updated_at
BEFORE UPDATE ON suite_test_case_links
FOR EACH ROW
EXECUTE FUNCTION set_suite_test_case_links_updated_at();

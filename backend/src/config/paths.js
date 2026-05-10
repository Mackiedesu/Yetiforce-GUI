const path = require('path');

const BACKEND_ROOT = path.join(__dirname, '..', '..');

const OBJECT_REPOSITORY_DIR = path.join(BACKEND_ROOT, 'object_repository');
const TEST_SUITES_DIR = path.join(BACKEND_ROOT, 'test_suites');
const REPORTS_DIR = path.join(BACKEND_ROOT, 'reports');
const SCREENSHOTS_DIR = path.join(REPORTS_DIR, 'screenshots');
const TMP_TESTS_DIR = path.join(BACKEND_ROOT, 'tmp_tests');

module.exports = {
  BACKEND_ROOT,
  OBJECT_REPOSITORY_DIR,
  TEST_SUITES_DIR,
  REPORTS_DIR,
  SCREENSHOTS_DIR,
  TMP_TESTS_DIR
};

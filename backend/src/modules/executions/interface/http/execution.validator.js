const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_BROWSERS = ['Chrome', 'Firefox', 'Edge', 'Chrome (headless)', 'Firefox (headless)'];
const ALLOWED_PROFILES = ['default', 'dev', 'staging', 'production'];

function validationError(msg) {
  const e = new Error(msg);
  e.statusCode = 400;
  return e;
}

function ensureUuid(value, field) {
  if (!UUID_PATTERN.test(String(value || ''))) {
    throw validationError(`${field} không hợp lệ`);
  }
}

function validateStartPayload(body) {
  const { project_path, suite_path, browser, profile } = body;

  if (!project_path || !project_path.trim()) {
    throw validationError('project_path là bắt buộc');
  }
  if (!suite_path || !suite_path.trim()) {
    throw validationError('suite_path là bắt buộc');
  }
  if (browser && !ALLOWED_BROWSERS.includes(browser)) {
    throw validationError(`browser không hợp lệ. Cho phép: ${ALLOWED_BROWSERS.join(', ')}`);
  }
  if (profile && !ALLOWED_PROFILES.includes(profile)) {
    throw validationError(`profile không hợp lệ. Cho phép: ${ALLOWED_PROFILES.join(', ')}`);
  }
}

module.exports = { ensureUuid, validateStartPayload, ALLOWED_BROWSERS, ALLOWED_PROFILES };

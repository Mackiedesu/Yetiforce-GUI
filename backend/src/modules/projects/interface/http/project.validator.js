/**
 * project.validator.js
 *
 * HTTP-layer validation for project payloads.
 * These checks are intentionally lightweight — they catch format errors
 * before we hit business logic or the database.
 *
 * Deeper validation (path existence, Katalon structure) lives in
 * katalonProjectParser.service.js so it is reusable without HTTP context.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// A project name must be 1–100 non-whitespace characters.
const MAX_NAME_LENGTH = 100;

// Matches Windows absolute path (C:\... or C:/...) or Unix absolute path (/...)
const ABSOLUTE_PATH_PATTERN = /^([a-zA-Z]:[/\\]|\/).+/;

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function ensureNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

// ────────────────────────────────────────────────────────────────────────────
// Exported validators
// ────────────────────────────────────────────────────────────────────────────

function ensureUuid(value, fieldName) {
  if (!UUID_PATTERN.test(String(value || ''))) {
    throw validationError(`${fieldName} không hợp lệ`);
  }
}

/**
 * Validates and sanitises the create / update payload.
 * Returns a clean object ready for persistence.
 */
function validateCreateOrUpdatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw validationError('Payload không hợp lệ');
  }

  // ── Name ──────────────────────────────────────────────────────────────────
  if (!ensureNonEmptyString(payload.name)) {
    throw validationError('Tên project là bắt buộc');
  }
  const trimmedName = payload.name.trim();
  if (trimmedName.length > MAX_NAME_LENGTH) {
    throw validationError(`Tên project không được vượt quá ${MAX_NAME_LENGTH} ký tự`);
  }

  // ── Katalon project path ──────────────────────────────────────────────────
  if (!ensureNonEmptyString(payload.katalon_project_path)) {
    throw validationError('Đường dẫn Katalon project là bắt buộc');
  }
  const trimmedPath = payload.katalon_project_path.trim();

  // Reject null bytes (security) and paths that are obviously not filesystem paths
  if (trimmedPath.includes('\0')) {
    throw validationError('Đường dẫn project chứa ký tự không hợp lệ');
  }
  if (!ABSOLUTE_PATH_PATTERN.test(trimmedPath)) {
    throw validationError(
      'Đường dẫn project không hợp lệ. ' +
      'Vui lòng nhập đường dẫn tuyệt đối, ví dụ: D:\\\\KatalonProjects\\\\MyProject'
    );
  }

  // ── Description (optional) ────────────────────────────────────────────────
  const description = typeof payload.description === 'string'
    ? payload.description.trim()
    : '';

  return {
    name: trimmedName,
    description,
    katalon_project_path: trimmedPath
  };
}

module.exports = {
  ensureUuid,
  validateCreateOrUpdatePayload
};

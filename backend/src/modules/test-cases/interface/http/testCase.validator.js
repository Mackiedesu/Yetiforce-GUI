const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function ensureUuid(value, fieldName) {
  if (!UUID_PATTERN.test(String(value || ''))) {
    throw validationError(`${fieldName} không hợp lệ`);
  }
}

function ensureText(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw validationError(`${fieldName} là bắt buộc`);
  }
}

/**
 * Normalize a step from ANY user-supplied format into the internal
 * { title, description, expected_result, children } shape.
 *
 * Accepted input formats:
 *  A) Internal:  { title, description?, expected_result?, children? }
 *  B) Action:    { action, target?, value?, step? }  ← Katalon-style
 *  C) Numbered:  { step, action, target?, value? }   ← same as B
 *  D) Minimal:   any string field used as title
 */
function normalizeStep(raw, index) {
  if (!raw || typeof raw !== 'object') {
    throw validationError(
      `Bước ${index + 1}: mỗi bước phải là một object JSON, không phải "${typeof raw}"`
    );
  }

  // Format A — already internal
  if (typeof raw.title === 'string' && raw.title.trim()) {
    return raw;
  }

  // Format B/C — action-based (Katalon / custom automation)
  if (typeof raw.action === 'string' && raw.action.trim()) {
    const stepNum   = raw.step ? `Bước ${raw.step}` : `Bước ${index + 1}`;
    const target    = raw.target  ? ` → ${raw.target}`  : '';
    const value     = raw.value   ? ` = "${raw.value}"` : '';
    return {
      title:           `${stepNum}: ${raw.action}${target}${value}`,
      description:     raw.description || raw.note || '',
      expected_result: raw.expected || raw.expected_result || '',
      children:        Array.isArray(raw.children) ? raw.children : [],
    };
  }

  // Format D — try any string field as title
  const anyString = raw.name || raw.label || raw.text || raw.content;
  if (typeof anyString === 'string' && anyString.trim()) {
    return {
      title:           anyString.trim(),
      description:     raw.description || '',
      expected_result: raw.expected_result || raw.expected || '',
      children:        Array.isArray(raw.children) ? raw.children : [],
    };
  }

  // Cannot normalize
  const keys = Object.keys(raw).join(', ');
  throw validationError(
    `Bước ${index + 1} không hợp lệ: không tìm thấy trường "title" hoặc "action". ` +
    `Các trường hiện có: [${keys}]. ` +
    `Cấu trúc hợp lệ: { "title": "Tên bước", "description": "...", "expected_result": "..." }`
  );
}

function validateStepPayload(step, path = 'step') {
  if (!step || typeof step !== 'object') {
    throw validationError(`${path} không hợp lệ`);
  }

  ensureText(step.title, `${path}.title`);

  const children = Array.isArray(step.children)
    ? step.children.map((child, index) => validateStepPayload(child, `${path}.children[${index}]`))
    : [];

  return {
    title: step.title.trim(),
    description: typeof step.description === 'string' ? step.description.trim() : '',
    expected_result: typeof step.expected_result === 'string' ? step.expected_result.trim() : '',
    children
  };
}

/**
 * Normalize a data set entry.
 * Accepted formats:
 *  A) Internal:   { name, data_json }        — already correct
 *  B) Raw object: { username, password, ... } — wrap into data_json automatically
 */
function normalizeDataSet(raw, index) {
  if (!raw || typeof raw !== 'object') {
    throw validationError(`data_sets[${index}] phải là object JSON`);
  }

  // Format A — already has name + data_json
  if (typeof raw.name === 'string' && raw.name.trim() && typeof raw.data_json !== 'undefined') {
    return raw;
  }

  // Format B — raw key/value pairs: wrap them
  const { name, data_json, ...rest } = raw;
  const autoName = raw.description || raw.name ||
    raw.label || raw.scenario || raw.case ||
    `Dữ liệu ${index + 1}`;

  // If there are remaining keys, treat them as data_json
  const dataPayload = Object.keys(rest).length > 0 ? rest : (data_json || {});

  return {
    name:     String(autoName).trim() || `Dữ liệu ${index + 1}`,
    data_json: dataPayload,
  };
}

function validateDataSetPayload(dataSet, index) {
  if (!dataSet || typeof dataSet !== 'object') {
    throw validationError(`data_sets[${index}] không hợp lệ`);
  }

  ensureText(dataSet.name, `data_sets[${index}].name`);

  if (typeof dataSet.data_json === 'undefined') {
    throw validationError(`data_sets[${index}].data_json là bắt buộc`);
  }

  return {
    name: dataSet.name.trim(),
    data_json: dataSet.data_json
  };
}

function validateTestCasePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw validationError('Payload test case không hợp lệ');
  }

  ensureText(payload.name, 'Tên test case');

  // Normalize steps: accept multiple formats, then strictly validate internal shape
  const rawSteps = Array.isArray(payload.steps) ? payload.steps : [];
  const normalizedSteps = rawSteps.map((raw, i) => normalizeStep(raw, i));
  const steps = normalizedSteps.map((step, index) => validateStepPayload(step, `steps[${index}]`));

  // Normalize data sets: accept raw key/value objects or internal format
  const rawDataSets = Array.isArray(payload.data_sets) ? payload.data_sets : [];
  const normalizedDataSets = rawDataSets.map((raw, i) => normalizeDataSet(raw, i));
  const dataSets = normalizedDataSets.map((item, index) => validateDataSetPayload(item, index));

  return {
    name: payload.name.trim(),
    description: typeof payload.description === 'string' ? payload.description.trim() : '',
    expected_result: typeof payload.expected_result === 'string' ? payload.expected_result.trim() : '',
    script: typeof payload.script === 'string' ? payload.script : '',
    url: typeof payload.url === 'string' ? payload.url : '',
    steps,
    data_sets: dataSets
  };
}

module.exports = {
  ensureUuid,
  validateTestCasePayload
};

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

  const steps = Array.isArray(payload.steps)
    ? payload.steps.map((step, index) => validateStepPayload(step, `steps[${index}]`))
    : [];
  const dataSets = Array.isArray(payload.data_sets)
    ? payload.data_sets.map((item, index) => validateDataSetPayload(item, index))
    : [];

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

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

function validateSuitePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw validationError('Payload không hợp lệ');
  }

  ensureText(payload.name, 'Tên suite');

  return {
    name: payload.name.trim(),
    description: typeof payload.description === 'string' ? payload.description.trim() : ''
  };
}

function validateTestCasePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw validationError('Payload test case không hợp lệ');
  }

  if (typeof payload.test_case_id !== 'undefined') {
    ensureUuid(payload.test_case_id, 'test_case_id');
    return {
      test_case_id: payload.test_case_id
    };
  }

  ensureText(payload.name, 'Tên test case');

  return {
    name: payload.name.trim(),
    description: typeof payload.description === 'string' ? payload.description.trim() : '',
    expected_result: typeof payload.expected_result === 'string' ? payload.expected_result.trim() : '',
    script: typeof payload.script === 'string' ? payload.script : '',
    url: typeof payload.url === 'string' ? payload.url : ''
  };
}

function validateReorderPayload(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.test_cases_order)) {
    throw validationError('Payload reorder không hợp lệ');
  }

  if (payload.test_cases_order.length === 0) {
    throw validationError('Danh sách reorder không được rỗng');
  }

  const parsed = payload.test_cases_order.map((item) => {
    if (!item || typeof item !== 'object') {
      throw validationError('Mỗi item reorder phải là object');
    }
    ensureUuid(item.id, 'test_case id');
    return { id: item.id };
  });

  return parsed;
}

module.exports = {
  ensureUuid,
  validateSuitePayload,
  validateTestCasePayload,
  validateReorderPayload
};

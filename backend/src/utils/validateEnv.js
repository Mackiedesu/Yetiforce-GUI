/**
 * validateEnv.js
 * Utility to validate Katalon-related environment variables at startup or on demand.
 */

const fs = require('fs');
const path = require('path');

/**
 * Validates KATALON_EXECUTABLE_PATH from process.env.
 *
 * @returns {{ valid: boolean, execPath: string|null, error: string|null }}
 */
function validateKatalonEnv() {
  const rawPath = process.env.KATALON_EXECUTABLE_PATH;

  if (!rawPath || !rawPath.trim()) {
    return {
      valid: false,
      execPath: null,
      error:
        'Biến môi trường KATALON_EXECUTABLE_PATH chưa được cấu hình trong file .env.',
    };
  }

  // Normalize: trim whitespace, resolve any relative path segments
  const execPath = path.resolve(rawPath.trim());

  // Check the filename ends with katalonc or katalonc.exe
  const basename = path.basename(execPath).toLowerCase();
  if (basename !== 'katalonc' && basename !== 'katalonc.exe') {
    return {
      valid: false,
      execPath,
      error: `KATALON_EXECUTABLE_PATH phải trỏ đến "katalonc.exe", nhưng nhận được: "${basename}"`,
    };
  }

  // Check the file actually exists on disk
  if (!fs.existsSync(execPath)) {
    return {
      valid: false,
      execPath,
      error: `Không tìm thấy Katalon CLI tại đường dẫn: "${execPath}". Vui lòng kiểm tra lại KATALON_EXECUTABLE_PATH trong .env.`,
    };
  }

  return { valid: true, execPath, error: null };
}

module.exports = { validateKatalonEnv };

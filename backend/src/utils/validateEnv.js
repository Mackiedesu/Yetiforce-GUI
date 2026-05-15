'use strict';

/**
 * validateEnv.js
 * Validates that the Mocha + Playwright execution environment is ready.
 */

const fs   = require('fs');
const path = require('path');

const BACKEND_ROOT         = path.resolve(__dirname, '../../..');
const BACKEND_NODE_MODULES = path.join(BACKEND_ROOT, 'node_modules');
const MOCHA_BIN            = path.join(BACKEND_NODE_MODULES, 'mocha', 'bin', 'mocha.js');
const PLAYWRIGHT_ENTRY     = path.join(BACKEND_NODE_MODULES, 'playwright', 'index.js');

/**
 * Validates the Mocha + Playwright execution environment.
 *
 * @returns {{ valid: boolean, error: string|null, details: object }}
 */
function validateKatalonEnv() {
  if (!fs.existsSync(MOCHA_BIN)) {
    return {
      valid: false,
      execPath: null,
      error:
        `Không tìm thấy Mocha binary tại "${MOCHA_BIN}". ` +
        'Chạy "npm install" trong thư mục backend.',
    };
  }

  if (!fs.existsSync(PLAYWRIGHT_ENTRY)) {
    return {
      valid: false,
      execPath: null,
      error:
        `Không tìm thấy Playwright tại "${PLAYWRIGHT_ENTRY}". ` +
        'Chạy "npm install" trong thư mục backend.',
    };
  }

  return {
    valid:    true,
    execPath: MOCHA_BIN,
    error:    null,
  };
}

module.exports = { validateKatalonEnv };

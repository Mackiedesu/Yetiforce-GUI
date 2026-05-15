'use strict';

/**
 * mochaSuiteScanner.service.js
 *
 * Replaces katalonSuiteScanner.service.js.
 * Scans a project's tests/suites/ directory for .spec.js suite files and
 * returns the same tree structure the frontend expects — so the Run Engine
 * UI (suite picker) works unchanged.
 *
 * Also detects legacy Katalon projects (has Test Suites/ but no tests/suites/)
 * and delegates to the original katalonSuiteScanner in that case, so imported
 * Katalon projects continue to work.
 *
 * Public API (identical to katalonSuiteScanner):
 *   scanKatalonSuites(projectPath) → { testSuitesPath, tree, suiteCount }
 *
 * Node shape (same as katalonSuiteScanner):
 *   { name, path, fullPath, type: 'folder'|'suite', children?, suiteCount? }
 *
 * path field for Mocha suites:   "suites/LoginSuite"
 * path field for Katalon suites: "Test Suites/LoginSuite"  (legacy)
 */

const fs   = require('fs');
const path = require('path');

const MOCHA_SUITES_FOLDER   = 'tests/suites';
const KATALON_SUITES_FOLDER = 'Test Suites';

// ── Error ─────────────────────────────────────────────────────────────────────

function scanError(message, code = 'SCAN_ERROR') {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = code;
  return err;
}

// ── Recursive scanner for .spec.js files ──────────────────────────────────────

function scanDir(absDir, relBase, depth = 0) {
  if (depth > 20) return { nodes: [], suiteCount: 0 };

  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'EACCES' || err.code === 'EPERM') return { nodes: [], suiteCount: 0 };
    throw err;
  }

  entries.sort((a, b) => {
    const aDir = a.isDirectory();
    const bDir = b.isDirectory();
    if (aDir && !bDir) return -1;
    if (!aDir && bDir) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  const nodes = [];
  let suiteCount = 0;

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const absEntry = path.join(absDir, entry.name);
    const relEntry = relBase ? `${relBase}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const { nodes: children, suiteCount: childCount } = scanDir(absEntry, relEntry, depth + 1);
      suiteCount += childCount;
      nodes.push({
        name:       entry.name,
        path:       relEntry,
        fullPath:   absEntry,
        type:       'folder',
        children,
        suiteCount: childCount,
      });
    } else if (entry.isFile()) {
      const lower = entry.name.toLowerCase();
      if (lower.endsWith('.spec.js') || lower.endsWith('.spec.ts')) {
        const stem = entry.name.replace(/\.spec\.(js|ts)$/i, '');
        const relSuitePath = relBase ? `${relBase}/${stem}` : stem;
        suiteCount += 1;
        nodes.push({
          name:     stem,
          path:     relSuitePath,
          fullPath: absEntry,
          type:     'suite',
        });
      }
    }
  }

  return { nodes, suiteCount };
}

// ── Katalon legacy scanner (inline, avoids circular dep) ─────────────────────

function scanKatalonDir(absDir, relBase, depth = 0) {
  if (depth > 20) return { nodes: [], suiteCount: 0 };

  let entries;
  try { entries = fs.readdirSync(absDir, { withFileTypes: true }); }
  catch { return { nodes: [], suiteCount: 0 }; }

  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  const nodes = [];
  let suiteCount = 0;

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const absEntry = path.join(absDir, entry.name);
    const relEntry = relBase ? `${relBase}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const { nodes: children, suiteCount: cc } = scanKatalonDir(absEntry, relEntry, depth + 1);
      suiteCount += cc;
      nodes.push({ name: entry.name, path: relEntry, fullPath: absEntry, type: 'folder', children, suiteCount: cc });
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.ts') {
      const stem = path.basename(entry.name, '.ts');
      const relSuitePath = relBase ? `${relBase}/${stem}` : stem;
      suiteCount += 1;
      nodes.push({ name: stem, path: relSuitePath, fullPath: absEntry, type: 'suite' });
    }
  }
  return { nodes, suiteCount };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Scan all suites in a project.
 * Auto-detects Mocha (tests/suites/) vs Katalon (Test Suites/) project type.
 *
 * @param {string} projectPath  Absolute path to the project root
 * @returns {{ testSuitesPath, tree, suiteCount }}
 */
function scanKatalonSuites(projectPath) {
  if (!projectPath || typeof projectPath !== 'string') {
    throw scanError('Đường dẫn project không hợp lệ.', 'INVALID_PATH');
  }

  const resolvedProject = path.resolve(projectPath.trim());

  if (!fs.existsSync(resolvedProject)) {
    throw scanError(`Không tìm thấy thư mục project: "${resolvedProject}"`, 'PROJECT_NOT_FOUND');
  }
  if (!fs.statSync(resolvedProject).isDirectory()) {
    throw scanError(`Đường dẫn không phải thư mục: "${resolvedProject}"`, 'NOT_A_DIR');
  }

  const mochaSuitesPath   = path.join(resolvedProject, ...MOCHA_SUITES_FOLDER.split('/'));
  const katalonSuitesPath = path.join(resolvedProject, KATALON_SUITES_FOLDER);

  // ── Mocha project ─────────────────────────────────────────────────────
  if (fs.existsSync(mochaSuitesPath)) {
    try { fs.accessSync(mochaSuitesPath, fs.constants.R_OK); } catch {
      throw scanError(`Không có quyền đọc thư mục suites: "${mochaSuitesPath}"`, 'NO_READ_PERMISSION');
    }
    const { nodes, suiteCount } = scanDir(mochaSuitesPath, 'suites');
    return { testSuitesPath: mochaSuitesPath, tree: nodes, suiteCount };
  }

  // ── Legacy Katalon project ────────────────────────────────────────────
  if (fs.existsSync(katalonSuitesPath)) {
    try { fs.accessSync(katalonSuitesPath, fs.constants.R_OK); } catch {
      throw scanError(`Không có quyền đọc thư mục suites: "${katalonSuitesPath}"`, 'NO_READ_PERMISSION');
    }
    const { nodes, suiteCount } = scanKatalonDir(katalonSuitesPath, 'Test Suites');
    return { testSuitesPath: katalonSuitesPath, tree: nodes, suiteCount };
  }

  // Neither exists
  throw scanError(
    `Không tìm thấy thư mục test suites trong project: "${resolvedProject}". ` +
    'Hãy tạo project mới hoặc đảm bảo project có thư mục "tests/suites".',
    'NO_TEST_SUITES_DIR',
  );
}

module.exports = { scanKatalonSuites, MOCHA_SUITES_FOLDER, KATALON_SUITES_FOLDER };

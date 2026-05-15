'use strict';

/**
 * katalonSuiteScanner.service.js
 *
 * Recursively scans a Katalon project's "Test Suites" directory and returns
 * a tree structure of all discoverable test suites.
 *
 * Katalon test suite files have the extension `.ts` (XML format).
 * Folders that contain no suites (directly or recursively) are still returned
 * so the UI can render the full tree with expand/collapse.
 *
 * Returned node shape:
 * {
 *   name:        string,     // display name (without extension)
 *   path:        string,     // relative Katalon path, e.g. "Test Suites/Login"
 *   fullPath:    string,     // absolute filesystem path
 *   type:        'folder' | 'suite',
 *   children?:   Node[],    // present for folders
 *   suiteCount?: number,    // total runnable suites under this folder
 * }
 */

const fs   = require('fs');
const path = require('path');

const TEST_SUITES_FOLDER = 'Test Suites';

// ────────────────────────────────────────────────────────────────────────────
// Errors
// ────────────────────────────────────────────────────────────────────────────

function scanError(message, code = 'SCAN_ERROR') {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = code;
  return err;
}

// ────────────────────────────────────────────────────────────────────────────
// Core recursive scanner
// ────────────────────────────────────────────────────────────────────────────

/**
 * Recursively read a directory and build a tree of suites.
 *
 * @param {string} absDir   Absolute path of the directory to scan
 * @param {string} relBase  Relative Katalon path base (e.g. "Test Suites")
 * @param {number} depth    Current recursion depth (guard against symlink loops)
 * @returns {{ nodes: Node[], suiteCount: number }}
 */
function scanDir(absDir, relBase, depth = 0) {
  if (depth > 20) {
    // Guard against pathologically deep structures or symlink loops
    return { nodes: [], suiteCount: 0 };
  }

  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      // Unreadable subdirectory — skip gracefully
      return { nodes: [], suiteCount: 0 };
    }
    throw err;
  }

  // Sort: folders first (alphabetical), then files (alphabetical)
  entries.sort((a, b) => {
    const aDir = a.isDirectory();
    const bDir = b.isDirectory();
    if (aDir && !bDir) return -1;
    if (!aDir && bDir) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  const nodes  = [];
  let suiteCount = 0;

  for (const entry of entries) {
    // Skip hidden files/folders (e.g. .git, .katalon)
    if (entry.name.startsWith('.')) continue;

    const absEntry  = path.join(absDir, entry.name);
    const relEntry  = relBase ? `${relBase}/${entry.name}` : entry.name;

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
      const ext  = path.extname(entry.name).toLowerCase();
      const stem = path.basename(entry.name, path.extname(entry.name));

      if (ext === '.ts') {
        // Katalon test suite file — strip extension for display
        const relSuitePath = relBase ? `${relBase}/${stem}` : stem;
        suiteCount += 1;
        nodes.push({
          name:     stem,
          path:     relSuitePath,
          fullPath: absEntry,
          type:     'suite',
        });
      }
      // Skip .groovy, .html, etc.
    }
  }

  return { nodes, suiteCount };
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Scan all test suites in a Katalon project.
 *
 * @param {string} projectPath  Absolute path to the Katalon project root
 * @returns {{
 *   testSuitesPath: string,
 *   tree: Node[],
 *   suiteCount: number
 * }}
 */
function scanKatalonSuites(projectPath) {
  if (!projectPath || typeof projectPath !== 'string') {
    throw scanError('Đường dẫn project không hợp lệ.', 'INVALID_PATH');
  }

  const resolvedProject = path.resolve(projectPath.trim());

  // 1. Project root must exist
  if (!fs.existsSync(resolvedProject)) {
    throw scanError(
      `Không tìm thấy thư mục project: "${resolvedProject}"`,
      'PROJECT_NOT_FOUND'
    );
  }

  // 2. Must be a directory
  let stat;
  try {
    stat = fs.statSync(resolvedProject);
  } catch (err) {
    throw scanError(`Không thể truy cập project: ${err.message}`, 'ACCESS_ERROR');
  }
  if (!stat.isDirectory()) {
    throw scanError(`Đường dẫn project không phải thư mục: "${resolvedProject}"`, 'NOT_A_DIR');
  }

  // 3. Test Suites subfolder
  const testSuitesPath = path.join(resolvedProject, TEST_SUITES_FOLDER);

  if (!fs.existsSync(testSuitesPath)) {
    throw scanError(
      `Thư mục "Test Suites" không tồn tại trong project: "${resolvedProject}". ` +
      'Đây không phải Katalon project hợp lệ hoặc project chưa có Test Suite nào.',
      'NO_TEST_SUITES_DIR'
    );
  }

  // 4. Must be readable
  try {
    fs.accessSync(testSuitesPath, fs.constants.R_OK);
  } catch {
    throw scanError(
      `Không có quyền đọc thư mục "Test Suites": "${testSuitesPath}"`,
      'NO_READ_PERMISSION'
    );
  }

  // 5. Recursively scan
  const { nodes, suiteCount } = scanDir(testSuitesPath, TEST_SUITES_FOLDER);

  return {
    testSuitesPath,
    tree: nodes,
    suiteCount,
  };
}

module.exports = {
  scanKatalonSuites,
  TEST_SUITES_FOLDER,
};

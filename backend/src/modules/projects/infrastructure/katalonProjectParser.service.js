/**
 * katalonProjectParser.service.js
 *
 * Validates and parses a Katalon Studio project directory.
 *
 * Validation order (fast-fail at each step):
 *  1. Format check  — path must look like a real absolute filesystem path
 *  2. Existence check — directory must actually exist on disk
 *  3. Type check     — must be a directory, not a file
 *  4. Accessibility  — must be readable by the current process
 *  5. Structure check — must contain at least one recognised Katalon folder
 */

const fs = require('fs');
const path = require('path');

// Katalon Studio creates these three as the minimum project skeleton.
// "Profiles" and "Scripts" are generated later and are optional at import time.
const REQUIRED_FOLDERS = [
  'Test Cases',
  'Test Suites',
  'Object Repository',
  'Profiles',
  'Scripts'
];

// Minimum folders needed to be considered a Katalon project
const MINIMUM_KATALON_FOLDERS = ['Test Cases', 'Test Suites', 'Object Repository'];

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function parserError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

/**
 * Returns true if the string looks like a plausible absolute filesystem path.
 *
 * Accepts:
 *   Windows: C:\Users\... or D:/Projects/...
 *   Linux/macOS: /home/user/... or /opt/katalon/...
 *
 * Rejects:
 *   - Pure garbage strings like "áddsađâsd"
 *   - Relative paths that have no drive letter / leading slash
 *   - Paths shorter than 3 characters (too short to be real)
 *   - Paths containing null bytes (security)
 */
function isPlausibleAbsolutePath(rawPath) {
  if (typeof rawPath !== 'string') return false;

  const trimmed = rawPath.trim();

  // Reject null bytes (security) and overly short strings
  if (trimmed.includes('\0') || trimmed.length < 3) return false;

  // Windows absolute path:  C:\ or C:/  (drive letter + colon + separator)
  const windowsAbsolute = /^[a-zA-Z]:[/\\]/;
  // Unix absolute path: starts with /
  const unixAbsolute = /^\//;

  return windowsAbsolute.test(trimmed) || unixAbsolute.test(trimmed);
}

// ────────────────────────────────────────────────────────────────────────────
// Main parser
// ────────────────────────────────────────────────────────────────────────────

function parseKatalonProjectStructure(projectPath) {
  // ── Step 1: Format validation ──────────────────────────────────────────────
  if (!isPlausibleAbsolutePath(projectPath)) {
    throw parserError(
      'Đường dẫn project không hợp lệ. ' +
      'Vui lòng nhập đường dẫn tuyệt đối hợp lệ, ví dụ: D:\\\\KatalonProjects\\\\MyProject'
    );
  }

  const resolvedPath = path.resolve(projectPath);

  // ── Step 2: Existence check ────────────────────────────────────────────────
  if (!fs.existsSync(resolvedPath)) {
    throw parserError(
      `Đường dẫn không tồn tại: "${resolvedPath}". ` +
      'Kiểm tra lại đường dẫn hoặc đảm bảo thư mục đã được tạo.'
    );
  }

  // ── Step 3: Type check ─────────────────────────────────────────────────────
  let stats;
  try {
    stats = fs.statSync(resolvedPath);
  } catch (err) {
    throw parserError(
      `Không thể truy cập đường dẫn: "${resolvedPath}". ` +
      `Chi tiết lỗi: ${err.message}`
    );
  }

  if (!stats.isDirectory()) {
    throw parserError(
      `Đường dẫn "${resolvedPath}" là một file, không phải thư mục. ` +
      'Vui lòng chọn thư mục gốc của Katalon project.'
    );
  }

  // ── Step 4: Read permission check ─────────────────────────────────────────
  try {
    fs.accessSync(resolvedPath, fs.constants.R_OK);
  } catch {
    throw parserError(
      `Không có quyền đọc thư mục: "${resolvedPath}". ` +
      'Kiểm tra quyền truy cập của thư mục.'
    );
  }

  // ── Step 5: Katalon structure check ───────────────────────────────────────
  const folders = {};
  const missingRequired = [];

  for (const folderName of REQUIRED_FOLDERS) {
    const folderPath = path.join(resolvedPath, folderName);
    let exists = false;
    try {
      exists = fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory();
    } catch {
      exists = false;
    }

    folders[folderName] = {
      exists,
      path: folderPath,
      file_count: exists ? countFiles(folderPath) : 0,
      tree: exists ? readTree(folderPath, 0, 4, 2000) : []
    };

    // Track which mandatory folders are missing
    if (MINIMUM_KATALON_FOLDERS.includes(folderName) && !exists) {
      missingRequired.push(folderName);
    }
  }

  // Must have all three minimum folders to be a Katalon project
  if (missingRequired.length > 0) {
    throw parserError(
      `Thư mục không phải Katalon project hợp lệ. ` +
      `Thiếu các thư mục bắt buộc: ${missingRequired.join(', ')}. ` +
      'Đảm bảo đây là thư mục gốc của Katalon Studio project.'
    );
  }

  return {
    root_path: resolvedPath,
    folders,
    summary: {
      required_folders: REQUIRED_FOLDERS,
      minimum_required: MINIMUM_KATALON_FOLDERS,
      found_count: REQUIRED_FOLDERS.filter((name) => folders[name].exists).length,
      missing_folders: REQUIRED_FOLDERS.filter((name) => !folders[name].exists)
    }
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Tree / file-count utilities
// ────────────────────────────────────────────────────────────────────────────

function countFiles(dirPath) {
  let total = 0;
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return 0; // unreadable subdirectory — skip gracefully
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      total += countFiles(path.join(dirPath, entry.name));
    } else {
      total += 1;
    }
  }
  return total;
}

function readTree(dirPath, depth, maxDepth, maxNodes, nodeState = { count: 0 }) {
  if (depth > maxDepth || nodeState.count >= maxNodes) return [];

  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return []; // unreadable subdirectory — skip gracefully
  }

  const tree = [];
  for (const entry of entries) {
    if (nodeState.count >= maxNodes) break;

    const fullPath = path.join(dirPath, entry.name);
    nodeState.count += 1;
    const node = {
      name: entry.name,
      type: entry.isDirectory() ? 'folder' : 'file',
      path: fullPath
    };

    if (entry.isDirectory() && depth < maxDepth) {
      node.children = readTree(fullPath, depth + 1, maxDepth, maxNodes, nodeState);
    }

    tree.push(node);
  }
  return tree;
}

module.exports = {
  parseKatalonProjectStructure,
  REQUIRED_FOLDERS,
  MINIMUM_KATALON_FOLDERS
};

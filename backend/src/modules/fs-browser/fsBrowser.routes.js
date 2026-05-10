'use strict';

/**
 * fsBrowser.routes.js
 *
 * Exposes two endpoints so the React frontend can browse the SERVER's local
 * filesystem and let users pick paths without typing them manually.
 *
 * Why server-side?
 * ─────────────────
 * Browsers cannot access the host machine's filesystem (security sandbox).
 * This backend API acts as a "file-manager proxy" — the frontend calls it,
 * it reads the real filesystem, and returns a JSON directory listing.
 *
 * Endpoints
 * ─────────
 * GET  /api/fs/browse?path=<dir>         – list children of a directory
 * POST /api/fs/validate                  – check a path exists + its type
 * GET  /api/fs/drives                    – list Windows drive letters (C:\, D:\, …)
 */

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const { execSync } = require('child_process');
const { asyncHandler } = require('../../utils/asyncHandler');

const router = express.Router();

// ── Security: block paths outside allowed roots ──────────────────────────────
// Allow any absolute path — the server is on the same machine as Katalon.
// If you want to restrict browsing, set FS_BROWSER_ROOT in .env.
function isAllowedPath(requestedPath) {
  const root = process.env.FS_BROWSER_ROOT;
  if (!root) return true; // no restriction
  const resolved = path.resolve(requestedPath);
  return resolved.startsWith(path.resolve(root));
}

// ── GET /api/fs/drives ────────────────────────────────────────────────────────
router.get('/drives', asyncHandler(async (_req, res) => {
  const platform = os.platform();
  let drives = [];

  if (platform === 'win32') {
    try {
      // wmic logicaldisk returns lines like "C:", "D:", etc.
      const raw = execSync('wmic logicaldisk get Caption', { encoding: 'utf8', timeout: 5000 });
      drives = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => /^[A-Z]:$/i.test(l))
        .map((letter) => ({
          name: letter + '\\',
          path: letter + '\\',
          type: 'drive',
        }));
    } catch {
      // fallback: common letters
      drives = ['C', 'D', 'E', 'F'].map((l) => ({
        name: l + ':\\',
        path: l + ':\\',
        type: 'drive',
      }));
    }
  } else {
    // Unix — start from filesystem root
    drives = [{ name: '/', path: '/', type: 'drive' }];
  }

  return res.json({ success: true, drives });
}));

// ── GET /api/fs/browse?path=<dir>&showFiles=<bool> ────────────────────────────
router.get('/browse', asyncHandler(async (req, res) => {
  const rawPath    = req.query.path || os.homedir();
  const showFiles  = req.query.showFiles !== 'false'; // default true
  const filterExt  = req.query.ext || '';             // e.g. ".exe" to only show .exe files

  const requestedPath = path.resolve(rawPath);

  if (!isAllowedPath(requestedPath)) {
    return res.status(403).json({ error: 'Đường dẫn này không được phép duyệt.' });
  }

  let stat;
  try {
    stat = fs.statSync(requestedPath);
  } catch {
    return res.status(404).json({ error: `Không tìm thấy đường dẫn: "${requestedPath}"` });
  }

  if (!stat.isDirectory()) {
    return res.status(400).json({ error: `Đường dẫn không phải là thư mục: "${requestedPath}"` });
  }

  let entries;
  try {
    entries = fs.readdirSync(requestedPath, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      return res.status(403).json({ error: `Không có quyền truy cập: "${requestedPath}"` });
    }
    throw err;
  }

  const items = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '..') continue; // skip hidden

    const fullPath = path.join(requestedPath, entry.name);
    const isDir    = entry.isDirectory();
    const isFile   = entry.isFile();

    if (!isDir && !showFiles) continue;

    if (isFile && filterExt && !entry.name.toLowerCase().endsWith(filterExt.toLowerCase())) {
      continue;
    }

    items.push({
      name:    entry.name,
      path:    fullPath,
      type:    isDir ? 'directory' : 'file',
      isDir,
    });
  }

  // Sort: directories first, then files, both alphabetical
  items.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  // Build breadcrumb
  const parts = requestedPath.split(path.sep).filter(Boolean);
  const breadcrumb = [];

  if (os.platform() === 'win32') {
    // Windows: first part is "C:" or similar
    let accumulated = '';
    for (let i = 0; i < parts.length; i++) {
      if (i === 0) {
        accumulated = parts[0] + '\\';
      } else {
        accumulated = path.join(accumulated, parts[i]);
      }
      breadcrumb.push({ name: parts[i] || accumulated, path: accumulated });
    }
  } else {
    breadcrumb.push({ name: '/', path: '/' });
    let accumulated = '/';
    for (const part of parts) {
      accumulated = path.join(accumulated, part);
      breadcrumb.push({ name: part, path: accumulated });
    }
  }

  return res.json({
    success:    true,
    currentPath: requestedPath,
    parentPath:  path.dirname(requestedPath) !== requestedPath
      ? path.dirname(requestedPath)
      : null,
    breadcrumb,
    items,
  });
}));

// ── POST /api/fs/validate ─────────────────────────────────────────────────────
router.post('/validate', asyncHandler(async (req, res) => {
  const { path: rawPath, expectType } = req.body;
  // expectType: 'file' | 'directory' | undefined (any)

  if (!rawPath || !String(rawPath).trim()) {
    return res.status(400).json({ valid: false, error: 'Đường dẫn không được để trống.' });
  }

  const resolved = path.resolve(String(rawPath).trim());

  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch {
    return res.json({
      valid: false,
      path:  resolved,
      error: `Không tìm thấy: "${resolved}"`,
    });
  }

  const actualType = stat.isDirectory() ? 'directory' : 'file';

  if (expectType && actualType !== expectType) {
    const expected = expectType === 'directory' ? 'thư mục' : 'file';
    return res.json({
      valid: false,
      path:  resolved,
      type:  actualType,
      error: `Đường dẫn này là ${actualType}, cần ${expected}: "${resolved}"`,
    });
  }

  return res.json({
    valid: true,
    path:  resolved,
    type:  actualType,
  });
}));

module.exports = { fsBrowserRouter: router };

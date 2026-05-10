import axios from 'axios';
import { BACKEND_URL } from '../../config/endpoints';

const api = axios.create({ baseURL: `${BACKEND_URL}/api/fs` });

/**
 * List Windows drive letters (C:\, D:\, …)
 * @returns {Promise<{ drives: Array<{name,path,type}> }>}
 */
export async function listDrives() {
  const { data } = await api.get('/drives');
  return data;
}

/**
 * Browse a directory on the server machine.
 * @param {string} dirPath   Absolute path to browse
 * @param {object} [opts]
 * @param {boolean} [opts.showFiles=true]  Include files (not just dirs)
 * @param {string}  [opts.ext]             Filter files by extension, e.g. ".exe"
 */
export async function browseDirectory(dirPath, { showFiles = true, ext = '' } = {}) {
  const params = { path: dirPath, showFiles: String(showFiles) };
  if (ext) params.ext = ext;
  const { data } = await api.get('/browse', { params });
  return data;
}

/**
 * Validate that a path exists on the server and optionally check its type.
 * @param {string} filePath
 * @param {'file'|'directory'|undefined} expectType
 * @returns {Promise<{ valid: boolean, path: string, type: string, error?: string }>}
 */
export async function validatePath(filePath, expectType) {
  const { data } = await api.post('/validate', { path: filePath, expectType });
  return data;
}

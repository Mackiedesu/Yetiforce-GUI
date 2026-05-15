import axios from 'axios';
import { BACKEND_URL } from '../../config/endpoints';

const BASE = `${BACKEND_URL}/api/ai-agent`;

/** Step 1 — Scan a URL and return DOM elements */
export async function scanUrl(url) {
  const response = await axios.post(`${BASE}/scan-url`, { url });
  return response.data;
}

/** Step 2 — Generate test cases from the scanned DOM */
export async function generateFromDom({ url, title, elements }) {
  const response = await axios.post(`${BASE}/generate-from-dom`, { url, title, elements });
  return response.data;
}

/** Save selected test cases into a project (works for both DOM and text flows).
 *  Pass suiteId to automatically link each test case into that suite and sync the .ts file.
 */
export async function saveTestCases(projectId, testCases, sourceUrl = null, scannedDomJson = null, suiteId = null) {
  const response = await axios.post(`${BASE}/save`, {
    project_id: projectId,
    suite_id: suiteId || undefined,
    testCases,
    source_url: sourceUrl,
    scanned_dom_json: scannedDomJson,
  });
  return response.data;
}

/** Legacy: generate test cases from plain-text description */
export async function generateTestCases(requirement) {
  const response = await axios.post(`${BASE}/generate`, { requirement });
  return response.data;
}

import axios from 'axios';

import { BACKEND_URL } from '../../config/endpoints';

export async function listProjectSuites(projectId) {
  const response = await axios.get(`${BACKEND_URL}/api/projects/${projectId}/suites`);
  return response.data;
}

/**
 * Recursively scans the Katalon project's "Test Suites" directory on disk.
 * Returns a typed tree of all .ts suite files + folder structure.
 * Also returns testSuitesPath (absolute path to the Test Suites folder)
 * so the UI can open the folder picker at that exact location.
 */
export async function scanProjectSuites(projectId) {
  const response = await axios.get(`${BACKEND_URL}/api/projects/${projectId}/scan-suites`);
  return response.data;
}

export async function createProjectSuite(projectId, payload) {
  const response = await axios.post(`${BACKEND_URL}/api/projects/${projectId}/suites`, payload);
  return response.data;
}

export async function getProjectSuite(projectId, suiteId) {
  const response = await axios.get(`${BACKEND_URL}/api/projects/${projectId}/suites/${suiteId}`);
  return response.data;
}

export async function updateProjectSuite(projectId, suiteId, payload) {
  const response = await axios.put(`${BACKEND_URL}/api/projects/${projectId}/suites/${suiteId}`, payload);
  return response.data;
}

export async function deleteProjectSuite(projectId, suiteId) {
  const response = await axios.delete(`${BACKEND_URL}/api/projects/${projectId}/suites/${suiteId}`);
  return response.data;
}

export async function addSuiteTestCase(projectId, suiteId, payload) {
  const response = await axios.post(`${BACKEND_URL}/api/projects/${projectId}/suites/${suiteId}/test-cases`, payload);
  return response.data;
}

export async function updateSuiteTestCase(projectId, suiteId, testCaseId, payload) {
  const response = await axios.put(`${BACKEND_URL}/api/projects/${projectId}/suites/${suiteId}/test-cases/${testCaseId}`, payload);
  return response.data;
}

export async function deleteSuiteTestCase(projectId, suiteId, testCaseId) {
  const response = await axios.delete(`${BACKEND_URL}/api/projects/${projectId}/suites/${suiteId}/test-cases/${testCaseId}`);
  return response.data;
}

export async function reorderSuiteTestCases(projectId, suiteId, testCaseIds) {
  const response = await axios.patch(`${BACKEND_URL}/api/projects/${projectId}/suites/${suiteId}/reorder`, {
    test_cases_order: testCaseIds.map((id) => ({ id }))
  });
  return response.data;
}

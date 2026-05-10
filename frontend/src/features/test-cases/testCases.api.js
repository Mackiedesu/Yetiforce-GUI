import axios from 'axios';

import { BACKEND_URL } from '../../config/endpoints';

export async function listProjectTestCases(projectId) {
  const response = await axios.get(`${BACKEND_URL}/api/projects/${projectId}/test-cases`);
  return response.data;
}

export async function getProjectTestCase(projectId, testCaseId) {
  const response = await axios.get(`${BACKEND_URL}/api/projects/${projectId}/test-cases/${testCaseId}`);
  return response.data;
}

export async function createProjectTestCase(projectId, payload) {
  const response = await axios.post(`${BACKEND_URL}/api/projects/${projectId}/test-cases`, payload);
  return response.data;
}

export async function updateProjectTestCase(projectId, testCaseId, payload) {
  const response = await axios.put(`${BACKEND_URL}/api/projects/${projectId}/test-cases/${testCaseId}`, payload);
  return response.data;
}

export async function deleteProjectTestCase(projectId, testCaseId) {
  const response = await axios.delete(`${BACKEND_URL}/api/projects/${projectId}/test-cases/${testCaseId}`);
  return response.data;
}

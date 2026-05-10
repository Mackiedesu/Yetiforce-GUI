import axios from 'axios';
import { BACKEND_URL } from '../../config/endpoints';

export async function startExecution(payload) {
  const response = await axios.post(`${BACKEND_URL}/api/executions`, payload);
  return response.data;
}

export async function listExecutions({ page = 1, limit = 10, status } = {}) {
  const params = { page, limit };
  if (status) params.status = status;
  const response = await axios.get(`${BACKEND_URL}/api/executions`, { params });
  return response.data;
}

export async function getExecutionStats() {
  const response = await axios.get(`${BACKEND_URL}/api/executions/stats`);
  return response.data;
}

export async function getExecution(id) {
  const response = await axios.get(`${BACKEND_URL}/api/executions/${id}`);
  return response.data;
}

export async function deleteExecution(id) {
  const response = await axios.delete(`${BACKEND_URL}/api/executions/${id}`);
  return response.data;
}

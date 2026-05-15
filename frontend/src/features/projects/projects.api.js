import axios from 'axios';
import { BACKEND_URL } from '../../config/endpoints';

export async function listProjects() {
  const response = await axios.get(`${BACKEND_URL}/api/projects`);
  return response.data;
}

export async function createProject(payload) {
  const response = await axios.post(`${BACKEND_URL}/api/projects`, payload);
  return response.data;
}

/**
 * Generate a new Katalon project on disk + register in DB.
 * payload: { name, description, save_directory }
 */
export async function generateProject(payload) {
  const response = await axios.post(`${BACKEND_URL}/api/projects/generate`, payload);
  return response.data;
}

export async function updateProject(projectId, payload) {
  const response = await axios.put(`${BACKEND_URL}/api/projects/${projectId}`, payload);
  return response.data;
}

export async function deleteProject(projectId) {
  const response = await axios.delete(`${BACKEND_URL}/api/projects/${projectId}`);
  return response.data;
}

export async function importProject(payload) {
  const response = await axios.post(`${BACKEND_URL}/api/projects/import`, payload);
  return response.data;
}

export async function getProjectStructure(projectId) {
  const response = await axios.get(`${BACKEND_URL}/api/projects/${projectId}/structure`);
  return response.data;
}

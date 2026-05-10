import axios from 'axios';
import { BACKEND_URL } from '../../config/endpoints';

export async function scanPage(url) {
  const response = await axios.post(`${BACKEND_URL}/api/scanner/scan`, { url });
  return response.data;
}

export async function generateFromScan({ url, title, elements }) {
  const response = await axios.post(`${BACKEND_URL}/api/scanner/generate`, { url, title, elements });
  return response.data;
}

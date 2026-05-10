/**
 * env.js — Central environment configuration.
 *
 * dotenv.config() is called here as a safety guard so that this module
 * always works correctly regardless of import order. dotenv is idempotent:
 * if the caller already ran dotenv.config() the call is a no-op.
 *
 * IMPORTANT: KATALON_EXECUTABLE_PATH and KATALON_API_KEY are read lazily
 * via getter properties to prevent the module-cache/import-order race where
 * Node evaluates this file before dotenv has populated process.env, causing
 * the value to be permanently baked as the fallback 'katalonc'.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// ── Static config (safe to read once at module load) ────────────────────────
const PORT = Number(process.env.PORT) || 5000;

const POSTGRES_HOST     = process.env.POSTGRES_HOST     || '127.0.0.1';
const POSTGRES_PORT     = Number(process.env.POSTGRES_PORT) || 5432;
const POSTGRES_DB       = process.env.POSTGRES_DB       || 'yetiforce_gui';
const POSTGRES_USER     = process.env.POSTGRES_USER     || 'yetiforce';
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'yetiforce_pwd';
const POSTGRES_SSL      = process.env.POSTGRES_SSL === 'true';

// ── Lazy getters: read from process.env at access-time, not at import-time ──
// This ensures the values reflect what dotenv actually loaded, no matter
// when this module was first imported.
const env = {
  PORT,
  POSTGRES_HOST,
  POSTGRES_PORT,
  POSTGRES_DB,
  POSTGRES_USER,
  POSTGRES_PASSWORD,
  POSTGRES_SSL,

  get KATALON_API_KEY() {
    return process.env.KATALON_API_KEY || '';
  },

  get KATALON_EXECUTABLE_PATH() {
    return process.env.KATALON_EXECUTABLE_PATH || '';
  },
};

module.exports = env;

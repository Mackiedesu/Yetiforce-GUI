const { Pool } = require('pg');

const {
  POSTGRES_HOST,
  POSTGRES_PORT,
  POSTGRES_DB,
  POSTGRES_USER,
  POSTGRES_PASSWORD,
  POSTGRES_SSL
} = require('./env');

const pool = new Pool({
  host: POSTGRES_HOST,
  port: POSTGRES_PORT,
  database: POSTGRES_DB,
  user: POSTGRES_USER,
  password: POSTGRES_PASSWORD,
  ssl: POSTGRES_SSL ? { rejectUnauthorized: false } : false
});

async function ensureDatabaseReady() {
  await pool.query('SELECT 1');
}

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  query,
  ensureDatabaseReady
};

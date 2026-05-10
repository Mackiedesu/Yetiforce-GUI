const { randomUUID } = require('crypto');

const { query } = require('../../../config/database');
const { toProjectDto } = require('../domain/project.entity');

/**
 * Map PostgreSQL constraint error codes to friendly application errors.
 * 23505 = unique_violation — thrown when UNIQUE constraint is breached.
 */
function handlePgError(error) {
  if (error.code === '23505') {
    // Extract the constraint name to give a targeted message
    const detail = error.detail || '';
    if (detail.includes('name') || (error.constraint && error.constraint.includes('name'))) {
      const conflict = new Error('Tên project đã tồn tại. Vui lòng chọn tên khác.');
      conflict.statusCode = 409;
      throw conflict;
    }
    const conflict = new Error('Dữ liệu bị trùng lặp. Vui lòng kiểm tra lại.');
    conflict.statusCode = 409;
    throw conflict;
  }
  throw error;
}

async function listProjects() {
  const result = await query(
    'SELECT id, name, description, katalon_project_path, created_at, updated_at FROM projects ORDER BY created_at DESC'
  );
  return result.rows.map(toProjectDto);
}

async function getProjectById(id) {
  const result = await query(
    'SELECT id, name, description, katalon_project_path, created_at, updated_at FROM projects WHERE id = $1 LIMIT 1',
    [id]
  );
  return toProjectDto(result.rows[0]);
}

/**
 * Find a project by its name (case-insensitive).
 * Used for application-level duplicate check before INSERT/UPDATE.
 */
async function findProjectByName(name) {
  const result = await query(
    'SELECT id, name FROM projects WHERE LOWER(name) = LOWER($1) LIMIT 1',
    [name]
  );
  return result.rows[0] || null;
}

async function createProject(payload) {
  const id = randomUUID();
  try {
    const result = await query(
      `INSERT INTO projects (id, name, description, katalon_project_path)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, katalon_project_path, created_at, updated_at`,
      [id, payload.name, payload.description || null, payload.katalon_project_path]
    );
    return toProjectDto(result.rows[0]);
  } catch (error) {
    return handlePgError(error);
  }
}

async function updateProject(id, payload) {
  try {
    const result = await query(
      `UPDATE projects
         SET name = $2,
             description = $3,
             katalon_project_path = $4,
             updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, description, katalon_project_path, created_at, updated_at`,
      [id, payload.name, payload.description || null, payload.katalon_project_path]
    );
    return toProjectDto(result.rows[0]);
  } catch (error) {
    return handlePgError(error);
  }
}

async function deleteProject(id) {
  const result = await query('DELETE FROM projects WHERE id = $1', [id]);
  return result.rowCount > 0;
}

module.exports = {
  listProjects,
  getProjectById,
  findProjectByName,
  createProject,
  updateProject,
  deleteProject
};

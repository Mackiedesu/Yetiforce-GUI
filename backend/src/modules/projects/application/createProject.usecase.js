/**
 * createProject.usecase.js
 *
 * Business rule: project names must be unique (case-insensitive).
 * The application-level check runs before the INSERT so we get a
 * clear 409 Conflict rather than a raw PostgreSQL constraint error.
 * The DB UNIQUE constraint on `projects.name` is the final safety net
 * against race conditions.
 */
async function createProjectUseCase(projectRepository, payload) {
  // Application-level duplicate check (prevents obvious duplicates
  // and gives a better error message than a raw PG constraint error)
  const existing = await projectRepository.findProjectByName(payload.name);
  if (existing) {
    const error = new Error('Tên project đã tồn tại. Vui lòng chọn tên khác.');
    error.statusCode = 409;
    throw error;
  }

  return projectRepository.createProject(payload);
}

module.exports = {
  createProjectUseCase
};

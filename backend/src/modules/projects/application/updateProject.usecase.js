/**
 * updateProject.usecase.js
 *
 * Business rule: project names must be unique (case-insensitive).
 * When updating, we check for a name conflict only against OTHER projects
 * (not the project being edited — renaming to the same name is allowed).
 */
async function updateProjectUseCase(projectRepository, projectId, payload) {
  // Check for name conflict excluding the project being updated
  const existing = await projectRepository.findProjectByName(payload.name);
  if (existing && existing.id !== projectId) {
    const error = new Error('Tên project đã tồn tại. Vui lòng chọn tên khác.');
    error.statusCode = 409;
    throw error;
  }

  return projectRepository.updateProject(projectId, payload);
}

module.exports = {
  updateProjectUseCase
};

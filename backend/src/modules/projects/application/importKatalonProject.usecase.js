/**
 * importKatalonProject.usecase.js
 *
 * Validates the Katalon project path structure FIRST (fast-fail if invalid),
 * then checks for a duplicate project name before persisting.
 * This order ensures the user gets the most actionable error first.
 */
async function importKatalonProjectUseCase(projectRepository, parserService, payload) {
  // 1. Validate Katalon folder structure (throws 400 if invalid)
  const structure = parserService.parseKatalonProjectStructure(payload.katalon_project_path);

  // 2. Application-level duplicate name check (throws 409 if conflict)
  const existing = await projectRepository.findProjectByName(payload.name);
  if (existing) {
    const error = new Error('Tên project đã tồn tại. Vui lòng chọn tên khác.');
    error.statusCode = 409;
    throw error;
  }

  // 3. Persist — DB UNIQUE constraint is the final safety net
  const project = await projectRepository.createProject(payload);

  return {
    project,
    structure
  };
}

module.exports = {
  importKatalonProjectUseCase
};

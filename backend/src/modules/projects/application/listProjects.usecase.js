async function listProjectsUseCase(projectRepository) {
  return projectRepository.listProjects();
}

module.exports = {
  listProjectsUseCase
};

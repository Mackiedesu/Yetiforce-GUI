async function getProjectUseCase(projectRepository, projectId) {
  return projectRepository.getProjectById(projectId);
}

module.exports = {
  getProjectUseCase
};

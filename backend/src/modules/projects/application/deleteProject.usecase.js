async function deleteProjectUseCase(projectRepository, projectId) {
  return projectRepository.deleteProject(projectId);
}

module.exports = {
  deleteProjectUseCase
};

async function getProjectStructureUseCase(projectRepository, parserService, projectId) {
  const project = await projectRepository.getProjectById(projectId);
  if (!project) {
    return null;
  }

  const structure = parserService.parseKatalonProjectStructure(project.katalon_project_path);

  return {
    project,
    structure
  };
}

module.exports = {
  getProjectStructureUseCase
};

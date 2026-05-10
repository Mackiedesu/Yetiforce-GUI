const {
  listProjectsUseCase
} = require('../../application/listProjects.usecase');
const {
  getProjectUseCase
} = require('../../application/getProject.usecase');
const {
  createProjectUseCase
} = require('../../application/createProject.usecase');
const {
  updateProjectUseCase
} = require('../../application/updateProject.usecase');
const {
  deleteProjectUseCase
} = require('../../application/deleteProject.usecase');
const {
  importKatalonProjectUseCase
} = require('../../application/importKatalonProject.usecase');
const {
  getProjectStructureUseCase
} = require('../../application/getProjectStructure.usecase');

const projectRepository = require('../../infrastructure/project.repository.pg');
const parserService = require('../../infrastructure/katalonProjectParser.service');
const { ensureUuid, validateCreateOrUpdatePayload } = require('./project.validator');

async function listProjectsHandler(req, res) {
  const projects = await listProjectsUseCase(projectRepository);
  return res.json({ success: true, projects });
}

async function getProjectHandler(req, res) {
  ensureUuid(req.params.id, 'id');
  const project = await getProjectUseCase(projectRepository, req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project không tồn tại' });
  }

  return res.json({ success: true, project });
}

async function createProjectHandler(req, res) {
  const payload = validateCreateOrUpdatePayload(req.body);
  const project = await createProjectUseCase(projectRepository, payload);
  return res.json({ success: true, project });
}

async function updateProjectHandler(req, res) {
  ensureUuid(req.params.id, 'id');
  const payload = validateCreateOrUpdatePayload(req.body);
  const project = await updateProjectUseCase(projectRepository, req.params.id, payload);
  if (!project) {
    return res.status(404).json({ error: 'Project không tồn tại' });
  }

  return res.json({ success: true, project });
}

async function deleteProjectHandler(req, res) {
  ensureUuid(req.params.id, 'id');
  const isDeleted = await deleteProjectUseCase(projectRepository, req.params.id);
  if (!isDeleted) {
    return res.status(404).json({ error: 'Project không tồn tại' });
  }

  return res.json({ success: true });
}

async function importProjectHandler(req, res) {
  const payload = validateCreateOrUpdatePayload(req.body);
  const result = await importKatalonProjectUseCase(projectRepository, parserService, payload);
  return res.json({ success: true, ...result });
}

async function getProjectStructureHandler(req, res) {
  ensureUuid(req.params.id, 'id');
  const result = await getProjectStructureUseCase(projectRepository, parserService, req.params.id);
  if (!result) {
    return res.status(404).json({ error: 'Project không tồn tại' });
  }

  return res.json({ success: true, ...result });
}

module.exports = {
  listProjectsHandler,
  getProjectHandler,
  createProjectHandler,
  updateProjectHandler,
  deleteProjectHandler,
  importProjectHandler,
  getProjectStructureHandler
};

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
const {
  generateKatalonProjectUseCase
} = require('../../application/generateKatalonProject.usecase');

const projectRepository = require('../../infrastructure/project.repository.pg');
const parserService     = require('../../infrastructure/katalonProjectParser.service');
const { scanKatalonSuites } = require('../../infrastructure/mochaSuiteScanner.service');
const { ensureUuid, validateCreateOrUpdatePayload, validateGeneratePayload } = require('./project.validator');

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

/**
 * POST /api/projects/generate
 *
 * Generates a real Katalon project folder structure on disk, then creates
 * the project record in the database.
 *
 * Body: { name, description?, save_directory }
 */
async function generateProjectHandler(req, res) {
  const payload = validateGeneratePayload(req.body);
  const result  = await generateKatalonProjectUseCase(projectRepository, payload);
  return res.status(201).json({ success: true, ...result });
}

/**
 * GET /api/projects/:id/scan-suites
 *
 * Recursively scans the project's "Test Suites" directory and returns a
 * typed tree of all discoverable Katalon test suites (.ts files).
 *
 * Also returns the absolute path of the "Test Suites" folder so the frontend
 * can start its folder picker there directly.
 */
async function scanProjectSuitesHandler(req, res) {
  ensureUuid(req.params.id, 'id');

  const project = await getProjectUseCase(projectRepository, req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project không tồn tại' });
  }

  const result = scanKatalonSuites(project.katalon_project_path);
  return res.json({ success: true, ...result });
}

module.exports = {
  listProjectsHandler,
  getProjectHandler,
  createProjectHandler,
  updateProjectHandler,
  deleteProjectHandler,
  importProjectHandler,
  getProjectStructureHandler,
  generateProjectHandler,
  scanProjectSuitesHandler,
};

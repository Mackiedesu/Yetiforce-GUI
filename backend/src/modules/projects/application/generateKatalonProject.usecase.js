'use strict';

/**
 * generateKatalonProject.usecase.js
 *
 * Orchestrates generating a new Katalon project on disk and persisting it
 * to the database.
 *
 * Flow:
 *  1. Check for duplicate project name (app-level, gives clear 409)
 *  2. Scaffold the Katalon folder/file structure on disk
 *  3. Persist the project record (katalon_project_path = generated root)
 *
 * If the DB insert fails after disk write, we attempt rollback (rm -rf projectRoot).
 */

const { generateKatalonProject } = require('../infrastructure/mochaScaffold.service');

async function generateKatalonProjectUseCase(projectRepository, payload) {
  const { name, description, save_directory } = payload;

  // ── 1. Duplicate name check ───────────────────────────────────────────────
  const existing = await projectRepository.findProjectByName(name);
  if (existing) {
    const conflict = new Error('Tên project đã tồn tại. Vui lòng chọn tên khác.');
    conflict.statusCode = 409;
    throw conflict;
  }

  // ── 2. Generate on disk ───────────────────────────────────────────────────
  const { katalon_project_path, foldersCreated, filesCreated } = generateKatalonProject({
    projectName:   name,
    saveDirectory: save_directory,
    description:   description || '',
  });

  // ── 3. Persist to DB ──────────────────────────────────────────────────────
  let project;
  try {
    project = await projectRepository.createProject({
      name,
      description: description || '',
      katalon_project_path,
    });
  } catch (dbErr) {
    // Best-effort rollback: remove the generated directory
    try {
      const fs = require('fs');
      if (fs.existsSync(katalon_project_path)) {
        fs.rmSync(katalon_project_path, { recursive: true, force: true });
      }
    } catch {
      // ignore rollback errors
    }
    throw dbErr;
  }

  return {
    project,
    katalon_project_path,
    scaffold: {
      folders_created: foldersCreated.length,
      files_created:   filesCreated.length,
    },
  };
}

module.exports = { generateKatalonProjectUseCase };

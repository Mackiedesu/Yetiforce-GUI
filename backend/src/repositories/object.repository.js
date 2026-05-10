const fs = require('fs');
const path = require('path');

const { OBJECT_REPOSITORY_DIR } = require('../config/paths');
const { ensureDir } = require('../utils/fs');

function ensureRepoDir() {
  ensureDir(OBJECT_REPOSITORY_DIR);
}

function toSafeId(objectId) {
  return String(objectId).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getObjectFilePath(objectId) {
  return path.join(OBJECT_REPOSITORY_DIR, `${toSafeId(objectId)}.json`);
}

function saveObject(objectData) {
  ensureRepoDir();

  if (!objectData.objectId) {
    throw new Error('objectId là bắt buộc');
  }

  const obj = {
    objectId: objectData.objectId,
    description: objectData.description || '',
    tagName: objectData.tagName || '',
    textContent: objectData.textContent || '',
    locators: objectData.locators || [],
    parentFrame: objectData.parentFrame || null,
    screenshot: objectData.screenshot || null,
    sourceUrl: objectData.sourceUrl || '',
    createdAt: objectData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(getObjectFilePath(obj.objectId), JSON.stringify(obj, null, 2), 'utf-8');
  return obj;
}

function loadObject(objectId) {
  ensureRepoDir();
  const filePath = getObjectFilePath(objectId);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function listObjects() {
  ensureRepoDir();

  const files = fs.readdirSync(OBJECT_REPOSITORY_DIR).filter((fileName) => fileName.endsWith('.json'));
  const objects = [];

  for (const fileName of files) {
    try {
      const content = fs.readFileSync(path.join(OBJECT_REPOSITORY_DIR, fileName), 'utf-8');
      const obj = JSON.parse(content);
      objects.push({
        objectId: obj.objectId,
        description: obj.description,
        tagName: obj.tagName,
        textContent: obj.textContent ? obj.textContent.substring(0, 50) : '',
        locatorCount: obj.locators ? obj.locators.length : 0,
        sourceUrl: obj.sourceUrl,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt
      });
    } catch (error) {
      console.error(`Lỗi khi đọc file ${fileName}:`, error.message);
    }
  }

  return objects;
}

function updateObject(objectId, updateData) {
  const existing = loadObject(objectId);
  if (!existing) {
    return null;
  }

  const newObjectId = updateData.objectId || existing.objectId;
  const safeOldId = toSafeId(objectId);
  const safeNewId = toSafeId(newObjectId);

  const updated = {
    ...existing,
    ...updateData,
    objectId: newObjectId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString()
  };

  const oldFilePath = path.join(OBJECT_REPOSITORY_DIR, `${safeOldId}.json`);
  const newFilePath = path.join(OBJECT_REPOSITORY_DIR, `${safeNewId}.json`);

  if (safeOldId !== safeNewId && fs.existsSync(newFilePath)) {
    throw new Error(`Đã tồn tại object có tên là ${newObjectId}`);
  }

  fs.writeFileSync(newFilePath, JSON.stringify(updated, null, 2), 'utf-8');

  if (safeOldId !== safeNewId && fs.existsSync(oldFilePath)) {
    fs.unlinkSync(oldFilePath);
  }

  return updated;
}

function deleteObject(objectId) {
  const filePath = getObjectFilePath(objectId);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.unlinkSync(filePath);
  return true;
}

function markObjectNeedsUpdate(objectId, healingInfo) {
  const obj = loadObject(objectId);
  if (!obj) {
    return;
  }

  obj.healingStatus = {
    needsUpdate: true,
    failedLocator: healingInfo.failedLocator,
    usedFallback: healingInfo.usedFallback,
    healedAt: new Date().toISOString()
  };

  updateObject(objectId, obj);
}

module.exports = {
  saveObject,
  loadObject,
  listObjects,
  updateObject,
  deleteObject,
  markObjectNeedsUpdate,
  OBJECT_REPOSITORY_DIR
};

const fs = require('fs');
const path = require('path');

const REPO_DIR = path.join(__dirname, '..', 'object_repository');

// Đảm bảo thư mục object_repository tồn tại
function ensureRepoDir() {
  if (!fs.existsSync(REPO_DIR)) {
    fs.mkdirSync(REPO_DIR, { recursive: true });
  }
}

/**
 * Lưu một Object mới vào repository
 * @param {Object} objectData - Dữ liệu object cần lưu
 * @returns {Object} Object đã được lưu (có thêm timestamps)
 */
function saveObject(objectData) {
  ensureRepoDir();

  if (!objectData.objectId) {
    throw new Error('objectId là bắt buộc');
  }

  // Sanitize objectId để dùng làm tên file
  const safeId = objectData.objectId.replace(/[^a-zA-Z0-9_-]/g, '_');

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

  const filePath = path.join(REPO_DIR, `${safeId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8');
  return obj;
}

/**
 * Đọc một Object từ repository theo ID
 * @param {string} objectId 
 * @returns {Object|null}
 */
function loadObject(objectId) {
  ensureRepoDir();
  const safeId = objectId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = path.join(REPO_DIR, `${safeId}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Liệt kê tất cả objects trong repository
 * @returns {Array} Danh sách object (summary, không có screenshot để giảm payload)
 */
function listObjects() {
  ensureRepoDir();

  const files = fs.readdirSync(REPO_DIR).filter(f => f.endsWith('.json'));
  const objects = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(REPO_DIR, file), 'utf-8');
      const obj = JSON.parse(content);
      // Trả về summary (bỏ screenshot để giảm payload)
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
    } catch (e) {
      console.error(`Lỗi khi đọc file ${file}:`, e.message);
    }
  }

  return objects;
}

/**
 * Cập nhật một Object
 * @param {string} objectId 
 * @param {Object} updateData 
 * @returns {Object|null}
 */
function updateObject(objectId, updateData) {
  const existing = loadObject(objectId);
  if (!existing) {
    return null;
  }

  const newObjectId = updateData.objectId || existing.objectId;
  const safeOldId = objectId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeNewId = newObjectId.replace(/[^a-zA-Z0-9_-]/g, '_');

  const updated = {
    ...existing,
    ...updateData,
    objectId: newObjectId,
    createdAt: existing.createdAt, // giữ nguyên ngày tạo
    updatedAt: new Date().toISOString()
  };

  const oldFilePath = path.join(REPO_DIR, `${safeOldId}.json`);
  const newFilePath = path.join(REPO_DIR, `${safeNewId}.json`);

  // Nếu đổi tên id, kiểm tra xem tên mới đã tồn tại chưa (tránh ghi đè)
  if (safeOldId !== safeNewId) {
    if (fs.existsSync(newFilePath)) {
      throw new Error(`Đã tồn tại object có tên là ${newObjectId}`);
    }
  }

  fs.writeFileSync(newFilePath, JSON.stringify(updated, null, 2), 'utf-8');

  // Xoá file cũ nếu đổi tên thành công
  if (safeOldId !== safeNewId && fs.existsSync(oldFilePath)) {
    fs.unlinkSync(oldFilePath);
  }

  return updated;
}

/**
 * Xóa một Object khỏi repository
 * @param {string} objectId 
 * @returns {boolean}
 */
function deleteObject(objectId) {
  const safeId = objectId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = path.join(REPO_DIR, `${safeId}.json`);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.unlinkSync(filePath);
  return true;
}

/**
 * Đánh dấu object cần cập nhật (dùng bởi Self-Healing Engine)
 * @param {string} objectId 
 * @param {Object} healingInfo 
 */
function markObjectNeedsUpdate(objectId, healingInfo) {
  const obj = loadObject(objectId);
  if (!obj) return;

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
  REPO_DIR
};

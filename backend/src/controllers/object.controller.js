const {
  saveObject,
  loadObject,
  listObjects,
  updateObject,
  deleteObject
} = require('../repositories/object.repository');

function listObjectsHandler(req, res) {
  const objects = listObjects();
  return res.json({ success: true, objects });
}

function getObjectHandler(req, res) {
  const objectData = loadObject(req.params.id);
  if (!objectData) {
    return res.status(404).json({ error: 'Object không tồn tại' });
  }

  return res.json({ success: true, object: objectData });
}

function createObjectHandler(req, res) {
  const objectData = saveObject(req.body);
  return res.json({ success: true, object: objectData });
}

function updateObjectHandler(req, res) {
  const objectData = updateObject(req.params.id, req.body);
  if (!objectData) {
    return res.status(404).json({ error: 'Object không tồn tại' });
  }

  return res.json({ success: true, object: objectData });
}

function deleteObjectHandler(req, res) {
  const isDeleted = deleteObject(req.params.id);
  if (!isDeleted) {
    return res.status(404).json({ error: 'Object không tồn tại' });
  }

  return res.json({ success: true });
}

module.exports = {
  listObjectsHandler,
  getObjectHandler,
  createObjectHandler,
  updateObjectHandler,
  deleteObjectHandler
};

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Endpoint không tồn tại' });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = Number(err.statusCode) || Number(err.status) || 500;
  res.status(statusCode).json({ error: err.message || 'Có lỗi xảy ra ở backend' });
}

module.exports = {
  notFoundHandler,
  errorHandler
};

const { logError } = require('../utils/logger');
const AppError = require('../utils/AppError');

function errorHandler(err, req, res, next) {
  logError(err);

  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message =
    err.isOperational && err.message
      ? err.message
      : 'Something went wrong. Please try again.';

  if (req.accepts('html') && !req.path.startsWith('/api')) {
    return res.status(statusCode).render('error', {
      title: 'Error',
      message,
      code,
    });
  }

  return res.status(statusCode).json({ success: false, code, message });
}

module.exports = errorHandler;
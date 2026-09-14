const AppError = require('../utils/AppError');

function requireLogin(req, res, next) {
  if (!req.session.user) {
    if (req.accepts('html')) {
      return res.redirect('/auth/login');
    }
    return next(new AppError(401, 'UNAUTHORIZED', 'Please log in.'));
  }
  next();
}

function guestOnly(req, res, next) {
  if (req.session.user) {
    return res.redirect('/');
  }
  next();
}

module.exports = {
  requireLogin,
  guestOnly,
};
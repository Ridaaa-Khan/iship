const AppError = require('../utils/AppError');

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/auth/login');
    }
    if (!roles.includes(req.session.user.role)) {
      return next(
        new AppError(403, 'FORBIDDEN', 'You do not have access to this page.')
      );
    }
    next();
  };
}

module.exports = requireRole;
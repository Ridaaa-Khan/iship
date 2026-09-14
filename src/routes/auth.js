const express = require('express');
const authService = require('../services/auth');
const AppError = require('../utils/AppError');
const validate = require('../middleware/validate');
const { parseBody } = validate;
const { guestOnly, requireLogin } = require('../middleware/auth');
const { registerSchema, loginSchema } = require('../validators/auth.validators');

const router = express.Router();

function dashboardPathForRole(role) {
  if (role === 'ADMIN') return '/admin';
  if (role === 'SCANNER') return '/scanner';
  return '/member';
}

router.get('/login', guestOnly, (req, res) => {
  res.render('auth/login', {
    title: 'Login',
    error: null,
    email: '',
  });
});

router.post('/login', guestOnly, validate(loginSchema), async (req, res, next) => {
  try {
    const user = await authService.login(req.body);
    req.session.user = user;
    return res.redirect(dashboardPathForRole(user.role));
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).render('auth/login', {
        title: 'Login',
        error: err.message,
        email: req.body.email || '',
      });
    }
    return next(err);
  }
});

router.get('/register', guestOnly, (req, res) => {
  res.render('auth/register', {
    title: 'Register',
    error: null,
    form: {},
  });
});

router.post('/register', guestOnly, async (req, res, next) => {
  try {
    const body = parseBody(registerSchema, req.body);
    const user = await authService.registerMember(body);
    req.session.user = user;
    return res.redirect(dashboardPathForRole(user.role));
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).render('auth/register', {
        title: 'Register',
        error: err.message,
        form: req.body,
      });
    }
    return next(err);
  }
});

router.post('/logout', requireLogin, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('iship.sid');
    return res.redirect('/auth/login');
  });
});

module.exports = router;
module.exports.dashboardPathForRole = dashboardPathForRole;

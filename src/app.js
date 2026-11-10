const path = require('path');
const express = require('express');
const session = require('express-session');

const env = require('./config/env');
const db = require('./config/db');
const sessionConfig = require('./config/session');
const errorHandler = require('./middleware/errorHandler');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const scannerRouter = require('./routes/scanner');
const memberRouter = require('./routes/member');
const { dashboardPathForRole } = authRouter;
const { log, logError } = require('./utils/logger');
const { formatDisplay, toDatetimeLocal, eventDateParts } = require('./utils/datetime');
const authService = require('./services/auth');

const app = express();
app.disable('x-powered-by');

if (env.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session(sessionConfig));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use(
  '/vendor/html5-qrcode',
  express.static(path.join(__dirname, '..', 'node_modules', 'html5-qrcode'))
);

app.use(async (req, res, next) => {
  try {
    if (req.session.user && !req.session.user.displayName) {
      req.session.user = await authService.withDisplayName(req.session.user);
    }
    res.locals.currentUser = req.session.user || null;
    res.locals.currentPath = (req.originalUrl || req.path || '').split('?')[0];
    res.locals.formatDate = formatDisplay;
    res.locals.toDatetimeLocal = toDatetimeLocal;
    res.locals.eventDateParts = eventDateParts;
    res.locals.eventCoverUrl = (filename) =>
      filename ? `/uploads/events/${String(filename).replace(/^.*[\\/]/, '')}` : null;
    next();
  } catch (err) {
    next(err);
  }
});

app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/scanner', scannerRouter);
app.use('/member', memberRouter);

app.get('/', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  return res.redirect(dashboardPathForRole(req.session.user.role));
});

app.use(errorHandler);

async function start() {
  try {
    await db.connect();
    app.listen(env.port, () => {
      log(`Server listening on http://localhost:${env.port}`);
    });
  } catch (err) {
    logError('Failed to start server', err.message);
    process.exit(1);
  }
}

start();

module.exports = app;

const express = require('express');
const { requireLogin } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const checkinService = require('../services/checkin');
const attendanceService = require('../services/attendance');
const dashboardService = require('../services/dashboard');
const AppError = require('../utils/AppError');

const router = express.Router();

router.use(requireLogin, requireRole('SCANNER'));

router.get('/', async (req, res, next) => {
  try {
    const dashboard = await dashboardService.getScannerDashboard();
    res.render('scanner/dashboard', {
      title: 'Scanner Dashboard',
      user: req.session.user,
      dashboard,
    });
  } catch (err) {
    next(err);
  }
});


router.get('/scan', (req, res) => {
  res.render('scanner/scan', {
    title: 'Open scanner',
    user: req.session.user,
  });
});


router.post('/check-in', async (req, res, next) => {
  try {
    const token = (req.body && req.body.token) || '';
    const deviceLabel = (req.body && req.body.deviceLabel) || 'web-scanner';
    const peopleCount = req.body && req.body.peopleCount;

    const result = await checkinService.checkIn(
      token,
      req.session.user.id,
      deviceLabel,
      peopleCount
    );


    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.get('/entries', async (req, res, next) => {
  try {
    const { entries } = await attendanceService.getTodaysEntries();
    res.render('scanner/entries-today', {
      title: "Today's entries",
      entries,
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/entries/:id', async (req, res, next) => {
  try {
    await attendanceService.updateTodaysEntry(req.params.id, {
      createdAt: req.body.createdAt,
      result: req.body.result,
      denialReason: req.body.denialReason,
    });
    return res.redirect('/scanner/entries');
  } catch (err) {
    if (err instanceof AppError) {
      try {
        const { entries } = await attendanceService.getTodaysEntries();
        return res.status(err.statusCode).render('scanner/entries-today', {
          title: "Today's entries",
          entries,
          error: err.message,
        });
      } catch (_) {
        return next(err);
      }
    }
    return next(err);
  }
});

module.exports = router;
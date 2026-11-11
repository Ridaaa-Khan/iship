const express = require('express');
const eventService = require('../services/event');
const paymentService = require('../services/payment');
const AppError = require('../utils/AppError');
const { requireLogin } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { parseBody } = validate;
const { eventFormSchema } = require('../validators/event.validators');
const { toDatetimeLocal, paiseToRupees } = require('../utils/datetime');
const attendanceService = require('../services/attendance');
const pdfService = require('../services/pdf');
const dashboardService = require('../services/dashboard');
const scannerService = require('../services/scanners');
const adminMembersService = require('../services/adminMembers');
const { scannerFormSchema } = require('../validators/scanner.validators');
const { uploadEventCover, deleteCoverFile } = require('../middleware/eventCover');

const router = express.Router();

router.use(requireLogin, requireRole('ADMIN'));

function mapEventForForm(event) {
  return {
    ...event,
    startsAt: toDatetimeLocal(event.starts_at),
    endsAt: toDatetimeLocal(event.ends_at),
    doorsOpenAt: toDatetimeLocal(event.doors_open_at),
    doorsCloseAt: toDatetimeLocal(event.doors_close_at),
    priceRupees: paiseToRupees(event.price_paise),
  };
}

router.get('/', async (req, res, next) => {
  try {
    const dashboard = await dashboardService.getAdminDashboard();
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      user: req.session.user,
      dashboard,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/events', async (req, res, next) => {
  try {
    const events = await eventService.listEvents();
    res.render('admin/events', {
      title: 'Events',
      events,
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/events/new', (req, res) => {
  res.render('admin/event-form', {
    title: 'Create event',
    mode: 'create',
    event: {
      title: '',
      description: '',
      venue: '',
      startsAt: '',
      endsAt: '',
      doorsOpenAt: '',
      doorsCloseAt: '',
      capacity: 100,
      priceRupees: '0.00',
      status: 'DRAFT',
      cover_image: null,
    },
    error: null,
  });
});

router.post('/events', uploadEventCover, validate(eventFormSchema), async (req, res, next) => {
  try {
    if (req.coverUploadError) {
      throw new AppError(400, 'INVALID_IMAGE', req.coverUploadError);
    }
    await eventService.createEvent(req.body, req.session.user.id, req.file);
    return res.redirect('/admin/events');
  } catch (err) {
    if (err instanceof AppError) {
      if (req.file && req.file.filename) deleteCoverFile(req.file.public_id);
      return res.status(err.statusCode).render('admin/event-form', {
        title: 'Create event',
        mode: 'create',
        event: req.body,
        error: err.message,
      });
    }
    return next(err);
  }
});

router.get('/events/:id/edit', async (req, res, next) => {
  try {
    const event = mapEventForForm(await eventService.getEvent(req.params.id));
    res.render('admin/event-form', {
      title: 'Edit event',
      mode: 'edit',
      event,
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/events/:id', uploadEventCover, validate(eventFormSchema), async (req, res, next) => {
  try {
    if (req.coverUploadError) {
      throw new AppError(400, 'INVALID_IMAGE', req.coverUploadError);
    }
    await eventService.updateEvent(req.params.id, req.body, req.file);
    return res.redirect('/admin/events');
  } catch (err) {
    if (err instanceof AppError) {
      if (req.file && req.file.filename) deleteCoverFile(req.file.public_id);
      return res.status(err.statusCode).render('admin/event-form', {
        title: 'Edit event',
        mode: 'edit',
        event: { ...req.body, id: req.params.id, cover_image: req.body.existingCover || '' },
        error: err.message,
      });
    }
    return next(err);
  }
});

router.post('/events/:id/publish', async (req, res, next) => {
  try {
    await eventService.publishEvent(req.params.id);
    return res.redirect('/admin/events');
  } catch (err) {
    next(err);
  }
});

router.post('/events/:id/cancel', async (req, res, next) => {
  try {
    await eventService.cancelEvent(req.params.id);
    return res.redirect('/admin/events');
  } catch (err) {
    next(err);
  }
});

router.get('/registrations', async (req, res, next) => {
  try {
    const registrations = await paymentService.listRegistrationsForAdmin();
    res.render('admin/registrations', {
      title: 'Registrations',
      registrations,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/registrations/:id/mark-paid', async (req, res, next) => {
  try {
    await paymentService.adminMarkPaid(req.params.id);
    return res.redirect('/admin/registrations');
  } catch (err) {
    next(err);
  }
});

router.get('/entries/today', async (req, res, next) => {
  try {
    const { entries } = await attendanceService.getTodaysEntries();
    res.render('admin/entries-today', {
      title: "Today's entries",
      entries,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/attendance', async (req, res, next) => {
  try {
    const { events } = await attendanceService.listEventsForAttendance();
    res.render('admin/attendance', {
      title: 'Attendance',
      events,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/attendance/:eventId', async (req, res, next) => {
  try {
    const { event, rows } = await attendanceService.getEventAttendance(
      req.params.eventId
    );
    res.render('admin/attendance-event', {
      title: `Attendance — ${event.title}`,
      event,
      rows,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/attendance/:eventId/pdf', async (req, res, next) => {
  try {
    const { event, rows } = await attendanceService.getEventAttendance(
      req.params.eventId
    );
    const pdfBuffer = await pdfService.buildAttendancePdf({ event, rows });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="eventra-attendance-${event.id}.pdf"`
    );
    return res.send(pdfBuffer);
  } catch (err) {
    return next(err);
  }
});

router.get('/members', async (req, res, next) => {
  try {
    const members = await adminMembersService.listMembers();
    res.render('admin/members', {
      title: 'Members',
      members,
      error: req.query.error || null,
      notice: req.query.notice || null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/members/:id/remove', async (req, res, next) => {
  try {
    await adminMembersService.removeMember(req.params.id);
    return res.redirect('/admin/members?notice=Member removed');
  } catch (err) {
    if (err instanceof AppError) {
      return res.redirect('/admin/members?error=' + encodeURIComponent(err.message));
    }
    return next(err);
  }
});

router.get('/scanners', async (req, res, next) => {
  try {
    const scanners = await scannerService.listScanners();
    res.render('admin/scanners', {
      title: 'Scanners',
      scanners,
      error: req.query.error || null,
      notice: req.query.notice || null,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/scanners/new', (req, res) => {
  res.render('admin/scanner-form', {
    title: 'Add a scanner',
    form: { email: '', scannerName: '', gateNumber: '' },
    error: null,
  });
});

router.post('/scanners', async (req, res, next) => {
  try {
    const body = parseBody(scannerFormSchema, req.body);
    await scannerService.createScanner(body);
    return res.redirect('/admin/scanners?notice=Scanner added');
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).render('admin/scanner-form', {
        title: 'Add a scanner',
        form: req.body,
        error: err.message,
      });
    }
    return next(err);
  }
});

router.post('/scanners/:id/remove', async (req, res, next) => {
  try {
    await scannerService.removeScanner(req.params.id);
    return res.redirect('/admin/scanners?notice=Scanner removed');
  } catch (err) {
    if (err instanceof AppError) {
      return res.redirect('/admin/scanners?error=' + encodeURIComponent(err.message));
    }
    return next(err);
  }
});

module.exports = router;

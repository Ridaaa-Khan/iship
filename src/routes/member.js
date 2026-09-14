const express = require('express');
const registrationService = require('../services/registration');
const paymentService = require('../services/payment');
const AppError = require('../utils/AppError');
const { requireLogin } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const qrService = require('../services/qr');
const pdfService = require('../services/pdf');
const dashboardService = require('../services/dashboard');
const profileService = require('../services/profile');
const { parseBody } = require('../middleware/validate');
const { profileSchema } = require('../validators/auth.validators');

const router = express.Router();

router.use(requireLogin, requireRole('MEMBER'));

router.get('/', async (req, res, next) => {
  try {
    const dashboard = await dashboardService.getMemberDashboard(req.session.user.id);
    res.render('member/dashboard', {
      title: 'Member Dashboard',
      user: req.session.user,
      dashboard,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/events', async (req, res, next) => {
  try {
    const { events } = await registrationService.listPublishedEventsForMember(
      req.session.user.id
    );
    res.render('member/events', {
      title: 'Events',
      events,
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/events/:id', async (req, res, next) => {
  try {
    const { event } = await registrationService.getPublishedEventForMember(
      req.params.id,
      req.session.user.id
    );
    res.render('member/event-detail', {
      title: event.title,
      event,
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/events/:id/register', async (req, res, next) => {
  try {
    await registrationService.registerForEvent(
      req.params.id,
      req.session.user.id,
      req.body.addonCount
    );
    return res.redirect('/member/registrations');
  } catch (err) {
    if (err instanceof AppError) {
      try {
        const { event } = await registrationService.getPublishedEventForMember(
          req.params.id,
          req.session.user.id
        );
        return res.status(err.statusCode).render('member/event-detail', {
          title: event.title,
          event,
          error: err.message,
        });
      } catch (_) {
        return next(err);
      }
    }
    return next(err);
  }
});

router.get('/registrations', async (req, res, next) => {
  try {
    const { registrations } = await registrationService.listMyRegistrations(
      req.session.user.id
    );
    res.render('member/registrations', {
      title: 'My registrations',
      registrations,
      error: req.query.error || null,
      notice: req.query.notice || null,
    });
  } catch (err) {
    next(err);
  }
});

async function renderMyRegistrations(req, res, statusCode, error) {
  const { registrations } = await registrationService.listMyRegistrations(
    req.session.user.id
  );
  return res.status(statusCode).render('member/registrations', {
    title: 'My registrations',
    registrations,
    error,
    notice: null,
  });
}

router.post('/registrations/:id/addons', async (req, res, next) => {
  try {
    const result = await registrationService.updateAddons(
      req.params.id,
      req.session.user.id,
      req.body.addonCount
    );
    const notice = result.unchanged
      ? 'Add-ons were already set to that number.'
      : 'Add-ons updated. Seats and amount have been recalculated.';
    return res.redirect(`/member/registrations?notice=${encodeURIComponent(notice)}`);
  } catch (err) {
    if (err instanceof AppError) {
      try {
        return await renderMyRegistrations(req, res, err.statusCode, err.message);
      } catch (_) {
        return next(err);
      }
    }
    return next(err);
  }
});

router.post('/registrations/:id/cancel', async (req, res, next) => {
  try {
    await registrationService.cancelMyRegistration(
      req.params.id,
      req.session.user.id
    );
    return res.redirect(
      `/member/registrations?notice=${encodeURIComponent('Registration cancelled. Your seats are available again.')}`
    );
  } catch (err) {
    if (err instanceof AppError) {
      try {
        return await renderMyRegistrations(req, res, err.statusCode, err.message);
      } catch (_) {
        return next(err);
      }
    }
    return next(err);
  }
});

router.get('/registrations/:id/pay', async (req, res, next) => {
  try {
    const order = await paymentService.createPaymentOrder(
      req.params.id,
      req.session.user.id
    );
    res.render('member/pay', {
      title: 'Pay for event',
      order,
      error: null,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).render('member/pay', {
        title: 'Pay for event',
        order: null,
        error: err.message,
      });
    }
    return next(err);
  }
});

router.post('/registrations/:id/verify', async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    await paymentService.verifyAndMarkPaid(req.params.id, req.session.user.id, {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });
    return res.redirect('/member/registrations');
  } catch (err) {
    next(err);
  }
});

router.get('/registrations/:id/pass', async (req, res, next) => {
  try {
    const pass = await qrService.getPassForMember(
      req.params.id,
      req.session.user.id
    );
    res.render('member/pass', {
      title: 'Event pass',
      pass,
      error: null,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).render('member/pass', {
        title: 'Event pass',
        pass: null,
        error: err.message,
      });
    }
    return next(err);
  }
});

router.get('/profile', async (req, res, next) => {
  try {
    const profile = await profileService.getMemberProfile(req.session.user.id);
    res.render('member/profile', {
      title: 'Profile',
      profile,
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/profile', async (req, res, next) => {
  try {
    const body = parseBody(profileSchema, req.body);
    const profile = await profileService.updateMemberProfile(req.session.user.id, body);
    req.session.user = {
      ...req.session.user,
      email: profile.email,
      displayName: profile.full_name,
    };
    return res.redirect('/member/profile');
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).render('member/profile', {
        title: 'Profile',
        profile: {
          full_name: req.body.fullName,
          email: req.body.email,
          phone: req.body.phone,
          status: '',
          created_at: null,
        },
        error: err.message,
      });
    }
    return next(err);
  }
});

router.get('/registrations/:id/pass.pdf', async (req, res, next) => {
  try {
    const pass = await qrService.getPassForMember(
      req.params.id,
      req.session.user.id
    );
    const pdfBuffer = await pdfService.buildPassPdf(pass);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="iship-pass-${pass.registrationId}.pdf"`
    );
    return res.send(pdfBuffer);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

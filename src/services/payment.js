const crypto = require('crypto');
const Razorpay = require('razorpay');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const registrationsDb = require('../db/registrations');
const qrService = require('./qr');
const emailService = require('./email');

function getRazorpayClient() {
  if (!env.razorpay.keyId || !env.razorpay.keySecret) {
    throw new AppError(
      503,
      'PAYMENTS_NOT_CONFIGURED',
      'Razorpay is not configured. Ask an admin to mark this registration as paid, or add API keys to .env.'
    );
  }
  return new Razorpay({
    key_id: env.razorpay.keyId,
    key_secret: env.razorpay.keySecret,
  });
}

async function adminMarkPaid(registrationId) {
  const reg = await registrationsDb.findRegistrationById(registrationId);
  if (!reg) {
    throw new AppError(404, 'NOT_FOUND', 'Registration not found.');
  }
  if (reg.status === 'PAID' || reg.status === 'CHECKED_IN') {
    return reg;
  }
  if (reg.status !== 'PENDING_PAYMENT') {
    throw new AppError(400, 'INVALID_STATUS', 'Only pending payments can be marked paid.');
  }

  const updated = await registrationsDb.markPaid(registrationId, {});
  if (!updated) {
    throw new AppError(409, 'UPDATE_FAILED', 'Could not mark as paid.');
  }

  await qrService.issueAfterPaid(registrationId);
  await emailService.sendPassPdfEmail(registrationId);

  return registrationsDb.findRegistrationById(registrationId);
}

async function createPaymentOrder(registrationId, userId) {
  const reg = await registrationsDb.findRegistrationOwnedByUser(registrationId, userId);
  if (!reg) {
    throw new AppError(404, 'NOT_FOUND', 'Registration not found.');
  }
  if (reg.status !== 'PENDING_PAYMENT') {
    throw new AppError(400, 'INVALID_STATUS', 'This registration does not need payment.');
  }
  if (Number(reg.amount_paise) <= 0) {
    throw new AppError(400, 'FREE_EVENT', 'This registration is free.');
  }

  const razorpay = getRazorpayClient();

  const order = await razorpay.orders.create({
    amount: Number(reg.amount_paise),
    currency: 'INR',
    receipt: `reg_${reg.id}`,
    notes: {
      registrationId: String(reg.id),
      eventId: String(reg.event_id),
    },
  });

  await registrationsDb.saveOrderId(reg.id, order.id);

  return {
    registrationId: reg.id,
    eventTitle: reg.event_title,
    amountPaise: reg.amount_paise,
    orderId: order.id,
    keyId: env.razorpay.keyId,
  };
}

function verifySignature({ orderId, paymentId, signature }) {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', env.razorpay.keySecret)
    .update(body)
    .digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(signature || '');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new AppError(400, 'BAD_SIGNATURE', 'Payment verification failed.');
  }
}

async function verifyAndMarkPaid(registrationId, userId, { orderId, paymentId, signature }) {
  const reg = await registrationsDb.findRegistrationOwnedByUser(registrationId, userId);
  if (!reg) {
    throw new AppError(404, 'NOT_FOUND', 'Registration not found.');
  }
  if (reg.status === 'PAID' || reg.status === 'CHECKED_IN') {
    return reg;
  }
  if (reg.status !== 'PENDING_PAYMENT') {
    throw new AppError(400, 'INVALID_STATUS', 'This registration cannot be paid.');
  }
  if (!env.razorpay.keySecret) {
    throw new AppError(503, 'PAYMENTS_NOT_CONFIGURED', 'Razorpay is not configured.');
  }
  if (reg.razorpay_order_id && reg.razorpay_order_id !== orderId) {
    throw new AppError(400, 'ORDER_MISMATCH', 'Order does not match this registration.');
  }

  verifySignature({ orderId, paymentId, signature });

  const updated = await registrationsDb.markPaid(registrationId, { paymentId, signature });
  if (!updated) {
    throw new AppError(409, 'UPDATE_FAILED', 'Could not mark as paid.');
  }

  await qrService.issueAfterPaid(registrationId);
  await emailService.sendPassPdfEmail(registrationId);

  return registrationsDb.findRegistrationById(registrationId);
}

async function listRegistrationsForAdmin() {
  return registrationsDb.listAllWithDetails();
}

module.exports = {
  adminMarkPaid,
  createPaymentOrder,
  verifyAndMarkPaid,
  listRegistrationsForAdmin,
};

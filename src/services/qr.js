const crypto = require('crypto');
const QRCode = require('qrcode');
const AppError = require('../utils/AppError');
const registrationsDb = require('../db/registrations');
const qrCredentialsDb = require('../db/qrCredentials');

const QR_PREFIX = 'EVENTRA';
const QR_PREFIXES = new Set(['EVENTRA', 'ISHIP']);


function createPublicId() {
  return crypto.randomBytes(13).toString('hex');
}


function createSecret() {
  return crypto.randomBytes(32).toString('hex');
}


function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret, 'utf8').digest('hex');
}


function secretsMatch(secret, secretHash) {
  const a = Buffer.from(hashSecret(secret), 'hex');
  const b = Buffer.from(secretHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}


function buildQrPayload(publicId, secret) {
  return `${QR_PREFIX}.${publicId}.${secret}`;
}


function parseQrPayload(token) {
  if (typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;
  const [prefix, publicId, secret] = parts;
  if (!QR_PREFIXES.has(prefix)) return null;
  if (!publicId || !secret) return null;
  return { publicId, secret };
}


async function issueForPaidRegistration(registrationId) {
  const reg = await registrationsDb.findByIdWithEvent(registrationId);

  if (!reg) {
    throw new AppError(404, 'REGISTRATION_NOT_FOUND', 'Registration not found.');
  }

  if (reg.status !== 'PAID') {
    throw new AppError(
      400,
      'NOT_PAID',
      `Registration must be PAID to get a QR (current: ${reg.status}).`
    );
  }

  if (reg.event_status === 'CANCELLED') {
    throw new AppError(400, 'EVENT_CANCELLED', 'This event was cancelled.');
  }

  const expiresAt = reg.doors_close_at;

  const existing = await qrCredentialsDb.findByRegistrationId(reg.id);

  if (existing) {

    if (!existing.qr_payload || existing.status === 'REVOKED') {
      await qrCredentialsDb.deleteByRegistrationId(reg.id);
    } else {
      throw new AppError(
        409,
        'ALREADY_ISSUED',
        'A QR pass was already issued for this registration.'
      );
    }
  }

  const publicId = createPublicId();
  const secret = createSecret();
  const secretHash = hashSecret(secret);
  const token = buildQrPayload(publicId, secret);

  await qrCredentialsDb.createCredential({
    publicId,
    secretHash,
    qrPayload: token,
    registrationId: reg.id,
    eventId: reg.event_id,
    expiresAt,
  });

  return {
    registrationId: reg.id,
    eventId: reg.event_id,
    eventTitle: reg.event_title,
    publicId,
    token,
    expiresAt,
  };
}


async function issueAfterPaid(registrationId) {
  try {
    return await issueForPaidRegistration(registrationId);
  } catch (err) {
    if (err && err.code === 'ALREADY_ISSUED') {
      return null;
    }
    throw err;
  }
}


async function getPassForMember(registrationId, userId) {
  const reg = await registrationsDb.findRegistrationOwnedByUser(
    registrationId,
    userId
  );
  if (!reg) {
    throw new AppError(404, 'NOT_FOUND', 'Registration not found.');
  }
  if (reg.status !== 'PAID' && reg.status !== 'CHECKED_IN') {
    throw new AppError(400, 'NOT_PAID', 'Pay for this event before viewing the pass.');
  }

  let credential = await qrCredentialsDb.findByRegistrationId(reg.id);


  if (!credential || !credential.qr_payload) {
    if (reg.status === 'PAID') {
      await issueAfterPaid(reg.id);
      credential = await qrCredentialsDb.findByRegistrationId(reg.id);
    }
  }

  if (!credential || !credential.qr_payload) {
    throw new AppError(
      404,
      'NO_PASS',
      'No QR pass found. If you just paid, try again or contact admin.'
    );
  }

  const now = new Date();
  const expired = new Date(credential.expires_at) < now;
  const used = credential.status === 'USED';


  const qrDataUrl = await QRCode.toDataURL(credential.qr_payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 280,
  });

  return {
    registrationId: reg.id,
    eventTitle: reg.event_title,
    eventVenue: reg.event_venue,
    eventStartsAt: reg.event_starts_at,
    eventEndsAt: reg.event_ends_at,
    doorsOpenAt: reg.event_doors_open_at,
    doorsCloseAt: reg.event_doors_close_at,
    memberName: reg.member_name,
    memberEmail: reg.member_email,
    registrationStatus: reg.status,
    addonCount: Number(reg.addon_count || 0),
    partySize: 1 + Number(reg.addon_count || 0),
    enteredCount: Number(reg.entered_count || 0),
    status: credential.status,
    expiresAt: credential.expires_at,
    expired,
    used,
    qrDataUrl,
  };
}

module.exports = {
  secretsMatch,
  parseQrPayload,
  issueForPaidRegistration,
  issueAfterPaid,
  getPassForMember,
};


const pool = require('../config/db');
const qrService = require('./qr');
const qrCredentialsDb = require('../db/qrCredentials');
const registrationsDb = require('../db/registrations');
const checkInsDb = require('../db/checkIns');
const emailService = require('./email');


const REASONS = {
  INVALID_FORMAT: 'This QR is not a valid iShip pass.',
  NOT_FOUND: 'Pass not found.',
  BAD_SECRET: 'Pass is forged or damaged.',
  ALREADY_USED: 'This pass was already used.',
  REVOKED: 'This pass was revoked.',
  EXPIRED: 'This pass has expired.',
  DOORS_NOT_OPEN: 'Doors are not open yet.',
  DOORS_CLOSED: 'Doors are closed.',
  NOT_PAID: 'Registration is not paid.',
  CANCELLED: 'This registration was cancelled.',
  EVENT_CANCELLED: 'Event was cancelled.',
  MEMBER_INACTIVE: 'Member is not active.',
  PARTY_TOO_LARGE: 'Too many people for this pass.',
  RACE: 'Could not complete check-in. Try once more.',
};

function denied(reason, extra = {}) {
  return {
    allowed: false,
    reason,
    message: extra.message || REASONS[reason] || reason,
    ...extra,
  };
}

function parsePeopleCount(value) {
  const raw = value === undefined || value === null || value === '' ? '1' : String(value).trim();
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}


async function checkIn(token, scannerUserId = null, deviceLabel = null, peopleCountRaw = 1) {
  const parsed = qrService.parseQrPayload(token);
  if (!parsed) {
    return denied('INVALID_FORMAT');
  }

  const peopleCount = parsePeopleCount(peopleCountRaw);
  const { publicId, secret } = parsed;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const row = await qrCredentialsDb.findByPublicIdForUpdate(publicId, connection);

    if (!row) {
      await connection.rollback();
      return denied('NOT_FOUND');
    }

    async function denyAndCommit(reason, extra = {}) {
      await checkInsDb.createCheckIn(
        {
          eventId: row.event_id,
          registrationId: row.registration_id,
          credentialId: row.id,
          scannerUserId,
          deviceLabel,
          result: 'DENIED',
          denialReason: reason,
          notes: extra.notes || null,
        },
        connection
      );
      await connection.commit();
      return denied(reason, {
        eventTitle: row.event_title,
        memberName: row.full_name,
        ...extra,
      });
    }

    if (!qrService.secretsMatch(secret, row.secret_hash)) {
      return denyAndCommit('BAD_SECRET');
    }

    if (row.credential_status === 'USED') {
      return denyAndCommit('ALREADY_USED');
    }
    if (row.credential_status === 'REVOKED') {
      return denyAndCommit('REVOKED');
    }

    const now = new Date();
    const doorsOpen = new Date(row.doors_open_at);
    const doorsClose = new Date(row.doors_close_at);
    const expiresAt = new Date(row.expires_at);

    if (now > expiresAt || now > doorsClose) {
      return denyAndCommit(now > doorsClose ? 'DOORS_CLOSED' : 'EXPIRED');
    }
    if (now < doorsOpen) {
      return denyAndCommit('DOORS_NOT_OPEN');
    }

    if (row.event_status === 'CANCELLED') {
      return denyAndCommit('EVENT_CANCELLED');
    }
    if (row.member_status !== 'ACTIVE') {
      return denyAndCommit('MEMBER_INACTIVE');
    }
    if (row.registration_status === 'CANCELLED') {
      return denyAndCommit('CANCELLED');
    }
    if (row.registration_status !== 'PAID' && row.registration_status !== 'CHECKED_IN') {
      return denyAndCommit('NOT_PAID');
    }

    if (row.credential_status !== 'ACTIVE') {
      return denyAndCommit('EXPIRED');
    }

    const addonCount = Number(row.addon_count || 0);
    const enteredCount = Number(row.entered_count || 0);
    const partySize = 1 + addonCount;
    const remaining = partySize - enteredCount;

    if (remaining <= 0) {
      return denyAndCommit('ALREADY_USED');
    }
    if (peopleCount > remaining) {
      return denyAndCommit('PARTY_TOO_LARGE', {
        message: `Only ${remaining} of ${partySize} people left on this pass.`,
        notes: `Tried ${peopleCount}; remaining ${remaining}/${partySize}`,
        partySize,
        enteredCount,
        remaining,
      });
    }

    const newEntered = enteredCount + peopleCount;
    const partyComplete = newEntered >= partySize;

    if (partyComplete) {
      const usedRows = await qrCredentialsDb.markUsed(row.id, connection);
      if (!usedRows) {
        await connection.rollback();
        return denied('RACE');
      }
    }

    if (row.registration_status === 'PAID') {
      const checkedInRows = await registrationsDb.markCheckedIn(
        row.registration_id,
        connection
      );
      if (!checkedInRows) {
        await connection.rollback();
        return denied('RACE');
      }
    }

    await registrationsDb.incrementEntered(row.registration_id, peopleCount, connection);

    await checkInsDb.createCheckIn(
      {
        eventId: row.event_id,
        registrationId: row.registration_id,
        credentialId: row.id,
        scannerUserId,
        deviceLabel,
        result: 'ALLOWED',
        denialReason: null,
        notes: `Entered ${peopleCount}; ${newEntered}/${partySize}`,
      },
      connection
    );

    await connection.commit();

    if (row.registration_status === 'PAID') {
      void emailService.sendCheckInAlertEmail({
        toEmail: row.member_email,
        memberName: row.full_name,
        eventTitle: row.event_title,
        eventVenue: row.event_venue,
        eventStartsAt: row.event_starts_at,
        deviceLabel,
      });
    }

    return {
      allowed: true,
      reason: null,
      message: `Entry allowed. ${newEntered} of ${partySize} entered.`,
      eventTitle: row.event_title,
      memberName: row.full_name,
      registrationId: row.registration_id,
      credentialId: row.id,
      partySize,
      enteredCount: newEntered,
      remaining: partySize - newEntered,
      peopleCount,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  checkIn,
};

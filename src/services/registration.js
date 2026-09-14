const pool = require('../config/db');
const AppError = require('../utils/AppError');
const membersDb = require('../db/members');
const eventsDb = require('../db/events');
const registrationsDb = require('../db/registrations');
const qrCredentialsDb = require('../db/qrCredentials');
const qrService = require('./qr');
const emailService = require('./email');
const { log } = require('../utils/logger');

function parseAddonCount(value) {
  const raw = value === undefined || value === null || value === '' ? '0' : String(value).trim();
  if (!/^\d+$/.test(raw)) {
    throw new AppError(400, 'INVALID_ADDONS', 'Add-on count must be a whole number of 0 or more.');
  }
  return Number(raw);
}

function partySizeOf(addonCount) {
  return 1 + Number(addonCount || 0);
}

function amountForParty(pricePaise, addonCount) {
  return Number(pricePaise || 0) * partySizeOf(addonCount);
}

function withSeatFields(event, taken, existing) {
  return {
    ...event,
    seatsTaken: taken,
    seatsLeft: Math.max(event.capacity - taken, 0),
    myRegistration: existing || null,
  };
}

function canChangeAddons(row) {
  if (row.status !== 'PENDING_PAYMENT' && row.status !== 'PAID') return false;
  if (row.event_status && row.event_status !== 'PUBLISHED') return false;
  return new Date(row.starts_at) > new Date();
}

function canCancelRegistration(row) {
  return row.status === 'PENDING_PAYMENT' || row.status === 'PAID';
}

async function listPublishedEventsForMember(userId) {
  const member = await membersDb.findMemberByUserId(userId);
  if (!member) {
    throw new AppError(400, 'NO_MEMBER_PROFILE', 'Member profile not found.');
  }

  const events = await eventsDb.listPublishedEvents();
  const withSeats = [];

  for (const event of events) {
    const taken = await eventsDb.countTakenSeats(event.id);
    const existing = await registrationsDb.findByEventAndMember(event.id, member.id);
    withSeats.push(withSeatFields(event, taken, existing));
  }

  return { member, events: withSeats };
}

async function getPublishedEventForMember(eventId, userId) {
  const member = await membersDb.findMemberByUserId(userId);
  if (!member) {
    throw new AppError(400, 'NO_MEMBER_PROFILE', 'Member profile not found.');
  }

  const event = await eventsDb.findEventById(eventId);
  if (!event || (event.status !== 'PUBLISHED' && event.status !== 'COMPLETED')) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found or not published.');
  }

  const taken = await eventsDb.countTakenSeats(event.id);
  const existing = await registrationsDb.findByEventAndMember(event.id, member.id);

  return {
    member,
    event: withSeatFields(event, taken, existing),
  };
}

async function registerForEvent(eventId, userId, addonCountRaw) {
  const member = await membersDb.findMemberByUserId(userId);
  if (!member) {
    throw new AppError(400, 'NO_MEMBER_PROFILE', 'Member profile not found.');
  }
  if (member.status !== 'ACTIVE') {
    throw new AppError(403, 'MEMBER_INACTIVE', 'Your membership is not active.');
  }

  const addonCount = parseAddonCount(addonCountRaw);
  const partySize = partySizeOf(addonCount);

  const existing = await registrationsDb.findByEventAndMember(eventId, member.id);
  if (existing && existing.status !== 'CANCELLED') {
    throw new AppError(409, 'ALREADY_REGISTERED', 'You are already registered for this event.');
  }

  const connection = await pool.getConnection();
  let registrationId;
  let status;
  let amountPaise;
  let isFree;
  let eventTitle = '';

  try {
    await connection.beginTransaction();

    const event = await eventsDb.findEventByIdForUpdate(eventId, connection);
    if (!event || event.status !== 'PUBLISHED') {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found or not published.');
    }

    eventTitle = event.title;
    const taken = await eventsDb.countTakenSeats(event.id, connection);
    if (taken + partySize > event.capacity) {
      const left = Math.max(event.capacity - taken, 0);
      throw new AppError(
        409,
        'EVENT_FULL',
        left <= 0
          ? 'This event is full.'
          : `Only ${left} seat(s) left. Reduce add-ons and try again.`
      );
    }

    isFree = Number(event.price_paise) === 0;
    status = isFree ? 'PAID' : 'PENDING_PAYMENT';
    const paidAt = isFree ? new Date() : null;
    amountPaise = amountForParty(event.price_paise, addonCount);

    const payload = {
      status,
      amountPaise,
      addonCount,
      paidAt,
    };

    if (existing && existing.status === 'CANCELLED') {
      const updated = await registrationsDb.reactivateRegistration(existing.id, payload, connection);
      if (!updated) {
        throw new AppError(409, 'ALREADY_REGISTERED', 'You are already registered for this event.');
      }
      registrationId = existing.id;
      await qrCredentialsDb.deleteByRegistrationId(existing.id, connection);
    } else {
      try {
        registrationId = await registrationsDb.createRegistration(
          {
            eventId: event.id,
            memberId: member.id,
            ...payload,
          },
          connection
        );
      } catch (err) {
        if (err && err.code === 'ER_DUP_ENTRY') {
          throw new AppError(
            409,
            'ALREADY_REGISTERED',
            'You already have a registration record for this event.'
          );
        }
        throw err;
      }
    }

    await connection.commit();
    log('Registration created', registrationId, 'addons', addonCount);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  if (isFree) {
    await qrService.issueAfterPaid(registrationId);
    await emailService.sendPassPdfEmail(registrationId);
  }

  return {
    id: registrationId,
    eventId: Number(eventId),
    eventTitle,
    status,
    amountPaise,
    addonCount,
    isFree,
  };
}

async function updateAddons(registrationId, userId, addonCountRaw) {
  const member = await membersDb.findMemberByUserId(userId);
  if (!member) {
    throw new AppError(400, 'NO_MEMBER_PROFILE', 'Member profile not found.');
  }

  const addonCount = parseAddonCount(addonCountRaw);
  const owned = await registrationsDb.findRegistrationOwnedByUser(registrationId, userId);
  if (!owned) {
    throw new AppError(404, 'NOT_FOUND', 'Registration not found.');
  }

  const previousAddons = Number(owned.addon_count || 0);
  if (previousAddons === addonCount) {
    return { id: owned.id, addonCount, unchanged: true };
  }

  const connection = await pool.getConnection();
  let amountPaise;
  try {
    await connection.beginTransaction();

    const event = await eventsDb.findEventByIdForUpdate(owned.event_id, connection);
    if (!event) {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found.');
    }
    if (event.status !== 'PUBLISHED') {
      throw new AppError(400, 'EVENT_NOT_OPEN', 'Add-ons can only be changed for a published event.');
    }
    if (new Date(event.starts_at) <= new Date()) {
      throw new AppError(400, 'EVENT_STARTED', 'Add-ons can only be changed before the event starts.');
    }
    if (owned.status !== 'PENDING_PAYMENT' && owned.status !== 'PAID') {
      throw new AppError(400, 'INVALID_STATUS', 'This registration can no longer change add-ons.');
    }

    const entered = Number(owned.entered_count || 0);
    const newParty = partySizeOf(addonCount);
    if (newParty < entered) {
      throw new AppError(
        400,
        'ADDONS_BELOW_ENTERED',
        `At least ${entered} people have already entered. You cannot go below that.`
      );
    }

    const taken = await eventsDb.countTakenSeats(event.id, connection);
    const takenWithoutMe = taken - partySizeOf(previousAddons);
    if (takenWithoutMe + newParty > event.capacity) {
      const left = Math.max(event.capacity - takenWithoutMe, 0);
      throw new AppError(
        409,
        'EVENT_FULL',
        `Only ${left} seat(s) available for your party.`
      );
    }

    amountPaise = amountForParty(event.price_paise, addonCount);
    await registrationsDb.updateAddonCount(
      owned.id,
      {
        addonCount,
        amountPaise,
        clearOrderId: owned.status === 'PENDING_PAYMENT',
      },
      connection
    );

    await connection.commit();
    log('Add-ons updated', owned.id, previousAddons, '->', addonCount);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  await emailService.sendAddonChangeEmail({
    registrationId: owned.id,
    userId,
    toEmail: owned.member_email,
    memberName: owned.member_name,
    eventTitle: owned.event_title,
    eventVenue: owned.event_venue,
    eventStartsAt: owned.event_starts_at,
    previousAddons,
    addonCount,
    amountPaise,
    status: owned.status,
  });

  return {
    id: owned.id,
    addonCount,
    amountPaise,
    unchanged: false,
  };
}

async function cancelMyRegistration(registrationId, userId) {
  const owned = await registrationsDb.findRegistrationOwnedByUser(registrationId, userId);
  if (!owned) {
    throw new AppError(404, 'NOT_FOUND', 'Registration not found.');
  }
  if (!canCancelRegistration(owned)) {
    throw new AppError(400, 'INVALID_STATUS', 'This registration cannot be cancelled.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const updated = await registrationsDb.cancelRegistration(owned.id, connection);
    if (!updated) {
      throw new AppError(409, 'UPDATE_FAILED', 'Could not cancel this registration.');
    }
    await qrCredentialsDb.revokeByRegistrationId(owned.id, connection);
    await connection.commit();
    log('Registration cancelled', owned.id);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  await emailService.sendCancelRegistrationEmail({
    toEmail: owned.member_email,
    memberName: owned.member_name,
    eventTitle: owned.event_title,
    eventVenue: owned.event_venue,
    eventStartsAt: owned.event_starts_at,
    addonCount: Number(owned.addon_count || 0),
  });

  return { id: owned.id, status: 'CANCELLED' };
}

async function listMyRegistrations(userId) {
  const member = await membersDb.findMemberByUserId(userId);
  if (!member) {
    throw new AppError(400, 'NO_MEMBER_PROFILE', 'Member profile not found.');
  }
  const rows = await registrationsDb.listForMember(member.id);
  const registrations = [];

  for (const row of rows) {
    const taken = await eventsDb.countTakenSeats(row.event_id);
    const seatsLeft = Math.max(Number(row.capacity) - taken, 0);
    const addonCount = Number(row.addon_count || 0);
    registrations.push({
      ...row,
      addon_count: addonCount,
      party_size: partySizeOf(addonCount),
      seats_left: seatsLeft,
      max_addons: canChangeAddons(row) ? addonCount + seatsLeft : addonCount,
      can_change_addons: canChangeAddons(row),
      can_cancel: canCancelRegistration(row),
    });
  }

  return { member, registrations };
}

module.exports = {
  listPublishedEventsForMember,
  getPublishedEventForMember,
  registerForEvent,
  updateAddons,
  cancelMyRegistration,
  listMyRegistrations,
};

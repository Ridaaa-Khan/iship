
const AppError = require('../utils/AppError');
const eventsDb = require('../db/events');
const { fromDatetimeLocal } = require('../utils/datetime');
const { deleteCoverFile } = require('../middleware/eventCover');
const { log } = require('../utils/logger');

function toDbPayload(body, createdBy) {
  return {
    title: body.title,
    description: body.description || null,
    venue: body.venue || null,
    startsAt: fromDatetimeLocal(body.startsAt),
    endsAt: fromDatetimeLocal(body.endsAt),
    doorsOpenAt: fromDatetimeLocal(body.doorsOpenAt),
    doorsCloseAt: fromDatetimeLocal(body.doorsCloseAt),
    capacity: body.capacity,
    pricePaise: Math.round(Number(body.priceRupees) * 100),
    status: body.status || 'DRAFT',
    createdBy: createdBy || null,
  };
}

function wantsCoverRemoved(body) {
  const value = body && body.removeCover;
  return value === '1' || value === 'on' || value === 'true' || value === true;
}

async function withSeatCounts(events) {
  const rows = [];
  for (const event of events) {
    const taken = await eventsDb.countTakenSeats(event.id);
    rows.push({
      ...event,
      seatsTaken: taken,
      seatsLeft: Math.max(Number(event.capacity) - taken, 0),
    });
  }
  return rows;
}

async function listEvents() {
  return withSeatCounts(await eventsDb.listEvents());
}

async function getEvent(id) {
  const event = await eventsDb.findEventById(id);
  if (!event) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found.');
  }
  return event;
}

async function createEvent(body, adminUserId, file) {
  const payload = toDbPayload(body, adminUserId);

  payload.coverImage = file ? file.filename : null;
  payload.coverImagePublicId = file ? file.public_id : null;

  try {
    const id = await eventsDb.createEvent(payload);
    log('Event created', id);
    return getEvent(id);
  } catch (err) {
    if (file && file.public_id) deleteCoverFile(file.public_id);
    throw err;
  }
}

async function updateEvent(id, body, file) {
  const existing = await getEvent(id);
  const payload = toDbPayload(body, null);
  delete payload.createdBy;

  let coverImage = existing.cover_image || null;
  let coverImagePublicId = existing.cover_image_public_id || null;

  if (file) {
    coverImage = file.filename;
    coverImagePublicId = file.public_id;
  } else if (wantsCoverRemoved(body)) {
    coverImage = null;
    coverImagePublicId = null;
  }

  payload.coverImage = coverImage;
  payload.coverImagePublicId = coverImagePublicId;

  await eventsDb.updateEvent(id, payload);

  if (file && existing.cover_image_public_id) {
    deleteCoverFile(existing.cover_image_public_id);
  } else if (wantsCoverRemoved(body) && existing.cover_image_public_id) {
    deleteCoverFile(existing.cover_image_public_id);
  }

  log('Event updated', id);
  return getEvent(id);
}

async function publishEvent(id) {
  const event = await getEvent(id);
  if (event.status === 'CANCELLED') {
    throw new AppError(400, 'EVENT_CANCELLED', 'Cannot publish a cancelled event.');
  }
  await eventsDb.setEventStatus(id, 'PUBLISHED');
  return getEvent(id);
}

async function cancelEvent(id) {
  await getEvent(id);
  await eventsDb.setEventStatus(id, 'CANCELLED');
  return getEvent(id);
}

module.exports = {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  publishEvent,
  cancelEvent,
};

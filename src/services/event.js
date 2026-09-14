const AppError = require('../utils/AppError');
const eventsDb = require('../db/events');
const { fromDatetimeLocal } = require('../utils/datetime');

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

async function listEvents() {
  return eventsDb.listEvents();
}

async function getEvent(id) {
  const event = await eventsDb.findEventById(id);
  if (!event) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found.');
  }
  return event;
}

async function createEvent(body, adminUserId) {
  const payload = toDbPayload(body, adminUserId);
  const id = await eventsDb.createEvent(payload);
  return getEvent(id);
}

async function updateEvent(id, body) {
  await getEvent(id);
  const payload = toDbPayload(body, null);
  delete payload.createdBy;
  await eventsDb.updateEvent(id, payload);
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
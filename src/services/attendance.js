const AppError = require('../utils/AppError');
const checkInsDb = require('../db/checkIns');
const eventsDb = require('../db/events');
const { fromDatetimeLocal } = require('../utils/datetime');

async function getTodaysEntries() {
  const entries = await checkInsDb.listToday();
  return { entries };
}

async function listEventsForAttendance() {
  const events = await eventsDb.listEvents();
  return { events };
}

async function getEventAttendance(eventId) {
  const event = await eventsDb.findEventById(eventId);
  if (!event) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found.');
  }
  const rows = await checkInsDb.listAttendanceForEvent(eventId);
  return { event, rows };
}

async function updateTodaysEntry(id, { createdAt, result, denialReason }) {
  const entry = await checkInsDb.findCheckInById(id);
  if (!entry) {
    throw new AppError(404, 'ENTRY_NOT_FOUND', 'Scan entry not found.');
  }

  const normalizedResult = String(result || '').toUpperCase();
  if (normalizedResult !== 'ALLOWED' && normalizedResult !== 'DENIED') {
    throw new AppError(400, 'INVALID_RESULT', 'Status must be ALLOWED or DENIED.');
  }

  const when = fromDatetimeLocal(createdAt);
  if (!when) {
    throw new AppError(400, 'INVALID_TIME', 'Date and time are required.');
  }

  const reason = String(denialReason || '').trim();
  await checkInsDb.updateCheckIn(id, {
    createdAt: when,
    result: normalizedResult,
    denialReason: normalizedResult === 'DENIED' ? reason || null : reason || null,
  });
}

module.exports = {
  getTodaysEntries,
  listEventsForAttendance,
  getEventAttendance,
  updateTodaysEntry,
};
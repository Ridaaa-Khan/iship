const pool = require('../config/db');

async function createEvent(data) {
  const [result] = await pool.execute(
    `INSERT INTO events (
      title, description, venue,
      starts_at, ends_at, doors_open_at, doors_close_at,
      capacity, price_paise, cover_image, status, created_by
    ) VALUES (
      :title, :description, :venue,
      :startsAt, :endsAt, :doorsOpenAt, :doorsCloseAt,
      :capacity, :pricePaise, :coverImage, :status, :createdBy
    )`,
    data
  );
  return result.insertId;
}

async function updateEvent(id, data) {
  const [result] = await pool.execute(
    `UPDATE events SET
      title = :title,
      description = :description,
      venue = :venue,
      starts_at = :startsAt,
      ends_at = :endsAt,
      doors_open_at = :doorsOpenAt,
      doors_close_at = :doorsCloseAt,
      capacity = :capacity,
      price_paise = :pricePaise,
      cover_image = :coverImage,
      status = :status
     WHERE id = :id`,
    { id, ...data }
  );
  return result.affectedRows;
}

async function completeEndedEvents() {
  await pool.execute(
    `UPDATE events
     SET status = 'COMPLETED'
     WHERE status = 'PUBLISHED'
       AND ends_at <= NOW()`
  );
}

async function findEventById(id) {
  await completeEndedEvents();
  const [rows] = await pool.execute(
    `SELECT * FROM events WHERE id = :id LIMIT 1`,
    { id }
  );
  return rows[0] || null;
}

async function listEvents() {
  await completeEndedEvents();
  const [rows] = await pool.execute(
    `SELECT id, title, description, venue, starts_at, ends_at, doors_open_at, doors_close_at,
            capacity, price_paise, cover_image, status, created_at
     FROM events
     ORDER BY starts_at DESC`
  );
  return rows;
}

async function setEventStatus(id, status) {
  const [result] = await pool.execute(
    `UPDATE events SET status = :status WHERE id = :id`,
    { id, status }
  );
  return result.affectedRows;
}

async function listPublishedEvents() {
    await completeEndedEvents();
    const [rows] = await pool.execute(
      `SELECT id, title, description, venue, starts_at, ends_at,
              doors_open_at, doors_close_at, capacity, price_paise, cover_image, status
       FROM events
       WHERE status IN ('PUBLISHED', 'COMPLETED')
       ORDER BY starts_at ASC`
    );
    return rows;
  }
  
  async function countTakenSeats(eventId, connection = pool) {
    const [rows] = await connection.execute(
      `SELECT COALESCE(SUM(1 + COALESCE(addon_count, 0)), 0) AS taken
       FROM event_registrations
       WHERE event_id = :eventId
         AND status IN ('PENDING_PAYMENT', 'PAID', 'CHECKED_IN')`,
      { eventId }
    );
    return Number(rows[0].taken);
  }
  
  async function findEventByIdForUpdate(eventId, connection) {
    await connection.execute(
      `UPDATE events
       SET status = 'COMPLETED'
       WHERE id = :eventId
         AND status = 'PUBLISHED'
         AND ends_at <= NOW()`,
      { eventId }
    );
    const [rows] = await connection.execute(
      `SELECT * FROM events WHERE id = :eventId LIMIT 1 FOR UPDATE`,
      { eventId }
    );
    return rows[0] || null;
  }

module.exports = {
  createEvent,
  updateEvent,
  findEventById,
  listEvents,
  setEventStatus,
  listPublishedEvents,
  countTakenSeats,
  findEventByIdForUpdate,
  completeEndedEvents,
};
const pool = require('../config/db');


async function createCheckIn(
  {
    eventId,
    registrationId = null,
    credentialId = null,
    scannerUserId = null,
    deviceLabel = null,
    result,
    denialReason = null,
    notes = null,
  },
  connection = pool
) {
  const [insertResult] = await connection.execute(
    `INSERT INTO check_ins (
      event_id, registration_id, credential_id, scanner_user_id,
      device_label, result, denial_reason, notes
    ) VALUES (
      :eventId, :registrationId, :credentialId, :scannerUserId,
      :deviceLabel, :result, :denialReason, :notes
    )`,
    {
      eventId,
      registrationId,
      credentialId,
      scannerUserId,
      deviceLabel,
      result,
      denialReason,
      notes,
    }
  );
  return insertResult.insertId;
}


async function listToday() {
  const [rows] = await pool.execute(
    `SELECT
       c.id,
       c.result,
       c.denial_reason,
       c.device_label,
       c.created_at,
       e.id AS event_id,
       e.title AS event_title,
       r.status AS registration_status,
       r.addon_count,
       r.entered_count,
       r.cancelled_at,
       m.full_name,
       u.email AS member_email,
       su.email AS scanner_email
     FROM check_ins c
     INNER JOIN events e ON e.id = c.event_id
     LEFT JOIN event_registrations r ON r.id = c.registration_id
     LEFT JOIN member_profiles m ON m.id = r.member_id
     LEFT JOIN users u ON u.id = m.user_id
     LEFT JOIN users su ON su.id = c.scanner_user_id
     WHERE DATE(c.created_at) = CURDATE()
     ORDER BY c.created_at DESC`
  );
  return rows;
}


async function listAttendanceForEvent(eventId) {
  const [rows] = await pool.execute(
    `SELECT
       r.id AS registration_id,
       r.status AS registration_status,
       r.addon_count,
       r.entered_count,
       r.checked_in_at,
       r.paid_at,
       r.cancelled_at,
       m.full_name,
       u.email,
       q.status AS qr_status,
       q.used_at
     FROM event_registrations r
     INNER JOIN member_profiles m ON m.id = r.member_id
     INNER JOIN users u ON u.id = m.user_id
     LEFT JOIN qr_credentials q ON q.registration_id = r.id
     WHERE r.event_id = :eventId
     ORDER BY
       CASE r.status
         WHEN 'CHECKED_IN' THEN 1
         WHEN 'PAID' THEN 2
         WHEN 'PENDING_PAYMENT' THEN 3
         WHEN 'CANCELLED' THEN 4
         ELSE 5
       END,
       m.full_name ASC`,
    { eventId }
  );
  return rows;
}

async function findCheckInById(id) {
  const [rows] = await pool.execute(
    `SELECT id, event_id, registration_id, result, denial_reason, created_at
     FROM check_ins
     WHERE id = :id
     LIMIT 1`,
    { id }
  );
  return rows[0] || null;
}

async function updateCheckIn(id, { createdAt, result, denialReason }) {
  const [updateResult] = await pool.execute(
    `UPDATE check_ins
     SET created_at = :createdAt,
         result = :result,
         denial_reason = :denialReason
     WHERE id = :id`,
    { id, createdAt, result, denialReason }
  );
  return updateResult.affectedRows;
}

async function listRecent(limit = 8) {
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 8));
  const [rows] = await pool.execute(
    `SELECT
       c.id,
       c.result,
       c.denial_reason,
       c.device_label,
       c.created_at,
       e.title AS event_title,
       m.full_name,
       su.email AS scanner_email
     FROM check_ins c
     INNER JOIN events e ON e.id = c.event_id
     LEFT JOIN event_registrations r ON r.id = c.registration_id
     LEFT JOIN member_profiles m ON m.id = r.member_id
     LEFT JOIN users su ON su.id = c.scanner_user_id
     ORDER BY c.created_at DESC
     LIMIT ${safeLimit}`
  );
  return rows;
}

async function listRecentForUser(userId, limit = 8) {
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 8));
  const [rows] = await pool.execute(
    `SELECT
       c.id,
       c.result,
       c.device_label,
       c.created_at,
       e.title AS event_title
     FROM check_ins c
     INNER JOIN event_registrations r ON r.id = c.registration_id
     INNER JOIN member_profiles m ON m.id = r.member_id
     INNER JOIN events e ON e.id = c.event_id
     WHERE m.user_id = :userId
       AND c.result = 'ALLOWED'
     ORDER BY c.created_at DESC
     LIMIT ${safeLimit}`,
    { userId }
  );
  return rows;
}

async function countAllowedToday() {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS n
     FROM check_ins
     WHERE DATE(created_at) = CURDATE()
       AND result = 'ALLOWED'`
  );
  return Number(rows[0].n) || 0;
}

async function countTodayBreakdown() {
  const [rows] = await pool.execute(
    `SELECT
       COUNT(*) AS scans,
       SUM(result = 'ALLOWED') AS successful,
       SUM(result = 'DENIED') AS denied
     FROM check_ins
     WHERE DATE(created_at) = CURDATE()`
  );
  return {
    scans: Number(rows[0].scans) || 0,
    successful: Number(rows[0].successful) || 0,
    denied: Number(rows[0].denied) || 0,
  };
}

async function countCurrentInside() {
  const [rows] = await pool.execute(
    `SELECT COALESCE(SUM(entered_count), 0) AS inside
     FROM event_registrations
     WHERE status = 'CHECKED_IN'
       AND DATE(checked_in_at) = CURDATE()`
  );
  return Number(rows[0].inside) || 0;
}

async function countAllowedByDay(since) {
  const [rows] = await pool.execute(
    `SELECT DATE(created_at) AS day, COUNT(*) AS count
     FROM check_ins
     WHERE result = 'ALLOWED'
       AND created_at >= :since
     GROUP BY DATE(created_at)
     ORDER BY day ASC`,
    { since }
  );
  return rows;
}

async function findLastAllowedForUser(userId) {
  const [rows] = await pool.execute(
    `SELECT c.created_at, c.device_label, e.title AS event_title
     FROM check_ins c
     INNER JOIN event_registrations r ON r.id = c.registration_id
     INNER JOIN member_profiles m ON m.id = r.member_id
     INNER JOIN events e ON e.id = c.event_id
     WHERE m.user_id = :userId
       AND c.result = 'ALLOWED'
     ORDER BY c.created_at DESC
     LIMIT 1`,
    { userId }
  );
  return rows[0] || null;
}

async function countAllowedForUser(userId, since = null) {
  let sql = `SELECT COUNT(*) AS n
     FROM check_ins c
     INNER JOIN event_registrations r ON r.id = c.registration_id
     INNER JOIN member_profiles m ON m.id = r.member_id
     WHERE m.user_id = :userId
       AND c.result = 'ALLOWED'`;
  const params = { userId };
  if (since) {
    sql += ' AND c.created_at >= :since';
    params.since = since;
  }
  const [rows] = await pool.execute(sql, params);
  return Number(rows[0].n) || 0;
}

module.exports = {
  createCheckIn,
  listToday,
  listAttendanceForEvent,
  findCheckInById,
  updateCheckIn,
  listRecent,
  listRecentForUser,
  countAllowedToday,
  countTodayBreakdown,
  countCurrentInside,
  countAllowedByDay,
  findLastAllowedForUser,
  countAllowedForUser,
};
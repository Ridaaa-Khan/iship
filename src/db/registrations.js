const pool = require('../config/db');

async function findByEventAndMember(eventId, memberId) {
  const [rows] = await pool.execute(
    `SELECT * FROM event_registrations
     WHERE event_id = :eventId AND member_id = :memberId
     LIMIT 1`,
    { eventId, memberId }
  );
  return rows[0] || null;
}

async function createRegistration(data, connection = pool) {
  const [result] = await connection.execute(
    `INSERT INTO event_registrations (
      event_id, member_id, status, amount_paise, addon_count, paid_at
    ) VALUES (
      :eventId, :memberId, :status, :amountPaise, :addonCount, :paidAt
    )`,
    data
  );
  return result.insertId;
}

async function reactivateRegistration(id, data, connection = pool) {
  const [result] = await connection.execute(
    `UPDATE event_registrations
     SET status = :status,
         amount_paise = :amountPaise,
         addon_count = :addonCount,
         entered_count = 0,
         paid_at = :paidAt,
         cancelled_at = NULL,
         checked_in_at = NULL,
         razorpay_order_id = NULL,
         razorpay_payment_id = NULL,
         razorpay_signature = NULL
     WHERE id = :id AND status = 'CANCELLED'`,
    { id, ...data }
  );
  return result.affectedRows;
}

async function updateAddonCount(id, { addonCount, amountPaise, clearOrderId = false }, connection = pool) {
  const orderSql = clearOrderId ? ', razorpay_order_id = NULL' : '';
  const [result] = await connection.execute(
    `UPDATE event_registrations
     SET addon_count = :addonCount,
         amount_paise = :amountPaise
         ${orderSql}
     WHERE id = :id`,
    { id, addonCount, amountPaise }
  );
  return result.affectedRows;
}

async function cancelRegistration(id, connection = pool) {
  const [result] = await connection.execute(
    `UPDATE event_registrations
     SET status = 'CANCELLED',
         cancelled_at = CURRENT_TIMESTAMP
     WHERE id = :id AND status IN ('PENDING_PAYMENT', 'PAID')`,
    { id }
  );
  return result.affectedRows;
}

async function incrementEntered(id, count, connection = pool) {
  const [result] = await connection.execute(
    `UPDATE event_registrations
     SET entered_count = entered_count + :count
     WHERE id = :id`,
    { id, count }
  );
  return result.affectedRows;
}

async function findRegistrationById(id) {
  const [rows] = await pool.execute(
    `SELECT * FROM event_registrations WHERE id = :id LIMIT 1`,
    { id }
  );
  return rows[0] || null;
}

async function listForMember(memberId) {
  const [rows] = await pool.execute(
    `SELECT r.id, r.status, r.amount_paise, r.addon_count, r.entered_count,
            r.paid_at, r.cancelled_at, r.created_at,
            e.id AS event_id, e.title, e.venue, e.starts_at, e.status AS event_status,
            e.price_paise, e.capacity
     FROM event_registrations r
     INNER JOIN events e ON e.id = r.event_id
     WHERE r.member_id = :memberId
     ORDER BY e.starts_at DESC`,
    { memberId }
  );
  return rows;
}

async function listAllWithDetails() {
  const [rows] = await pool.execute(
    `SELECT r.id, r.status, r.amount_paise, r.addon_count, r.entered_count,
            r.paid_at, r.razorpay_order_id,
            r.razorpay_payment_id, r.cancelled_at, r.created_at,
            e.id AS event_id, e.title AS event_title, e.starts_at,
            m.id AS member_id, m.full_name, u.email
     FROM event_registrations r
     INNER JOIN events e ON e.id = r.event_id
     INNER JOIN member_profiles m ON m.id = r.member_id
     INNER JOIN users u ON u.id = m.user_id
     ORDER BY r.created_at DESC`
  );
  return rows;
}

async function saveOrderId(id, orderId) {
  await pool.execute(
    `UPDATE event_registrations
     SET razorpay_order_id = :orderId
     WHERE id = :id`,
    { id, orderId }
  );
}

async function markPaid(id, { paymentId = null, signature = null } = {}) {
  const [result] = await pool.execute(
    `UPDATE event_registrations
     SET status = 'PAID',
         paid_at = CURRENT_TIMESTAMP,
         razorpay_payment_id = COALESCE(:paymentId, razorpay_payment_id),
         razorpay_signature = COALESCE(:signature, razorpay_signature)
     WHERE id = :id AND status = 'PENDING_PAYMENT'`,
    { id, paymentId, signature }
  );
  return result.affectedRows;
}

async function findRegistrationOwnedByUser(registrationId, userId) {
  const [rows] = await pool.execute(
    `SELECT r.*,
            e.title AS event_title,
            e.venue AS event_venue,
            e.starts_at AS event_starts_at,
            e.ends_at AS event_ends_at,
            e.doors_open_at AS event_doors_open_at,
            e.doors_close_at AS event_doors_close_at,
            e.price_paise AS event_price_paise,
            m.full_name AS member_name,
            u.email AS member_email
     FROM event_registrations r
     INNER JOIN events e ON e.id = r.event_id
     INNER JOIN member_profiles m ON m.id = r.member_id
     INNER JOIN users u ON u.id = m.user_id
     WHERE r.id = :registrationId AND m.user_id = :userId
     LIMIT 1`,
    { registrationId, userId }
  );
  return rows[0] || null;
}

async function findByIdWithEvent(id) {
  const [rows] = await pool.execute(
    `SELECT
       r.id,
       r.event_id,
       r.member_id,
       r.status,
       r.amount_paise,
       r.addon_count,
       r.entered_count,
       r.paid_at,
       e.title AS event_title,
       e.status AS event_status,
       e.doors_open_at,
       e.doors_close_at,
       e.starts_at,
       e.ends_at
     FROM event_registrations r
     INNER JOIN events e ON e.id = r.event_id
     WHERE r.id = :id
     LIMIT 1`,
    { id }
  );
  return rows[0] || null;
}


async function markCheckedIn(registrationId, connection = pool) {
    const [result] = await connection.execute(
      `UPDATE event_registrations
       SET status = 'CHECKED_IN',
           checked_in_at = CURRENT_TIMESTAMP
       WHERE id = :registrationId AND status = 'PAID'`,
      { registrationId }
    );
    return result.affectedRows;
  }

async function listUpcomingForMember(memberId, limit = 5) {
  const safeLimit = Math.min(20, Math.max(1, Number(limit) || 5));
  const [rows] = await pool.execute(
    `SELECT r.id, r.status, r.addon_count, e.id AS event_id, e.title, e.venue,
            e.starts_at, e.cover_image, e.capacity, e.price_paise
     FROM event_registrations r
     INNER JOIN events e ON e.id = r.event_id
     WHERE r.member_id = :memberId
       AND r.status <> 'CANCELLED'
       AND e.starts_at >= NOW()
     ORDER BY e.starts_at ASC
     LIMIT ${safeLimit}`,
    { memberId }
  );
  return rows;
}

module.exports = {
  findByEventAndMember,
  createRegistration,
  reactivateRegistration,
  updateAddonCount,
  cancelRegistration,
  incrementEntered,
  findRegistrationById,
  listForMember,
  listAllWithDetails,
  saveOrderId,
  markPaid,
  findRegistrationOwnedByUser,
  findByIdWithEvent,
  markCheckedIn,
  listUpcomingForMember,
};

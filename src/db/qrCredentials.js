const pool = require('../config/db');

async function findByRegistrationId(registrationId) {
  const [rows] = await pool.execute(
    `SELECT * FROM qr_credentials
     WHERE registration_id = :registrationId
     LIMIT 1`,
    { registrationId }
  );
  return rows[0] || null;
}

async function createCredential({
  publicId,
  secretHash,
  qrPayload,
  registrationId,
  eventId,
  expiresAt,
}) {
  const [result] = await pool.execute(
    `INSERT INTO qr_credentials (
      public_id, secret_hash, qr_payload, registration_id, event_id, status, expires_at
    ) VALUES (
      :publicId, :secretHash, :qrPayload, :registrationId, :eventId, 'ACTIVE', :expiresAt
    )`,
    { publicId, secretHash, qrPayload, registrationId, eventId, expiresAt }
  );
  return result.insertId;
}

async function deleteByRegistrationId(registrationId, connection = pool) {
  const [result] = await connection.execute(
    `DELETE FROM qr_credentials WHERE registration_id = :registrationId`,
    { registrationId }
  );
  return result.affectedRows;
}

async function findByPublicIdForUpdate(publicId, connection) {
  const [rows] = await connection.execute(
    `SELECT
       c.id,
       c.public_id,
       c.secret_hash,
       c.registration_id,
       c.event_id,
       c.status AS credential_status,
       c.expires_at,
       r.status AS registration_status,
       r.addon_count,
       r.entered_count,
       e.title AS event_title,
       e.status AS event_status,
       e.venue AS event_venue,
       e.starts_at AS event_starts_at,
       e.doors_open_at,
       e.doors_close_at,
       m.full_name,
       m.status AS member_status,
       u.email AS member_email
     FROM qr_credentials c
     INNER JOIN event_registrations r ON r.id = c.registration_id
     INNER JOIN events e ON e.id = c.event_id
     INNER JOIN member_profiles m ON m.id = r.member_id
     INNER JOIN users u ON u.id = m.user_id
     WHERE c.public_id = :publicId
     LIMIT 1
     FOR UPDATE`,
    { publicId }
  );
  return rows[0] || null;
}


async function markUsed(credentialId, connection = pool) {
  const [result] = await connection.execute(
    `UPDATE qr_credentials
     SET status = 'USED',
         used_at = CURRENT_TIMESTAMP
     WHERE id = :credentialId AND status = 'ACTIVE'`,
    { credentialId }
  );
  return result.affectedRows;
}

async function revokeByRegistrationId(registrationId, connection = pool) {
  const [result] = await connection.execute(
    `UPDATE qr_credentials
     SET status = 'REVOKED',
         revoked_at = CURRENT_TIMESTAMP
     WHERE registration_id = :registrationId
       AND status = 'ACTIVE'`,
    { registrationId }
  );
  return result.affectedRows;
}

module.exports = {
  findByRegistrationId,
  createCredential,
  deleteByRegistrationId,
  findByPublicIdForUpdate,
  markUsed,
  revokeByRegistrationId,
};

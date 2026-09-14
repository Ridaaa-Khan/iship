const pool = require('../config/db');

async function findByUserId(userId) {
  const [rows] = await pool.execute(
    `SELECT scanner_name, gate_number
     FROM scanner_profiles
     WHERE user_id = :userId
     LIMIT 1`,
    { userId }
  );
  return rows[0] || null;
}

async function listScanners() {
  const [rows] = await pool.execute(
    `SELECT u.id, u.email, u.is_active, u.last_login_at, u.created_at,
            sp.scanner_name, sp.gate_number
     FROM users u
     LEFT JOIN scanner_profiles sp ON sp.user_id = u.id
     WHERE u.role = 'SCANNER'
     ORDER BY u.created_at DESC`
  );
  return rows;
}

async function createScanner({ email, passwordHash, scannerName, gateNumber }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [userResult] = await connection.execute(
      `INSERT INTO users (email, password_hash, role, is_active)
       VALUES (:email, :passwordHash, 'SCANNER', 1)`,
      { email, passwordHash }
    );
    const userId = userResult.insertId;
    await connection.execute(
      `INSERT INTO scanner_profiles (user_id, scanner_name, gate_number)
       VALUES (:userId, :scannerName, :gateNumber)`,
      { userId, scannerName, gateNumber }
    );
    await connection.commit();
    return userId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function deleteScanner(id) {
  const [result] = await pool.execute(
    `DELETE FROM users WHERE id = :id AND role = 'SCANNER'`,
    { id }
  );
  return result.affectedRows;
}

module.exports = {
  findByUserId,
  listScanners,
  createScanner,
  deleteScanner,
};

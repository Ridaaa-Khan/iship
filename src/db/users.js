const pool = require('../config/db');

async function findUserByEmail(email) {
  const [rows] = await pool.execute(
    `SELECT id, email, password_hash, role, is_active, last_login_at, created_at
     FROM users
     WHERE email = :email
     LIMIT 1`,
    { email }
  );
  return rows[0] || null;
}

async function findUserById(id) {
  const [rows] = await pool.execute(
    `SELECT id, email, role, is_active, last_login_at, created_at
     FROM users
     WHERE id = :id
     LIMIT 1`,
    { id }
  );
  return rows[0] || null;
}

async function createUser({ email, passwordHash, role = 'MEMBER' }) {
  const [result] = await pool.execute(
    `INSERT INTO users (email, password_hash, role)
     VALUES (:email, :passwordHash, :role)`,
    { email, passwordHash, role }
  );
  return result.insertId;
}

async function touchLastLogin(id) {
  await pool.execute(
    `UPDATE users
     SET last_login_at = CURRENT_TIMESTAMP
     WHERE id = :id`,
    { id }
  );
}

async function updateEmail(id, email) {
  const [result] = await pool.execute(
    `UPDATE users SET email = :email WHERE id = :id`,
    { id, email }
  );
  return result.affectedRows;
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  touchLastLogin,
  updateEmail,
};
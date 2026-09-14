const pool = require('../config/db');

async function createMemberProfile({ userId, fullName, phone = null }) {
  const [result] = await pool.execute(
    `INSERT INTO member_profiles
      (user_id, full_name, phone, status)
     VALUES
      (:userId, :fullName, :phone, 'ACTIVE')`,
    { userId, fullName, phone }
  );
  return result.insertId;
}

async function findMemberByUserId(userId) {
  const [rows] = await pool.execute(
    `SELECT id, user_id, full_name, phone, status, created_at
     FROM member_profiles
     WHERE user_id = :userId
     LIMIT 1`,
    { userId }
  );
  return rows[0] || null;
}

async function findMemberWithUserByUserId(userId) {
  const [rows] = await pool.execute(
    `SELECT m.id, m.user_id, m.full_name, m.phone, m.status, m.created_at,
            u.email
     FROM member_profiles m
     INNER JOIN users u ON u.id = m.user_id
     WHERE m.user_id = :userId
     LIMIT 1`,
    { userId }
  );
  return rows[0] || null;
}

async function updateMemberProfile(userId, { fullName, phone }) {
  const [result] = await pool.execute(
    `UPDATE member_profiles
     SET full_name = :fullName, phone = :phone
     WHERE user_id = :userId`,
    { userId, fullName, phone }
  );
  return result.affectedRows;
}

async function countMembers() {
  const [rows] = await pool.execute(
    `SELECT
       COUNT(*) AS total,
       SUM(status = 'ACTIVE') AS active
     FROM member_profiles`
  );
  return {
    total: Number(rows[0].total) || 0,
    active: Number(rows[0].active) || 0,
  };
}

async function listMembersForAdmin() {
  const [rows] = await pool.execute(
    `SELECT m.id, m.full_name, m.phone, m.status, m.created_at,
            u.email, u.is_active, u.last_login_at
     FROM member_profiles m
     INNER JOIN users u ON u.id = m.user_id
     WHERE u.role = 'MEMBER'
     ORDER BY m.created_at DESC`
  );
  return rows;
}

async function deleteMember(id) {
  const [result] = await pool.execute(
    `DELETE u FROM users u
     INNER JOIN member_profiles m ON m.user_id = u.id
     WHERE m.id = :id AND u.role = 'MEMBER'`,
    { id }
  );
  return result.affectedRows;
}

module.exports = {
  createMemberProfile,
  findMemberByUserId,
  findMemberWithUserByUserId,
  updateMemberProfile,
  countMembers,
  listMembersForAdmin,
  deleteMember,
};

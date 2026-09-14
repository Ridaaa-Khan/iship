const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const AppError = require('../utils/AppError');
const usersDb = require('../db/users');
const membersDb = require('../db/members');
const scannersDb = require('../db/scanners');
const { assertFullName, assertPhone } = require('../utils/personFields');

const BCRYPT_ROUNDS = 12;

function nameFromEmail(email) {
  const part = String(email || '').split('@')[0].replace(/[._-]+/g, ' ').trim();
  if (!part) return 'User';
  return part.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

async function withDisplayName(user) {
  let displayName = nameFromEmail(user.email);
  if (user.role === 'MEMBER') {
    const member = await membersDb.findMemberByUserId(user.id);
    if (member && member.full_name) displayName = member.full_name;
  } else if (user.role === 'SCANNER') {
    const scanner = await scannersDb.findByUserId(user.id);
    if (scanner && scanner.scanner_name) displayName = scanner.scanner_name;
  }
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName,
  };
}

async function registerMember({ email, password, fullName, phone }) {
  const safeName = assertFullName(fullName);
  const safePhone = assertPhone(phone);
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await usersDb.findUserByEmail(normalizedEmail);
  if (existing) {
    throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [userResult] = await connection.execute(
      `INSERT INTO users (email, password_hash, role)
       VALUES (:email, :passwordHash, 'MEMBER')`,
      { email: normalizedEmail, passwordHash }
    );

    const userId = userResult.insertId;

    await connection.execute(
      `INSERT INTO member_profiles
        (user_id, full_name, phone, status)
       VALUES
        (:userId, :fullName, :phone, 'ACTIVE')`,
      {
        userId,
        fullName: safeName,
        phone: safePhone,
      }
    );

    await connection.commit();

    return withDisplayName({
      id: userId,
      email: normalizedEmail,
      role: 'MEMBER',
    });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function login({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await usersDb.findUserByEmail(normalizedEmail);

  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  if (!user.is_active) {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled.');
  }

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  await usersDb.touchLastLogin(user.id);

  return withDisplayName(user);
}

module.exports = {
  registerMember,
  login,
  withDisplayName,
};
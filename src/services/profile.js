const AppError = require('../utils/AppError');
const membersDb = require('../db/members');
const usersDb = require('../db/users');
const { assertFullName, assertPhone } = require('../utils/personFields');

async function getMemberProfile(userId) {
  const profile = await membersDb.findMemberWithUserByUserId(userId);
  if (!profile) {
    throw new AppError(404, 'PROFILE_NOT_FOUND', 'Member profile not found.');
  }
  return profile;
}

async function updateMemberProfile(userId, { fullName, phone, email }) {
  const profile = await getMemberProfile(userId);
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (normalizedEmail !== profile.email) {
    const existing = await usersDb.findUserByEmail(normalizedEmail);
    if (existing && existing.id !== userId) {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
    }
    await usersDb.updateEmail(userId, normalizedEmail);
  }

  await membersDb.updateMemberProfile(userId, {
    fullName: assertFullName(fullName),
    phone: assertPhone(phone),
  });

  return getMemberProfile(userId);
}

module.exports = {
  getMemberProfile,
  updateMemberProfile,
};

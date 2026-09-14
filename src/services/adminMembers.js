const AppError = require('../utils/AppError');
const membersDb = require('../db/members');
const { log } = require('../utils/logger');

async function listMembers() {
  return membersDb.listMembersForAdmin();
}

async function removeMember(id) {
  const removed = await membersDb.deleteMember(id);
  if (!removed) {
    throw new AppError(404, 'NOT_FOUND', 'Member not found.');
  }
  log('Member removed', id);
}

module.exports = {
  listMembers,
  removeMember,
};

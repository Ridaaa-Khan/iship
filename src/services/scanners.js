const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const scannersDb = require('../db/scanners');
const usersDb = require('../db/users');
const { log } = require('../utils/logger');

const BCRYPT_ROUNDS = 12;

function cleanGate(value) {
  const text = String(value || '').trim();
  return text ? text.slice(0, 50) : null;
}

async function listScanners() {
  return scannersDb.listScanners();
}

async function createScanner({ email, password, scannerName, gateNumber }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const name = String(scannerName || '').trim();
  if (!normalizedEmail) {
    throw new AppError(400, 'INVALID_EMAIL', 'Enter a valid email.');
  }
  if (!password || String(password).length < 3) {
    throw new AppError(400, 'INVALID_PASSWORD', 'Password must be at least 3 characters.');
  }
  if (name.length < 2 || name.length > 150) {
    throw new AppError(400, 'INVALID_NAME', 'Scanner name must be between 2 and 150 characters.');
  }

  const existing = await usersDb.findUserByEmail(normalizedEmail);
  if (existing) {
    throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
  const id = await scannersDb.createScanner({
    email: normalizedEmail,
    passwordHash,
    scannerName: name,
    gateNumber: cleanGate(gateNumber),
  });
  log('Scanner created', id, normalizedEmail);
  return id;
}

async function removeScanner(id) {
  const removed = await scannersDb.deleteScanner(id);
  if (!removed) {
    throw new AppError(404, 'NOT_FOUND', 'Scanner not found.');
  }
  log('Scanner removed', id);
}

module.exports = {
  listScanners,
  createScanner,
  removeScanner,
};

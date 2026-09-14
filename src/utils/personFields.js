const AppError = require('./AppError');

const NAME_PATTERN = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
const PHONE_PATTERN = /^\d{10}$/;

function normalizeFullName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizePhone(value) {
  return String(value || '').trim();
}

function isValidFullName(value) {
  const name = normalizeFullName(value);
  if (name.length < 3) return false;
  if (!NAME_PATTERN.test(name)) return false;
  return name.replace(/ /g, '').length >= 3;
}

function isValidPhone(value) {
  const phone = normalizePhone(value);
  if (!phone) return true;
  return PHONE_PATTERN.test(phone);
}

function assertFullName(value) {
  const name = normalizeFullName(value);
  if (!isValidFullName(name)) {
    throw new AppError(
      400,
      'INVALID_NAME',
      'Full name must be at least 3 letters and contain only alphabets.'
    );
  }
  return name;
}

function assertPhone(value) {
  const phone = normalizePhone(value);
  if (!isValidPhone(phone)) {
    throw new AppError(
      400,
      'INVALID_PHONE',
      'Phone number must be exactly 10 digits.'
    );
  }
  return phone || null;
}

module.exports = {
  NAME_PATTERN,
  PHONE_PATTERN,
  normalizeFullName,
  normalizePhone,
  isValidFullName,
  isValidPhone,
  assertFullName,
  assertPhone,
};

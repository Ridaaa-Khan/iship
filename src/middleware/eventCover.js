const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const AppError = require('../utils/AppError');
const { logError } = require('../utils/logger');

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'events');

function ensureUploadDir() {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    ensureUploadDir();
    cb(null, uploadDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`);
  },
});

function fileFilter(_req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.mimetype)) {
    cb(new AppError(400, 'INVALID_IMAGE', 'Please upload a JPG, PNG, WEBP, or GIF image.'));
    return;
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 },
});

function uploadEventCover(req, res, next) {
  upload.single('coverImage')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      req.coverUploadError = 'Image must be 3MB or smaller.';
      return next();
    }
    req.coverUploadError = err.message || 'Could not upload that image.';
    return next();
  });
}

function deleteCoverFile(filename) {
  if (!filename) return;
  const fullPath = path.join(uploadDir, path.basename(filename));
  fs.unlink(fullPath, (err) => {
    if (err && err.code !== 'ENOENT') {
      logError('Could not delete event cover', err.message);
    }
  });
}

function coverUrl(filename) {
  if (!filename) return null;
  return `/uploads/events/${path.basename(filename)}`;
}

module.exports = {
  uploadEventCover,
  deleteCoverFile,
  coverUrl,
  ensureUploadDir,
};

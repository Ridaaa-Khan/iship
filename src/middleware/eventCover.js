
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const AppError = require('../utils/AppError');
const { logError } = require('../utils/logger');

const storage = multer.memoryStorage();

function fileFilter(_req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  if (!allowed.includes(file.mimetype)) {
    return cb(
      new AppError(
        400,
        'INVALID_IMAGE',
        'Please upload a JPG, PNG, WEBP, or GIF image.'
      )
    );
  }

  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 },
});

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'iship/event-covers',
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

function uploadEventCover(req, res, next) {
  upload.single('coverImage')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        req.coverUploadError = 'Image must be 3MB or smaller.';
      } else {
        req.coverUploadError = err.message || 'Could not upload that image.';
      }
      return next();
    }

    if (!req.file) return next();

    try {
      const result = await uploadToCloudinary(req.file.buffer);

      req.file.filename = result.secure_url;
      req.file.public_id = result.public_id;

      next();
    } catch (uploadError) {
      logError('Cloudinary upload failed', uploadError.message);
      req.coverUploadError = 'Could not upload image. Please try again.';
      next();
    }
  });
}

function deleteCoverFile(publicId) {
  if (!publicId) return;

  cloudinary.uploader.destroy(publicId, { resource_type: 'image' })
    .catch((err) => {
      logError('Could not delete Cloudinary event cover', err.message);
    });
}

function coverUrl(image) {
  if (!image) return null;

  if (/^https?:\/\//i.test(image)) {
    return image;
  }

  // Support legacy images that are still stored locally.
  return `/uploads/events/${encodeURIComponent(image)}`;
}

function ensureUploadDir() {
  // No local upload directory is needed with Cloudinary.
}

module.exports = {
  uploadEventCover,
  deleteCoverFile,
  coverUrl,
  ensureUploadDir,
};

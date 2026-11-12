const multer = require('multer');
const path = require('path');

// Use memory storage to handle buffer for S3 or local filesystem writing
const storage = multer.memoryStorage();

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (ALLOWED_MIME_TYPES.includes(file.mimetype) && ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    const error = new Error('Please upload a valid image file (JPEG, PNG, or WEBP)');
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter,
});

/**
 * Middleware wrapper for single driver license file upload
 * Handles multer errors cleanly within the course response envelope: { success: false, message }
 */
const uploadDriverLicenseImage = (req, res, next) => {
  const singleUpload = upload.single('license');

  singleUpload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size exceeds maximum allowed limit of 2MB',
        });
      }

      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }

      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed',
      });
    }

    next();
  });
};

module.exports = {
  upload,
  uploadDriverLicenseImage,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
};

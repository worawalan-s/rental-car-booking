const express = require('express');
const {
  register,
  login,
  logout,
  getMe,
  uploadDriverLicense,
} = require('../controllers/auth');
const { protect } = require('../middleware/auth');
const { sanitizeAuthBody } = require('../middleware/validate');
const { uploadDriverLicenseImage } = require('../middleware/upload');

const router = express.Router();

router.post('/register', sanitizeAuthBody, register);
router.post('/login', sanitizeAuthBody, login);
router.route('/logout').get(logout).post(logout);
router.get('/me', protect, getMe);
router.put('/driver-license', protect, uploadDriverLicenseImage, uploadDriverLicense);

module.exports = router;

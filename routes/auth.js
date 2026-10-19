const express = require('express');
const { register, login, logout, getMe } = require('../controllers/auth');
const { protect } = require('../middleware/auth');
const { sanitizeAuthBody } = require('../middleware/validate');

const router = express.Router();

router.post('/register', sanitizeAuthBody, register);
router.post('/login', sanitizeAuthBody, login);
router.post('/logout', logout);
router.get('/me', protect, getMe);

module.exports = router;

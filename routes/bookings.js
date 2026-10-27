const express = require('express');
const { createBooking } = require('../controllers/bookings');

const { protect, authorize } = require('../middleware/auth');
const { validateBookingPayload } = require('../middleware/validate');

const router = express.Router();

router
  .route('/')
  .post(protect, authorize('user', 'admin'), validateBookingPayload, createBooking);

module.exports = router;

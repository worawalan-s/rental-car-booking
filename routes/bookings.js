const express = require('express');
const {
  createBooking,
  getBooking,
  getBookings,
  updateBooking,
  deleteBooking,
} = require('../controllers/bookings');

const { protect, authorize } = require('../middleware/auth');
const {
  validateBookingPayload,
  validateBookingUpdateDates,
} = require('../middleware/validate');

const router = express.Router({ mergeParams: true });

router
  .route('/')
  .get(protect, authorize('admin', 'user'), getBookings)
  .post(protect, authorize('user'), validateBookingPayload, createBooking);

router
  .route('/:id')
  .get(protect, authorize('admin', 'user'), getBooking)
  .put(
    protect,
    authorize('admin', 'user'),
    validateBookingUpdateDates,
    updateBooking
  )
  .delete(protect, authorize('admin', 'user'), deleteBooking);

module.exports = router;


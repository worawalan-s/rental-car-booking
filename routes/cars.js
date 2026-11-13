const express = require('express');
const {
  getCars,
  getCar,
  createCar,
  updateCar,
  deleteCar,
  searchCars,
} = require('../controllers/cars');

const bookingRouter = require('./bookings');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use('/:carId/bookings', bookingRouter);

router
  .route('/')
  .get(getCars)
  .post(protect, authorize('admin'), createCar);

router.route('/search').get(searchCars);

router
  .route('/:id')
  .get(getCar)
  .put(protect, authorize('admin'), updateCar)
  .delete(protect, authorize('admin'), deleteCar);

module.exports = router;

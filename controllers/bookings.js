const Booking = require('../models/Booking');
const Car = require('../models/Car');
const { calculateDurationDays } = require('../utils/date');
const { calculateBaselinePrice } = require('../utils/pricingCalculator');

/**
 * @desc    Create new booking
 * @route   POST /api/v1/bookings
 * @access  Private (User)
 */
exports.createBooking = async (req, res, next) => {
  try {
    // 1. Validate car existence and rental availability (car presence verified by middleware)
    const car = await Car.findById(req.body.car);
    if (!car) {
      return res.status(404).json({
        success: false,
        message: `No car found with the id of ${req.body.car}`,
      });
    }

    if (!car.isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Car is not available for rental',
      });
    }

    // 2. Auto-derive provider from verified car to guarantee data consistency
    req.body.provider = car.provider;

    // 3. Resolve user ownership: standard users are strictly bound to their own JWT user ID
    req.body.user = req.user.id;

    // 4. Enforce 3-car quota limit across active reservations (sum of numOfCars)
    const activeBookings = await Booking.find({
      user: req.user.id,
      status: { $in: ['Pending', 'Confirmed', 'Active'] },
    });

    const activeCarsSum = activeBookings.reduce(
      (total, b) => total + (b.numOfCars || 1),
      0
    );
    const requestedCars = req.body.numOfCars || 1;

    if (activeCarsSum + requestedCars > 3) {
      return res.status(400).json({
        success: false,
        message: `User with ID ${req.user.id} has already reached the maximum quota of 3 cars`,
      });
    }

    // 5. Explicit status enforcement: newly created user bookings are strictly 'Pending'
    req.body.status = 'Pending';

    // 6. Calculate Baseline totalPrice in Satang ((dailyRate * durationDays * numOfCars) + addOnsTotal)
    const durationDays = req.durationDays || calculateDurationDays(req.body.startDate, req.body.endDate);
    const numOfCars = req.body.numOfCars || 1;
    req.body.totalPrice = calculateBaselinePrice({
      dailyRate: car.dailyRate,
      durationDays,
      numOfCars,
      addOns: req.body.addOns,
    });

    // 7. Create booking document
    const booking = await Booking.create(req.body);

    res.status(201).json({
      success: true,
      data: booking,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((val) => val.message).join(', ');
      return res.status(400).json({
        success: false,
        message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Cannot create Booking',
    });
  }
};

/**
 * @desc    Get all bookings
 * @route   GET /api/v1/bookings
 * @access  Private (User & Admin)
 */
exports.getBookings = async (req, res, next) => {
  let query;

  // General users can only view their own bookings; Admins can view all bookings
  if (req.user.role !== 'admin') {
    query = Booking.find({ user: req.user.id })
      .populate({
        path: 'car',
        select: 'brand model category dailyRate isAvailable provider',
      })
      .populate({
        path: 'provider',
        select: 'name address tel',
      });
  } else {
    query = Booking.find()
      .populate({
        path: 'car',
        select: 'brand model category dailyRate isAvailable provider',
      })
      .populate({
        path: 'provider',
        select: 'name address tel',
      })
      .populate({
        path: 'user',
        select: 'name email tel role',
      });
  }

  try {
    const bookings = await query;

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Cannot find Booking',
    });
  }
};

/**
 * @desc    Get single booking
 * @route   GET /api/v1/bookings/:id
 * @access  Private (User & Admin)
 */
exports.getBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate({
        path: 'car',
        select: 'brand model category dailyRate isAvailable provider',
      })
      .populate({
        path: 'provider',
        select: 'name address tel',
      });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: `No booking found with id of ${req.params.id}`,
      });
    }

    // Make sure user is booking owner or admin
    if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to view this booking`,
      });
    }

    res.status(200).json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Cannot find Booking' });
  }
};

/**
 * @desc    Update single booking
 * @route   PUT /api/v1/bookings/:id
 * @access  Private (User & Admin)
 */
exports.updateBooking = async (req, res, next) => {
  try {
    let booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: `No booking found with id of ${req.params.id}`,
      });
    }

    // Make sure user is booking owner or admin
    if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to update this booking`,
      });
    }

    // Prevent regular user from changing ownership or status
    if (req.user.role !== 'admin') {
      delete req.body.user;
      delete req.body.status;
    }

    // If numOfCars is being updated by a regular user, verify 3-car quota
    if (req.user.role !== 'admin' && req.body.numOfCars !== undefined) {
      const activeBookings = await Booking.find({
        user: req.user.id,
        _id: { $ne: req.params.id },
        status: { $in: ['Pending', 'Confirmed', 'Active'] },
      });

      const activeCarsSum = activeBookings.reduce(
        (total, b) => total + (b.numOfCars || 1),
        0
      );

      if (activeCarsSum + req.body.numOfCars > 3) {
        return res.status(400).json({
          success: false,
          message: `User with ID ${req.user.id} has already reached the maximum quota of 3 cars`,
        });
      }
    }

    // If dates, car, numOfCars, or addOns change, validate and recalculate totalPrice
    if (
      req.body.startDate ||
      req.body.endDate ||
      req.body.car ||
      req.body.numOfCars ||
      req.body.addOns
    ) {
      const startDate = req.body.startDate || booking.startDate;
      const endDate = req.body.endDate || booking.endDate;

      if (new Date(endDate) < new Date(startDate)) {
        return res.status(400).json({
          success: false,
          message: 'Rental return date cannot be before start date',
        });
      }

      const carId = req.body.car || booking.car;
      const car = await Car.findById(carId);
      if (!car) {
        return res.status(404).json({
          success: false,
          message: `No car found with the id of ${carId}`,
        });
      }

      const durationDays = calculateDurationDays(startDate, endDate);
      const numOfCars =
        req.body.numOfCars !== undefined
          ? req.body.numOfCars
          : booking.numOfCars || 1;
      const addOns =
        req.body.addOns !== undefined ? req.body.addOns : booking.addOns;

      req.body.totalPrice = calculateBaselinePrice({
        dailyRate: car.dailyRate,
        durationDays,
        numOfCars,
        addOns,
      });
    }

    booking = await Booking.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ success: true, data: booking });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors)
        .map((val) => val.message)
        .join(', ');
      return res.status(400).json({
        success: false,
        message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Cannot update Booking',
    });
  }
};

/**
 * @desc    Delete single booking
 * @route   DELETE /api/v1/bookings/:id
 * @access  Private (User & Admin)
 */
exports.deleteBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: `No booking found with id of ${req.params.id}`,
      });
    }

    // Make sure user is booking owner or admin
    if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to delete this booking`,
      });
    }

    await booking.deleteOne();

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Cannot delete Booking',
    });
  }
};

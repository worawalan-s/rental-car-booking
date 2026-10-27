const Booking = require('../models/Booking');
const Car = require('../models/Car');
const { calculateDurationDays } = require('../utils/date');
const { calculateBaselinePrice } = require('../utils/pricingCalculator');

/**
 * @desc    Create new booking
 * @route   POST /api/v1/bookings
 * @access  Private (User and Admin)
 */
exports.createBooking = async (req, res) => {
  try {
    // 1. Validate car ID presence
    if (!req.body.car) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a car ID',
      });
    }

    // 2. Validate car existence and rental availability
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

    // 3. Auto-derive provider from verified car to guarantee data consistency
    req.body.provider = car.provider;

    // 4. Resolve user ownership: standard users are strictly bound to their own JWT user ID
    if (req.user.role !== 'admin') {
      req.body.user = req.user.id;
    } else if (!req.body.user) {
      req.body.user = req.user.id;
    }

    // 5. Enforce 3-car quota limit across active reservations (sum of numOfCars)
    if (req.user.role !== 'admin') {
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
    }

    // 6. Explicit status enforcement: default to 'Pending'; only admin can initialize as 'Confirmed'
    let bookingStatus = 'Pending';
    if (req.body.status && ['Pending', 'Confirmed'].includes(req.body.status)) {
      if (req.user.role === 'admin' || req.body.status === 'Pending') {
        bookingStatus = req.body.status;
      }
    }
    req.body.status = bookingStatus;

    // 7. Calculate Baseline totalPrice in Satang ((dailyRate * durationDays * numOfCars) + addOnsTotal)
    const durationDays = calculateDurationDays(req.body.startDate, req.body.endDate);
    const numOfCars = req.body.numOfCars || 1;
    req.body.totalPrice = calculateBaselinePrice({
      dailyRate: car.dailyRate,
      durationDays,
      numOfCars,
      addOns: req.body.addOns,
    });

    // 8. Create booking document
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

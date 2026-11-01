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

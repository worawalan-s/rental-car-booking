const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Car = require('../models/Car');
const AddOn = require('../models/AddOn');
const { calculateDurationDays } = require('../utils/date');
const { calculateBaselinePrice } = require('../utils/pricingCalculator');
const { calculateActiveCars } = require('../utils/quota');
const { releaseBookingAddOns } = require('../utils/bookingInventory');

/**
 * @desc    Create new booking with atomic add-on pessimistic locking & ACID transaction
 * @route   POST /api/v1/bookings
 * @access  Private (User)
 */
exports.createBooking = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // 1. Validate car existence and rental availability (car presence verified by middleware)
    const car = await Car.findById(req.body.car).session(session);
    if (!car) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: `No car found with the id of ${req.body.car}`,
      });
    }

    if (!car.isAvailable) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Car is not available for rental',
      });
    }

    // 2. Schedule collision prevention (AGENTS.md Invariant 5) within session
    const collision = await Booking.findOne({
      car: car._id,
      status: { $in: ['Pending', 'Confirmed', 'Active'] },
      startDate: { $lt: req.body.endDate },
      endDate: { $gt: req.body.startDate },
    }).session(session);

    if (collision) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Car is already reserved for the selected dates',
      });
    }

    // 3. Auto-derive provider from verified car to guarantee data consistency
    req.body.provider = car.provider;

    // 4. Resolve user ownership: standard users are strictly bound to their own JWT user ID
    req.body.user = req.user.id;

    // 5. Enforce 3-car quota limit across active reservations (sum of numOfCars) within session
    const activeBookings = await Booking.find({
      user: req.user.id,
      status: { $in: ['Pending', 'Confirmed', 'Active'] },
    }).session(session);

    const activeCarsSum = calculateActiveCars(activeBookings);
    const requestedCars = req.body.numOfCars || 1;

    if (activeCarsSum + requestedCars > 3) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `User with ID ${req.user.id} has already reached the maximum quota of 3 cars`,
      });
    }

    // 6. Atomic Add-on Pessimistic Reservation with Compare-and-Swap (CAS)
    const lockedAddOns = [];
    if (Array.isArray(req.body.addOns) && req.body.addOns.length > 0) {
      for (const item of req.body.addOns) {
        const qty = item.quantity || 1;

        // Atomic check-and-decrement: only decrements availableStock if availableStock >= qty AND provider matches car.provider
        const reservedAddOn = await AddOn.findOneAndUpdate(
          {
            _id: item.addOn,
            provider: car.provider,
            isAvailable: true,
            availableStock: { $gte: qty },
          },
          {
            $inc: {
              allocatedStock: qty,
              availableStock: -qty,
            },
          },
          {
            new: true,
            session,
            runValidators: true,
          }
        );

        if (!reservedAddOn) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Insufficient inventory stock for add-on: ${item.addOn}`,
          });
        }

        lockedAddOns.push({
          addOn: reservedAddOn._id,
          quantity: qty,
          price: reservedAddOn.dailyRate, // Authoritative rate from DB
        });
      }
    }
    req.body.addOns = lockedAddOns;

    // 7. Explicit status enforcement: newly created user bookings are strictly 'Pending'
    req.body.status = 'Pending';

    // 8. Calculate Baseline totalPrice in Satang ((dailyRate * durationDays * numOfCars) + addOnsTotal)
    const durationDays =
      req.durationDays ||
      calculateDurationDays(req.body.startDate, req.body.endDate);
    const numOfCars = req.body.numOfCars || 1;
    req.body.totalPrice = calculateBaselinePrice({
      dailyRate: car.dailyRate,
      durationDays,
      numOfCars,
      addOns: req.body.addOns,
    });

    // 9. Create booking document within the ACID session
    const [booking] = await Booking.create([req.body], { session });

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      data: booking,
    });
  } catch (err) {
    await session.abortTransaction();

    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors)
        .map((val) => val.message)
        .join(', ');
      return res.status(400).json({
        success: false,
        message,
      });
    }

    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Resource not found with id of ${err.value}`,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Cannot create Booking',
    });
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Get all bookings
 * @route   GET /api/v1/bookings
 * @access  Private (User & Admin)
 */
exports.getBookings = async (req, res, next) => {
  let query;

  // Filter by status if provided in query (Issue #20)
  const filter = {};
  if (req.query.status) {
    filter.status = req.query.status;
  }

  // General users can only view their own bookings; Admins can view all bookings
  if (req.user.role !== 'admin') {
    query = Booking.find({ user: req.user.id, ...filter })
      .populate({
        path: 'car',
        select: 'brand model category dailyRate isAvailable provider',
      })
      .populate({
        path: 'provider',
        select: 'name address tel',
      })
      .populate({
        path: 'addOns.addOn',
        select: 'name category dailyRate',
      });
  } else {
    query = Booking.find(filter)
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
      })
      .populate({
        path: 'addOns.addOn',
        select: 'name category dailyRate',
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
      })
      .populate({
        path: 'addOns.addOn',
        select: 'name category dailyRate',
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
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    let booking = await Booking.findById(req.params.id).session(session);

    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: `No booking found with id of ${req.params.id}`,
      });
    }

    // Make sure user is booking owner or admin
    if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
      await session.abortTransaction();
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to update this booking`,
      });
    }

    // 1. Critical Security: Never allow clients to inject totalPrice directly
    delete req.body.totalPrice;

    // 2. Disallow changing vehicle/provider in-place to prevent provider desynchronization (Issue #19)
    delete req.body.car;
    delete req.body.provider;

    // 3. Reject modification of add-ons on existing bookings (Adv Req 4 immutability)
    if (req.body.addOns !== undefined) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Add-ons cannot be modified on existing bookings',
      });
    }

    // 4. Prevent regular user from changing ownership or status
    if (req.user.role !== 'admin') {
      delete req.body.user;
      delete req.body.status;
    }

    // 4. Validate numOfCars format and enforce 3-car quota using quota helper
    if (req.body.numOfCars !== undefined) {
      if (
        !Number.isInteger(req.body.numOfCars) ||
        req.body.numOfCars < 1 ||
        req.body.numOfCars > 3
      ) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Number of cars must be an integer between 1 and 3',
        });
      }
    }

    if (req.user.role !== 'admin' && req.body.numOfCars !== undefined) {
      const activeBookings = await Booking.find({
        user: req.user.id,
        _id: { $ne: req.params.id },
        status: { $in: ['Pending', 'Confirmed', 'Active'] },
      }).session(session);

      const activeCarsSum = calculateActiveCars(activeBookings);

      if (activeCarsSum + req.body.numOfCars > 3) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `User with ID ${req.user.id} has already reached the maximum quota of 3 cars`,
        });
      }
    }

    // 5. Date validation and schedule collision prevention
    const startDate = req.body.startDate || booking.startDate;
    const endDate = req.body.endDate || booking.endDate;

    if (new Date(endDate) < new Date(startDate)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Rental return date cannot be before start date',
      });
    }

    const durationDays = calculateDurationDays(startDate, endDate);
    if (durationDays > 30) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Rental duration cannot exceed 30 days per booking',
      });
    }

    // If dates are modified, enforce Schedule Collision Prevention (AGENTS.md Invariant 5)
    if (req.body.startDate || req.body.endDate) {
      const collision = await Booking.findOne({
        car: booking.car,
        _id: { $ne: booking._id },
        status: { $in: ['Pending', 'Confirmed', 'Active'] },
        startDate: { $lt: endDate },
        endDate: { $gt: startDate },
      }).session(session);

      if (collision) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Car is already reserved for the selected dates',
        });
      }
    }

    // 6. Handle booking cancellation: release allocated add-on stock
    if (
      req.body.status === 'Cancelled' &&
      ['Pending', 'Confirmed', 'Active'].includes(booking.status)
    ) {
      await releaseBookingAddOns(booking, session);
    }

    // 7. Recalculate totalPrice if dates or numOfCars change
    if (
      req.body.startDate ||
      req.body.endDate ||
      req.body.numOfCars !== undefined
    ) {
      const car = await Car.findById(booking.car).session(session);
      if (!car) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: `No car found with the id of ${booking.car}`,
        });
      }

      const numOfCars =
        req.body.numOfCars !== undefined
          ? req.body.numOfCars
          : booking.numOfCars || 1;

      req.body.totalPrice = calculateBaselinePrice({
        dailyRate: car.dailyRate,
        durationDays,
        numOfCars,
        addOns: booking.addOns,
      });
    }

    booking = await Booking.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      session,
      runValidators: true,
    });

    await session.commitTransaction();

    res.status(200).json({ success: true, data: booking });
  } catch (err) {
    await session.abortTransaction();
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors)
        .map((val) => val.message)
        .join(', ');
      return res.status(400).json({
        success: false,
        message,
      });
    }

    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Resource not found with id of ${err.value}`,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Cannot update Booking',
    });
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Delete single booking
 * @route   DELETE /api/v1/bookings/:id
 * @access  Private (User & Admin)
 */
exports.deleteBooking = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const booking = await Booking.findById(req.params.id).session(session);

    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: `No booking found with id of ${req.params.id}`,
      });
    }

    // Make sure user is booking owner or admin
    if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
      await session.abortTransaction();
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to delete this booking`,
      });
    }

    // Release allocated stock for physical add-ons inside transaction
    await releaseBookingAddOns(booking, session);

    await booking.deleteOne({ session });

    await session.commitTransaction();

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    await session.abortTransaction();
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Resource not found with id of ${err.value}`,
      });
    }
    res.status(500).json({
      success: false,
      message: 'Cannot delete Booking',
    });
  } finally {
    session.endSession();
  }
};

const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Car = require('../models/Car');
const AddOn = require('../models/AddOn');
const { calculateDurationDays } = require('../utils/date');
const { calculateBaselinePrice } = require('../utils/pricingCalculator');
const { calculateActiveCars, isQuotaExceeded } = require('../utils/quota');
const { releaseBookingAddOns } = require('../utils/bookingInventory');
const {
  isTerminalStatus,
  isActiveStatus,
  validateStatusTransition,
  resolveWebhookTargetStatus,
  evaluateTimelineTransition,
} = require('../utils/bookingStateMachine');
const messageBroker = require('../config/messageBroker');

/**
 * Standardizes Mongoose ValidationError, CastError, and 500 error responses for booking endpoints
 * without leaking internal database error strings or stack traces.
 */
const handleBookingError = (res, err, fallbackMessage = 'Booking request failed') => {
  if (err.name === 'ValidationError' && err.errors) {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
    return res.status(400).json({ success: false, message });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Resource not found with id of ${err.value}`,
    });
  }
  return res.status(500).json({ success: false, message: fallbackMessage });
};

/**
 * Checks whether a booking belongs to req.params.carId if accessed via nested route.
 */
const bookingMatchesCarParam = (req, booking) => {
  if (!req.params || !req.params.carId) return true;
  if (!booking || !booking.car) return false;
  const bookingCarId = booking.car._id
    ? booking.car._id.toString()
    : booking.car.toString();
  return bookingCarId === req.params.carId;
};

/**
 * Checks if a vehicle has an overlapping active reservation (AGENTS.md Invariant 5).
 * Leverages the compound index { car: 1, startDate: 1, endDate: 1 } for high-performance lookup.
 * Formula: Existing startDate < newEndDate AND Existing endDate > newStartDate
 *
 * @param {Object} params
 * @param {ObjectId|string} params.carId - The vehicle ID
 * @param {Date|string} params.startDate - Rental start date
 * @param {Date|string} params.endDate - Rental return date
 * @param {ObjectId|string} [params.excludeBookingId] - Optional booking ID to exclude (for updates)
 * @param {import('mongoose').ClientSession} [params.session] - Optional Mongoose transaction session
 * @returns {Promise<boolean>} True if an active collision exists
 */
const checkBookingCollision = async ({
  carId,
  startDate,
  endDate,
  excludeBookingId = null,
  session = null,
}) => {
  const query = {
    car: carId,
    status: { $in: ['Pending', 'Confirmed', 'Active'] },
    startDate: { $lt: new Date(endDate) },
    endDate: { $gt: new Date(startDate) },
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const queryBuilder = Booking.findOne(query);
  if (session) {
    queryBuilder.session(session);
  }

  const existingBooking = await queryBuilder;
  return Boolean(existingBooking);
};

/**
 * Safely initializes a Mongoose transaction session if supported by the deployment topology
 * (ReplicaSet or Sharded Cluster, like MongoDB Atlas). On standalone local instances (Single),
 * returns null so operations succeed without error code 20 IllegalOperation.
 */
const createSafeSession = async () => {
  try {
    const topologyType =
      mongoose.connection?.client?.topology?.description?.type;
    if (topologyType === 'Single') {
      return null;
    }
    const session = await mongoose.startSession();
    if (session && typeof session.startTransaction === 'function') {
      session.startTransaction();
    }
    return session;
  } catch (err) {
    return null;
  }
};

const safeAbort = async (session) => {
  if (session && typeof session.abortTransaction === 'function') {
    try {
      if (
        typeof session.inTransaction === 'function'
          ? session.inTransaction()
          : true
      ) {
        await session.abortTransaction();
      }
    } catch (_) {}
  }
};

const safeCommit = async (session) => {
  if (session && typeof session.commitTransaction === 'function') {
    try {
      if (
        typeof session.inTransaction === 'function'
          ? session.inTransaction()
          : true
      ) {
        await session.commitTransaction();
      }
    } catch (_) {}
  }
};

const safeEnd = (session) => {
  if (session && typeof session.endSession === 'function') {
    try {
      session.endSession();
    } catch (_) {}
  }
};

/**
 * @desc    Create new booking with atomic add-on pessimistic locking & ACID transaction
 * @route   POST /api/v1/bookings
 * @access  Private (User)
 */
exports.createBooking = async (req, res, next) => {
  const session = await createSafeSession();

  try {
    // Validate requested cars payload strictly (integer 1-3)
    const requestedCars =
      req.body.numOfCars !== undefined ? req.body.numOfCars : 1;
    if (
      typeof requestedCars !== 'number' ||
      !Number.isInteger(requestedCars) ||
      requestedCars < 1 ||
      requestedCars > 3
    ) {
      await safeAbort(session);
      return res.status(400).json({
        success: false,
        message: 'Number of cars must be an integer between 1 and 3',
      });
    }

    // 1. Validate car existence and rental availability (car presence verified by middleware)
    const targetCarId =
      (req.body && req.body.car) || (req.params && req.params.carId);
    const car = await Car.findById(targetCarId).session(session);
    if (!car) {
      await safeAbort(session);
      return res.status(404).json({
        success: false,
        message: `No car found with the id of ${targetCarId}`,
      });
    }

    if (!car.isAvailable) {
      await safeAbort(session);
      return res.status(400).json({
        success: false,
        message: 'Car is not available for rental',
      });
    }

    // 2. Schedule collision prevention using compound index { car: 1, startDate: 1, endDate: 1 }
    const collision = await checkBookingCollision({
      carId: car._id,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      session,
    });

    if (collision) {
      await safeAbort(session);
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
    if (req.user.role !== 'admin') {
      const activeBookings = await Booking.find({
        user: req.user.id,
        status: { $in: ['Pending', 'Confirmed', 'Active'] },
      }).session(session);

      const activeCarsSum = calculateActiveCars(activeBookings);

      if (isQuotaExceeded(activeCarsSum, requestedCars)) {
        await safeAbort(session);
        return res.status(400).json({
          success: false,
          message: `User with ID ${req.user.id} has already reached the maximum quota of 3 cars`,
        });
      }
    }

    // 6. Atomic Add-on Pessimistic Reservation with Compare-and-Swap (CAS)
    const lockedAddOns = [];
    if (Array.isArray(req.body.addOns) && req.body.addOns.length > 0) {
      for (const item of req.body.addOns) {
        const qty = item.quantity || 1;

        const updateOptions = session
          ? { returnDocument: 'after', session, runValidators: true }
          : { returnDocument: 'after', runValidators: true };

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
          updateOptions
        );

        if (!reservedAddOn) {
          await safeAbort(session);
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

    // 9. Create booking document within the ACID session (or standalone fallback)
    const createOptions = session ? { session } : {};
    const [booking] = await Booking.create([req.body], createOptions);

    await safeCommit(session);

    // 10. Publish domain event (booking:pending) to message broker within 50ms SLA
    await messageBroker.publishBookingEvent({
      bookingId: booking._id,
      previousStatus: null,
      newStatus: booking.status,
      triggeredBy: 'user',
    });

    res.status(201).json({
      success: true,
      data: booking,
    });
  } catch (err) {
    await safeAbort(session);
    return handleBookingError(res, err, 'Cannot create Booking');
  } finally {
    safeEnd(session);
  }
};

/**
 * @desc    Get all bookings
 * @route   GET /api/v1/bookings
 * @access  Private (User & Admin)
 */
exports.getBookings = async (req, res, next) => {
  let query;

  // Filter by status or nested carId if provided (Issue #15, #20)
  const filter = {};
  if (req.params && req.params.carId) {
    filter.car = req.params.carId;
  }
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
    return handleBookingError(res, err, 'Cannot find Booking');
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

    if (!booking || !bookingMatchesCarParam(req, booking)) {
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
    return handleBookingError(res, err, 'Cannot find Booking');
  }
};

/**
 * @desc    Update single booking
 * @route   PUT /api/v1/bookings/:id
 * @access  Private (User & Admin)
 */
exports.updateBooking = async (req, res, next) => {
  const session = await createSafeSession();
  try {
    let booking = await Booking.findById(req.params.id).session(session);

    if (!booking || !bookingMatchesCarParam(req, booking)) {
      await safeAbort(session);
      return res.status(404).json({
        success: false,
        message: `No booking found with id of ${req.params.id}`,
      });
    }

    // Make sure user is booking owner or admin
    if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
      await safeAbort(session);
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to update this booking`,
      });
    }

    // Optional idempotency key check on updateBooking to prevent duplicate concurrent updates
    const idempotencyKey =
      (req.headers &&
        (req.headers['x-idempotency-key'] || req.headers['idempotency-key'])) ||
      (req.body && req.body.idempotencyKey);
    delete req.body.idempotencyKey;

    if (
      idempotencyKey &&
      Array.isArray(booking.processedWebhookEvents) &&
      booking.processedWebhookEvents.includes(String(idempotencyKey))
    ) {
      await safeCommit(session);
      return res.status(200).json({
        success: true,
        idempotent: true,
        data: booking,
      });
    }

    // Terminal state guard: cannot modify booking if it is already in a terminal state (Issue #22)
    if (isTerminalStatus(booking.status)) {
      await safeAbort(session);
      return res.status(400).json({
        success: false,
        message: `Cannot modify booking with terminal status of '${booking.status}'`,
      });
    }

    const previousStatus = booking.status;

    // 1. Critical Security: Never allow clients to inject totalPrice directly
    delete req.body.totalPrice;

    // 2. Disallow changing vehicle/provider in-place to prevent provider desynchronization (Issue #19)
    delete req.body.car;
    delete req.body.provider;

    // 3. Reject modification of add-ons on existing bookings (Adv Req 4 immutability)
    if (req.body.addOns !== undefined) {
      await safeAbort(session);
      return res.status(400).json({
        success: false,
        message: 'Add-ons cannot be modified on existing bookings',
      });
    }

    // 4. Role-based restrictions & Status Transition Validation (State Machine - Issue #22)
    if (req.user.role !== 'admin') {
      delete req.body.user;

      // Regular user cannot change status to anything other than 'Cancelled'
      if (req.body.status !== undefined && req.body.status !== 'Cancelled') {
        await safeAbort(session);
        return res.status(403).json({
          success: false,
          message: 'Only admins can update booking status to values other than Cancelled',
        });
      }
    }

    if (req.body.status !== undefined) {
      const transition = validateStatusTransition(booking.status, req.body.status);
      if (!transition.isValid) {
        await safeAbort(session);
        return res.status(400).json({
          success: false,
          message: transition.error,
        });
      }
    }

    // 4. Validate numOfCars format and enforce 3-car quota using quota helper
    if (req.body.numOfCars !== undefined) {
      if (
        !Number.isInteger(req.body.numOfCars) ||
        req.body.numOfCars < 1 ||
        req.body.numOfCars > 3
      ) {
        await safeAbort(session);
        return res.status(400).json({
          success: false,
          message: 'Number of cars must be an integer between 1 and 3',
        });
      }

      // Admins managing/updating bookings on behalf of users are exempt from the 3-car quota (AGENTS.md §2.4)
      if (req.user.role !== 'admin') {
        const activeBookings = await Booking.find({
          user: booking.user,
          _id: { $ne: req.params.id },
          status: { $in: ['Pending', 'Confirmed', 'Active'] },
        }).session(session);

        const activeCarsSum = calculateActiveCars(activeBookings);

        if (isQuotaExceeded(activeCarsSum, req.body.numOfCars)) {
          await safeAbort(session);
          return res.status(400).json({
            success: false,
            message: `User with ID ${booking.user} has already reached the maximum quota of 3 cars`,
          });
        }
      }
    }

    // 5. Date validation and schedule collision prevention
    const startDate = req.body.startDate || booking.startDate;
    const endDate = req.body.endDate || booking.endDate;

    if (new Date(endDate) < new Date(startDate)) {
      await safeAbort(session);
      return res.status(400).json({
        success: false,
        message: 'Rental return date cannot be before start date',
      });
    }

    const durationDays = calculateDurationDays(startDate, endDate);
    if (durationDays > 30) {
      await safeAbort(session);
      return res.status(400).json({
        success: false,
        message: 'Rental duration cannot exceed 30 days per booking',
      });
    }

    // If dates are modified, enforce Schedule Collision Prevention using compound index { car: 1, startDate: 1, endDate: 1 }
    if (req.body.startDate || req.body.endDate) {
      const collision = await checkBookingCollision({
        carId: booking.car,
        startDate,
        endDate,
        excludeBookingId: booking._id,
        session,
      });

      if (collision) {
        await safeAbort(session);
        return res.status(400).json({
          success: false,
          message: 'Car is already reserved for the selected dates',
        });
      }
    }

    // 6. Handle booking terminal states: release allocated add-on stock and quota (Issue #22)
    if (
      req.body.status !== undefined &&
      isTerminalStatus(req.body.status) &&
      isActiveStatus(booking.status)
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
        await safeAbort(session);
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

    if (req.body.status && req.body.status !== previousStatus) {
      req.body.lastTransitionAt = new Date();
    }

    const updatePayload = idempotencyKey
      ? {
          ...req.body,
          $addToSet: { processedWebhookEvents: String(idempotencyKey) },
        }
      : req.body;

    const updateOptions = session
      ? { returnDocument: 'after', session, runValidators: true }
      : { returnDocument: 'after', runValidators: true };

    booking = await Booking.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      updateOptions
    );

    await safeCommit(session);

    if (booking && booking.status && booking.status !== previousStatus) {
      await messageBroker.publishBookingEvent({
        bookingId: booking._id || req.params.id,
        previousStatus,
        newStatus: booking.status,
        triggeredBy: req.user ? req.user.role : 'user',
      });
    }

    res.status(200).json({ success: true, data: booking });
  } catch (err) {
    await safeAbort(session);
    return handleBookingError(res, err, 'Cannot update Booking');
  } finally {
    safeEnd(session);
  }
};

/**
 * @desc    Delete single booking
 * @route   DELETE /api/v1/bookings/:id
 * @access  Private (User & Admin)
 */
exports.deleteBooking = async (req, res, next) => {
  const session = await createSafeSession();
  try {
    const booking = await Booking.findById(req.params.id).session(session);

    if (!booking || !bookingMatchesCarParam(req, booking)) {
      await safeAbort(session);
      return res.status(404).json({
        success: false,
        message: `No booking found with id of ${req.params.id}`,
      });
    }

    // Make sure user is booking owner or admin
    if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
      await safeAbort(session);
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to delete this booking`,
      });
    }

    // Release allocated stock for physical add-ons inside transaction
    await releaseBookingAddOns(booking, session);

    const deleteOptions = session ? { session } : {};
    await booking.deleteOne(deleteOptions);

    await safeCommit(session);

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    await safeAbort(session);
    return handleBookingError(res, err, 'Cannot delete Booking');
  } finally {
    safeEnd(session);
  }
};

/**
 * @desc    Handle payment gateway webhook with idempotent database execution & <50ms event publication
 * @route   POST /api/v1/bookings/webhook | POST /api/v1/payments/webhook
 * @access  Public (Webhook endpoint with optional signature verification)
 */
exports.handlePaymentWebhook = async (req, res, next) => {
  // Optional webhook signature guard when WEBHOOK_SECRET is configured
  if (process.env.WEBHOOK_SECRET) {
    const signature =
      req.headers && req.headers['x-webhook-signature'];
    if (signature !== process.env.WEBHOOK_SECRET) {
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature',
      });
    }
  }

  const rawEventId =
    (req.body && (req.body.eventId || req.body.id)) ||
    (req.headers &&
      (req.headers['x-idempotency-key'] || req.headers['idempotency-key']));
  const eventId =
    typeof rawEventId === 'string' ? rawEventId.trim() : '';

  if (!eventId) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid webhook eventId or X-Idempotency-Key',
    });
  }

  const eventType =
    req.body && (req.body.eventType || req.body.type || req.body.event);
  const webhookTarget = resolveWebhookTargetStatus(eventType);

  if (!webhookTarget.isValid) {
    return res.status(400).json({
      success: false,
      message: webhookTarget.error,
    });
  }

  const bookingId =
    req.body &&
    (req.body.bookingId ||
      (req.body.data && req.body.data.bookingId) ||
      req.body.booking);

  if (!bookingId || !mongoose.Types.ObjectId.isValid(String(bookingId))) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid bookingId',
    });
  }

  const session = await createSafeSession();
  try {
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) {
      await safeAbort(session);
      return res.status(404).json({
        success: false,
        message: `No booking found with id of ${bookingId}`,
      });
    }

    // 1. Idempotency check: if eventId was already processed, return 200 without duplicate side effects
    if (
      Array.isArray(booking.processedWebhookEvents) &&
      booking.processedWebhookEvents.includes(eventId)
    ) {
      await safeCommit(session);
      return res.status(200).json({
        success: true,
        idempotent: true,
        data: booking,
      });
    }

    // 2. Deterministic state machine validation (e.g. Pending -> Confirmed or Pending -> Cancelled)
    const previousStatus = booking.status;
    const transition = validateStatusTransition(
      previousStatus,
      webhookTarget.targetStatus
    );
    if (!transition.isValid) {
      await safeAbort(session);
      return res.status(400).json({
        success: false,
        message: transition.error,
      });
    }

    // 3. If webhook transitions to terminal status (e.g. payment.failed -> Cancelled), release add-ons
    if (
      isTerminalStatus(webhookTarget.targetStatus) &&
      isActiveStatus(previousStatus)
    ) {
      await releaseBookingAddOns(booking, session);
    }

    // 4. Atomic Compare-and-Swap update guarded by current status and eventId absence to prevent race conditions
    const updateOptions = session
      ? { returnDocument: 'after', session, runValidators: true }
      : { returnDocument: 'after', runValidators: true };

    const updatedBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        status: previousStatus,
        processedWebhookEvents: { $ne: eventId },
      },
      {
        $set: {
          status: webhookTarget.targetStatus,
          paymentStatus: webhookTarget.paymentStatus,
          lastTransitionAt: new Date(),
        },
        $addToSet: {
          processedWebhookEvents: eventId,
        },
      },
      updateOptions
    );

    if (!updatedBooking) {
      await safeAbort(session);
      const latestBooking = await Booking.findById(bookingId);
      if (
        latestBooking &&
        Array.isArray(latestBooking.processedWebhookEvents) &&
        latestBooking.processedWebhookEvents.includes(eventId)
      ) {
        return res.status(200).json({
          success: true,
          idempotent: true,
          data: latestBooking,
        });
      }
      return res.status(409).json({
        success: false,
        message: 'Concurrent booking state update conflict detected',
      });
    }

    await safeCommit(session);

    // 5. Publish domain event to Message Broker within 50ms SLA
    const publishResult = await messageBroker.publishBookingEvent({
      bookingId: updatedBooking._id,
      previousStatus,
      newStatus: updatedBooking.status,
      triggeredBy: 'payment_webhook',
      metadata: {
        webhookEventId: eventId,
        webhookEventType: eventType,
        paymentStatus: webhookTarget.paymentStatus,
      },
    });

    return res.status(200).json({
      success: true,
      idempotent: false,
      eventPublished: publishResult.event.eventType,
      publishLatencyMs: publishResult.latencyMs,
      data: updatedBooking,
    });
  } catch (err) {
    await safeAbort(session);
    return handleBookingError(res, err, 'Cannot process payment webhook');
  } finally {
    safeEnd(session);
  }
};

/**
 * @desc    Automatically progress booking statuses based on rental timelines (Confirmed -> Active, Active -> Completed)
 * @route   POST /api/v1/bookings/progress-timeline
 * @access  Private (Admin)
 */
exports.progressBookingsByTimeline = async (req, res, next) => {
  const rawRef =
    (req.body && req.body.referenceDate) ||
    (req.query && req.query.referenceDate);
  const referenceDate = rawRef ? new Date(rawRef) : new Date();

  if (Number.isNaN(referenceDate.getTime())) {
    return res.status(400).json({
      success: false,
      message: 'Invalid referenceDate format',
    });
  }

  const session = await createSafeSession();
  try {
    let queryBuilder = Booking.find({
      status: { $in: ['Confirmed', 'Active'] },
    });
    if (queryBuilder && typeof queryBuilder.session === 'function') {
      queryBuilder = queryBuilder.session(session);
    }

    const candidates = await queryBuilder;
    const transitions = [];
    let activatedCount = 0;
    let completedCount = 0;

    const updateOptions = session
      ? { returnDocument: 'after', session, runValidators: true }
      : { returnDocument: 'after', runValidators: true };

    for (const booking of candidates) {
      const evalResult = evaluateTimelineTransition(booking, referenceDate);
      if (!evalResult.shouldTransition || !evalResult.targetStatus) {
        continue;
      }

      const previousStatus = booking.status;
      const targetStatus = evalResult.targetStatus;

      if (isTerminalStatus(targetStatus) && isActiveStatus(previousStatus)) {
        await releaseBookingAddOns(booking, session);
      }

      const updated = await Booking.findOneAndUpdate(
        {
          _id: booking._id,
          status: previousStatus,
        },
        {
          $set: {
            status: targetStatus,
            lastTransitionAt: new Date(),
          },
        },
        updateOptions
      );

      if (updated) {
        if (targetStatus === 'Active') activatedCount += 1;
        if (targetStatus === 'Completed') completedCount += 1;

        const publishResult = await messageBroker.publishBookingEvent({
          bookingId: updated._id,
          previousStatus,
          newStatus: updated.status,
          triggeredBy: 'timeline_progression',
          metadata: {
            reason: evalResult.reason,
            referenceDate: referenceDate.toISOString(),
          },
        });

        transitions.push({
          bookingId: updated._id,
          previousStatus,
          newStatus: updated.status,
          reason: evalResult.reason,
          eventPublished: publishResult.event.eventType,
          publishLatencyMs: publishResult.latencyMs,
        });
      }
    }

    await safeCommit(session);

    return res.status(200).json({
      success: true,
      count: transitions.length,
      data: {
        referenceDate: referenceDate.toISOString(),
        activatedCount,
        completedCount,
        transitions,
      },
    });
  } catch (err) {
    await safeAbort(session);
    return handleBookingError(res, err, 'Cannot progress booking timelines');
  } finally {
    safeEnd(session);
  }
};

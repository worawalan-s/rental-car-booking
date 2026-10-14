const mongoose = require('mongoose');

// Helper validators
const isValidObjectId = (id) => mongoose.isValidObjectId(id);

const isNonEmptyString = (val) => typeof val === 'string' && val.trim().length > 0;

const isValidEmail = (email) => {
  if (typeof email !== 'string') return false;
  const emailRegex =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return emailRegex.test(email.trim());
};

const isThaiPhone = (phone) => {
  if (typeof phone !== 'string') return false;
  return /^0[0-9]{9}$/.test(phone.trim());
};

const isPositiveInteger = (val) => Number.isInteger(val) && val > 0;

/**
 * Sanitizes auth request body by trimming strings and lowercasing email.
 */
const sanitizeAuthBody = (req, res, next) => {
  if (req.body) {
    if (typeof req.body.name === 'string') req.body.name = req.body.name.trim();
    if (typeof req.body.tel === 'string') req.body.tel = req.body.tel.trim();
    if (typeof req.body.email === 'string') req.body.email = req.body.email.trim().toLowerCase();
  }
  next();
};

/**
 * Validates rental booking dates (startDate, endDate).
 * Ensures dates are not in the past, return date is on or after start date (allows same-day rental),
 * and rental duration <= 30 days.
 */
const validateBookingDates = (req, res, next) => {
  const { startDate, endDate } = req.body || {};

  if (!startDate) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a rental start date',
    });
  }

  if (isNaN(Date.parse(startDate))) {
    return res.status(400).json({
      success: false,
      message: 'Invalid rental start date format',
    });
  }

  if (!endDate) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a rental return date',
    });
  }

  if (isNaN(Date.parse(endDate))) {
    return res.status(400).json({
      success: false,
      message: 'Invalid rental return date format',
    });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Normalize today's date to midnight for fair comparison (allows booking starting today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (start < today) {
    return res.status(400).json({
      success: false,
      message: 'Rental start date cannot be in the past',
    });
  }

  if (end < start) {
    return res.status(400).json({
      success: false,
      message: 'Rental return date cannot be before start date',
    });
  }

  const durationDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  if (durationDays > 30) {
    return res.status(400).json({
      success: false,
      message: 'Rental duration cannot exceed 30 days per booking',
    });
  }

  next();
};

/**
 * Validates full booking creation payload (dates, car, provider, numOfCars, addOns).
 */
const validateBookingPayload = (req, res, next) => {
  const { car, provider, numOfCars, addOns } = req.body || {};

  if (!car || !isValidObjectId(car)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid car ID',
    });
  }

  if (provider !== undefined && !isValidObjectId(provider)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid provider ID',
    });
  }

  if (
    numOfCars !== undefined &&
    (!Number.isInteger(numOfCars) || numOfCars < 1 || numOfCars > 3)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Number of cars must be an integer between 1 and 3',
    });
  }

  if (addOns !== undefined) {
    if (!Array.isArray(addOns)) {
      return res.status(400).json({
        success: false,
        message: 'AddOns must be an array of items',
      });
    }

    for (const item of addOns) {
      if (!item.addOn || !isValidObjectId(item.addOn)) {
        return res.status(400).json({
          success: false,
          message: 'Each addOn item must contain a valid addOn ID',
        });
      }
      if (
        item.quantity !== undefined &&
        (!Number.isInteger(item.quantity) || item.quantity < 1)
      ) {
        return res.status(400).json({
          success: false,
          message: 'AddOn quantity must be an integer of at least 1',
        });
      }
      if (
        item.price !== undefined &&
        (!Number.isInteger(item.price) || item.price < 0)
      ) {
        return res.status(400).json({
          success: false,
          message: 'AddOn price must be a non-negative integer in Satang',
        });
      }
    }
  }

  validateBookingDates(req, res, next);
};

module.exports = {
  isValidObjectId,
  isNonEmptyString,
  isValidEmail,
  isThaiPhone,
  isPositiveInteger,
  sanitizeAuthBody,
  validateBookingDates,
  validateBookingPayload,
};

const mongoose = require('mongoose');
const { calculateDurationDays } = require('../utils/date');

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

  const durationDays = calculateDurationDays(start, end);
  if (durationDays > 30) {
    return res.status(400).json({
      success: false,
      message: 'Rental duration cannot exceed 30 days per booking',
    });
  }

  req.durationDays = durationDays;
  next();
};

/**
 * Validates rental booking dates for update/rescheduling operations.
 * Allows partial updates; validates date formats, non-past start date,
 * and max 30-day duration if dates are updated.
 */
const validateBookingUpdateDates = (req, res, next) => {
  const { startDate, endDate } = req.body || {};

  // If neither date is being updated, pass through
  if (startDate === undefined && endDate === undefined) {
    return next();
  }

  if (startDate !== undefined) {
    if (isNaN(Date.parse(startDate))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rental start date format',
      });
    }

    const start = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) {
      return res.status(400).json({
        success: false,
        message: 'Rental start date cannot be in the past',
      });
    }
  }

  if (endDate !== undefined) {
    if (isNaN(Date.parse(endDate))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rental return date format',
      });
    }
  }

  if (startDate !== undefined && endDate !== undefined) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      return res.status(400).json({
        success: false,
        message: 'Rental return date cannot be before start date',
      });
    }

    const durationDays = calculateDurationDays(start, end);
    if (durationDays > 30) {
      return res.status(400).json({
        success: false,
        message: 'Rental duration cannot exceed 30 days per booking',
      });
    }

    req.durationDays = durationDays;
  }

  next();
};

/**
 * Validates optional nested :carId parameter if present in route.
 */
const validateNestedCarId = (req, res, next) => {
  if (req.params && req.params.carId && !isValidObjectId(req.params.carId)) {
    return res.status(400).json({
      success: false,
      message: `Resource not found with id of ${req.params.carId}`,
    });
  }
  next();
};

/**
 * Validates full booking creation payload (dates, car, provider, numOfCars, addOns).
 */
const validateBookingPayload = (req, res, next) => {
  const { car, provider, numOfCars, addOns } = req.body || {};
  const carId = (req.params && req.params.carId) || car;

  if (!carId || !isValidObjectId(carId)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid car ID',
    });
  }

  if (req.params && req.params.carId) {
    if (car && car !== req.params.carId) {
      return res.status(400).json({
        success: false,
        message: 'Car ID in URL does not match car ID in request body',
      });
    }
    req.body = { ...req.body, car: req.params.carId };
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
      if (
        !item ||
        typeof item !== 'object' ||
        !item.addOn ||
        !isValidObjectId(item.addOn)
      ) {
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

/**
 * Validates provider creation payload (name, address, tel).
 */
const validateProviderPayload = (req, res, next) => {
  const { name, address, tel } = req.body || {};

  if (!isNonEmptyString(name)) {
    return res.status(400).json({
      success: false,
      message: 'Please add a provider name',
    });
  }

  if (name.trim().length > 100) {
    return res.status(400).json({
      success: false,
      message: 'Name cannot exceed 100 characters',
    });
  }

  if (!isNonEmptyString(address)) {
    return res.status(400).json({
      success: false,
      message: 'Please add an address',
    });
  }

  if (!isThaiPhone(tel)) {
    return res.status(400).json({
      success: false,
      message: 'Please add a valid 10-digit Thai phone number (0xxxxxxxxx)',
    });
  }

  req.body.name = name.trim();
  req.body.address = address.trim();
  req.body.tel = tel.trim();

  next();
};

/**
 * Validates request route parameter as a valid MongoDB ObjectId.
 */
const validateObjectId = (paramName = 'id', resourceName) => (req, res, next) => {
  if (!isValidObjectId(req.params[paramName])) {
    const label = resourceName || `${paramName} ID`;
    return res.status(400).json({
      success: false,
      message: `Invalid ${label} format: ${req.params[paramName]}`,
    });
  }
  next();
};

/**
 * Validates provider update payload (optional name, address, tel).
 */
const validateProviderUpdate = (req, res, next) => {
  const { name, address, tel } = req.body || {};

  if (name !== undefined) {
    if (!isNonEmptyString(name)) {
      return res.status(400).json({
        success: false,
        message: 'Provider name cannot be empty',
      });
    }
    if (name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Name cannot exceed 100 characters',
      });
    }
    req.body.name = name.trim();
  }

  if (address !== undefined) {
    if (!isNonEmptyString(address)) {
      return res.status(400).json({
        success: false,
        message: 'Address cannot be empty',
      });
    }
    req.body.address = address.trim();
  }

  if (tel !== undefined) {
    if (!isThaiPhone(tel)) {
      return res.status(400).json({
        success: false,
        message: 'Please add a valid 10-digit Thai phone number (0xxxxxxxxx)',
      });
    }
    req.body.tel = tel.trim();
  }

  next();
};

/**
 * Validates optional request query parameter as a valid MongoDB ObjectId if provided.
 */
const validateQueryObjectId = (queryName = 'provider', resourceName) => (req, res, next) => {
  if (req.query && req.query[queryName]) {
    if (!isValidObjectId(req.query[queryName])) {
      const label = resourceName || `${queryName} ID`;
      return res.status(400).json({
        success: false,
        message: `Invalid ${label} format: ${req.query[queryName]}`,
      });
    }
  }
  next();
};

/**
 * Validates add-on creation payload (checks required provider ObjectId).
 */
const validateAddOnPayload = (req, res, next) => {
  const { provider } = req.body || {};
  if (!provider || !isValidObjectId(provider)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid provider ID for the add-on',
    });
  }
  next();
};

/**
 * Validates add-on update payload (checks optional provider ObjectId).
 */
const validateAddOnUpdatePayload = (req, res, next) => {
  const { provider } = req.body || {};
  if (provider !== undefined && !isValidObjectId(provider)) {
    return res.status(400).json({
      success: false,
      message: `Invalid provider ID format: ${provider}`,
    });
  }
  next();
};

module.exports = {
  isValidObjectId,
  isNonEmptyString,
  isValidEmail,
  isThaiPhone,
  isPositiveInteger,
  sanitizeAuthBody,
  validateBookingDates,
  validateBookingUpdateDates,
  validateBookingPayload,
  validateNestedCarId,
  validateProviderPayload,
  validateProviderUpdate,
  validateObjectId,
  validateQueryObjectId,
  validateAddOnPayload,
  validateAddOnUpdatePayload,
};
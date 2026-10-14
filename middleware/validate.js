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

module.exports = {
  isValidObjectId,
  isNonEmptyString,
  isValidEmail,
  isThaiPhone,
  isPositiveInteger,
  sanitizeAuthBody,
};

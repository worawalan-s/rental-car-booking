const ErrorResponse = require('../utils/errorResponse');
const logger = require('../config/logger');

/**
 * Global Express error handling middleware.
 * Must have 4 arguments (err, req, res, next) for Express to recognize it as an error handler.
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error with stack trace to Winston logger
  logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, {
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });

  // Mongoose bad ObjectId (CastError)
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    error = new ErrorResponse(message, 404);
  }

  // Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const message = `Duplicate field value entered for '${field}'. Please use another value`;
    error = new ErrorResponse(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
    error = new ErrorResponse(message, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Not authorized to access this route';
    error = new ErrorResponse(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new ErrorResponse(message, 401);
  }

  const statusCode = error.statusCode || err.status || 500;
  const isSafeClientError =
    err instanceof ErrorResponse ||
    error instanceof ErrorResponse ||
    (statusCode >= 400 && statusCode < 500);

  // Standardized response envelope (never leak raw stack traces or internal errors)
  res.status(statusCode).json({
    success: false,
    message: isSafeClientError ? error.message || 'Bad Request' : 'Server Error',
  });
};

module.exports = errorHandler;

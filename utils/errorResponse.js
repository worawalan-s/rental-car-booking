class ErrorResponse extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;

    // Capture stack trace without polluting constructor call
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ErrorResponse;

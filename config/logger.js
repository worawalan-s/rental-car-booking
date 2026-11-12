const path = require('path');
const winston = require('winston');
require('winston-daily-rotate-file');

const logDirectory = path.join(__dirname, '..', 'logs');

// Custom log format for file storage (structured JSON)
const fileLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Custom log format for console output (colorized and human-readable)
const consoleLogFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `[${timestamp}] ${level}: ${stack || message}`;
  })
);

// Daily rotate transport for error logs (only logs level 'error')
const errorRotateTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logDirectory, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '14d',
  format: fileLogFormat,
});

// Daily rotate transport for all operational logs (info, warn, error)
const combinedRotateTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logDirectory, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'info',
  maxSize: '20m',
  maxFiles: '14d',
  format: fileLogFormat,
});

// Create Winston logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  transports: [
    errorRotateTransport,
    combinedRotateTransport,
  ],
});

// If not in production or test, also log formatted output to console
if (process.env.NODE_ENV !== 'test') {
  logger.add(
    new winston.transports.Console({
      format: consoleLogFormat,
    })
  );
}

// Stream object for Morgan integration
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

module.exports = logger;

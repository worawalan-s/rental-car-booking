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

// Helper to create DailyRotateFile transport
const createRotateTransport = (filename, level) =>
  new winston.transports.DailyRotateFile({
    filename: path.join(logDirectory, filename),
    datePattern: 'YYYY-MM-DD',
    level,
    maxSize: '20m',
    maxFiles: '14d',
    format: fileLogFormat,
  });

const transports = [];
if (process.env.NODE_ENV !== 'test') {
  transports.push(
    createRotateTransport('error-%DATE%.log', 'error'),
    createRotateTransport('combined-%DATE%.log', 'info')
  );
}

// Create Winston logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  transports,
  silent: process.env.NODE_ENV === 'test',
});

// If not in production or test, also log formatted output to console
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
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

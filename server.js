const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const connectDB = require('./config/db');
const logger = require('./config/logger');
const errorHandler = require('./middleware/error');

// Load env vars
dotenv.config({ path: './config/config.env' });

// Verify critical environment variables
if (
  process.env.NODE_ENV !== 'test' &&
  (!process.env.JWT_SECRET || !process.env.JWT_EXPIRE)
) {
  console.error(
    'FATAL ERROR: JWT_SECRET or JWT_EXPIRE environment variable is not defined.'
  );
  process.exit(1);
}

// Connect to database
connectDB();

const app = express();

// Body parser
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// Query parser
app.set('query parser', 'extended');

// Set static folder for uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// HTTP request logging (dev console in development, structured file stream otherwise; silent in test)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else if (process.env.NODE_ENV !== 'test') {
  app.use(
    morgan('combined', {
      stream: logger.stream,
      skip: (req) => req.url === '/api/v1/health',
    })
  );
}

// Route files
const auth = require('./routes/auth');
const cars = require('./routes/cars');
const bookings = require('./routes/bookings');
const pricing = require('./routes/pricing');
const provider = require('./routes/provider');
const addons = require('./routes/addons');

// Base health check
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      service: 'Rental Car Booking API',
    },
  });
});

// Mount routers
app.use('/api/v1/auth', auth);
app.use('/api/v1/cars', cars);
app.use('/api/v1/bookings', bookings);
app.use('/api/v1/pricing', pricing);
app.use('/api/v1/providers', provider);
app.use('/api/v1/addons', addons);

// Centralized error handler (must be placed after all route definitions)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(
  PORT,
  () => logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
);

app.server = server;

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  logger.error(`Unhandled Rejection: ${err.message}`, { stack: err.stack });
  server.close(() => process.exit(1));
});

module.exports = app;

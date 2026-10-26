const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

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

// Route files
const auth = require('./routes/auth');

// Base health check
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Rental Car Booking API is running',
  });
});

// Mount routers
app.use('/api/v1/auth', auth);

const PORT = process.env.PORT || 5000;

const server = app.listen(
  PORT,
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  server.close(() => process.exit(1));
});

module.exports = app;

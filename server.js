const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const helmet = require('helmet');
const { xss } = require('express-xss-sanitizer');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const cors = require('cors');
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

// Express 5 compatibility: allow express-mongo-sanitize to sanitize req.query
const queryDescriptor = Object.getOwnPropertyDescriptor(express.request, 'query');
if (queryDescriptor && !queryDescriptor.set) {
  Object.defineProperty(express.request, 'query', {
    configurable: true,
    enumerable: true,
    get() {
      return this._sanitizedQuery !== undefined
        ? this._sanitizedQuery
        : queryDescriptor.get.call(this);
    },
    set(val) {
      this._sanitizedQuery = val;
    },
  });
}

// Body parser
app.use(express.json());

// Sanitize data (prevent NoSQL query injection)
app.use(mongoSanitize());

// Set security headers
app.use(helmet());

// Prevent XSS attacks
app.use(xss());

// Rate limiting (windowMs: 10 * 60 * 1000, max: 100)
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 mins
  max: 100,
});
app.use(limiter);

// Prevent HTTP param pollution
app.use(hpp());

// Enable CORS
app.use(cors());

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
const payments = require('./routes/payments');

// Swagger API Documentation (Task 17 / Issue #24 - Course Assignment 12 specification)
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUI = require('swagger-ui-express');

const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Rental Car Booking API',
      version: '1.0.0',
      description:
        'Course-aligned REST API for Rental Car Booking Platform (Software Development Practice 2110503)',
      contact: {
        name: 'Minnie & Praise',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'Current Host (Auto-detect Active Port)',
      },
      {
        url: 'http://localhost:5003/api/v1',
        description: 'Course Evaluation / VacQ Test Server',
      },
      {
        url: 'http://localhost:5000/api/v1',
        description: 'Local Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./routes/*.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocs));

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
app.use('/api/v1/payments', payments);
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

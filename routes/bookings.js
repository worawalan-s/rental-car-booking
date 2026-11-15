const express = require('express');
const {
  createBooking,
  getBooking,
  getBookings,
  updateBooking,
  deleteBooking,
  handlePaymentWebhook,
  progressBookingsByTimeline,
} = require('../controllers/bookings');

const { protect, authorize } = require('../middleware/auth');
const {
  validateBookingPayload,
  validateBookingUpdateDates,
  validateNestedCarId,
} = require('../middleware/validate');

const router = express.Router({ mergeParams: true });

router.use(validateNestedCarId);

/**
 * @swagger
 * tags:
 *   name: Bookings
 *   description: Vehicle reservation management, 3-car quota enforcement, payment webhooks, and state machine lifecycle
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     BookingItem:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 60d5ec49f1b2c8b1f8e4e1a1
 *         user:
 *           type: string
 *           description: ObjectId of renter user
 *         car:
 *           type: string
 *           description: ObjectId of reserved vehicle
 *         provider:
 *           type: string
 *           description: ObjectId of owning provider branch
 *         startDate:
 *           type: string
 *           format: date-time
 *           example: "2026-12-10T00:00:00.000Z"
 *         endDate:
 *           type: string
 *           format: date-time
 *           example: "2026-12-12T00:00:00.000Z"
 *         numOfCars:
 *           type: integer
 *           minimum: 1
 *           maximum: 3
 *           example: 1
 *         status:
 *           type: string
 *           enum: [Pending, Confirmed, Active, Completed, Cancelled]
 *           example: Pending
 *         paymentStatus:
 *           type: string
 *           enum: [Unpaid, Paid, Failed, Refunded]
 *           example: Unpaid
 *         totalPrice:
 *           type: integer
 *           description: Total price in Satang (100 Satang = 1.00 THB)
 *           example: 440000
 *         addOns:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               addOn:
 *                 type: string
 *               quantity:
 *                 type: integer
 *               price:
 *                 type: integer
 *     CreateBookingInput:
 *       type: object
 *       required:
 *         - car
 *         - startDate
 *         - endDate
 *       properties:
 *         car:
 *           type: string
 *           description: MongoDB ObjectId of car
 *           example: 60d5ec49f1b2c8b1f8e4e1a3
 *         startDate:
 *           type: string
 *           format: date
 *           example: "2026-12-10"
 *         endDate:
 *           type: string
 *           format: date
 *           example: "2026-12-12"
 *         numOfCars:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *           maximum: 3
 *           example: 1
 *         addOns:
 *           type: array
 *           items:
 *             type: object
 *             required:
 *               - addOn
 *             properties:
 *               addOn:
 *                 type: string
 *                 example: 60d5ec49f1b2c8b1f8e4e1a5
 *               quantity:
 *                 type: integer
 *                 default: 1
 *                 example: 1
 */

/**
 * @swagger
 * /bookings:
 *   get:
 *     summary: Get all bookings (User sees own bookings, Admin sees all)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Pending, Confirmed, Active, Completed, Cancelled]
 *         description: Filter bookings by status
 *     responses:
 *       200:
 *         description: Bookings retrieved successfully
 *       401:
 *         description: Not authorized
 *   post:
 *     summary: Create new vehicle reservation with atomic add-on locking & 3-car quota check (User only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBookingInput'
 *     responses:
 *       201:
 *         description: Booking created successfully
 *       400:
 *         description: Quota exceeded, schedule collision, insufficient add-on stock, or invalid dates
 *       403:
 *         description: Forbidden - Admins cannot create bookings directly
 */
router
  .route('/')
  .get(protect, authorize('admin', 'user'), getBookings)
  .post(
    protect,
    authorize('user'),
    validateBookingPayload,
    createBooking
  );

/**
 * @swagger
 * /bookings/webhook:
 *   post:
 *     summary: Payment gateway webhook handler with idempotent database updates & <50ms RabbitMQ event emission
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventId
 *               - eventType
 *               - bookingId
 *             properties:
 *               eventId:
 *                 type: string
 *                 example: evt_pay_demo_001
 *               eventType:
 *                 type: string
 *                 enum: [payment.succeeded, payment.failed]
 *                 example: payment.succeeded
 *               bookingId:
 *                 type: string
 *                 example: 60d5ec49f1b2c8b1f8e4e1a1
 *     responses:
 *       200:
 *         description: Webhook processed (or replayed idempotently) and domain event published within 50ms
 *       400:
 *         description: Invalid payload or illegal state transition
 *       404:
 *         description: Booking not found
 */
router.post('/webhook', handlePaymentWebhook);

/**
 * @swagger
 * /bookings/progress-timeline:
 *   post:
 *     summary: Trigger automatic rental timeline status progression (Confirmed -> Active -> Completed) (Admin only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               referenceDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-12-10T10:00:00.000Z"
 *     responses:
 *       200:
 *         description: Timeline progression evaluated and domain events published
 *       400:
 *         description: Invalid referenceDate format
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.post(
  '/progress-timeline',
  protect,
  authorize('admin'),
  progressBookingsByTimeline
);

/**
 * @swagger
 * /bookings/{id}:
 *   get:
 *     summary: Get single booking by ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Booking found
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Booking not found
 *   put:
 *     summary: Update booking dates, cars count, or transition status (Governed by deterministic State Machine)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking MongoDB ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               numOfCars:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 3
 *               status:
 *                 type: string
 *                 enum: [Pending, Confirmed, Active, Completed, Cancelled]
 *     responses:
 *       200:
 *         description: Booking updated successfully
 *       400:
 *         description: State machine violation, terminal state modification, or schedule collision
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden status update for regular user
 *       404:
 *         description: Booking not found
 *   delete:
 *     summary: Delete booking and release allocated add-on stock
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Booking deleted successfully
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Booking not found
 */
router
  .route('/:id')
  .get(protect, authorize('admin', 'user'), getBooking)
  .put(
    protect,
    authorize('admin', 'user'),
    validateBookingUpdateDates,
    updateBooking
  )
  .delete(protect, authorize('admin', 'user'), deleteBooking);

module.exports = router;

const express = require('express');
const {
  getCars,
  getCar,
  createCar,
  updateCar,
  deleteCar,
  searchCars,
} = require('../controllers/cars');

const bookingRouter = require('./bookings');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use('/:carId/bookings', bookingRouter);

/**
 * @swagger
 * tags:
 *   name: Cars
 *   description: Rental vehicle catalog, faceted search pipeline (<200ms SLA), and fleet management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Car:
 *       type: object
 *       required:
 *         - brand
 *         - model
 *         - category
 *         - dailyRate
 *         - capacity
 *         - provider
 *       properties:
 *         brand:
 *           type: string
 *           example: Toyota
 *         model:
 *           type: string
 *           example: Camry 2.5 Premium
 *         category:
 *           type: string
 *           enum: [Sedan, SUV, Hatchback, Van, Truck, Luxury, Electric]
 *           example: Sedan
 *         dailyRate:
 *           type: integer
 *           description: Price per day in Satang (100 Satang = 1.00 THB)
 *           example: 150000
 *         capacity:
 *           type: integer
 *           minimum: 1
 *           maximum: 15
 *           example: 5
 *         isAvailable:
 *           type: boolean
 *           default: true
 *           example: true
 *         provider:
 *           type: string
 *           description: ObjectId of owning rental provider branch
 *           example: 60d5ec49f1b2c8b1f8e4e1b2
 *     CarListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         count:
 *           type: integer
 *           example: 10
 *         pagination:
 *           type: object
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Car'
 */

/**
 * @swagger
 * /cars:
 *   get:
 *     summary: Retrieve list of cars with filtering, sorting, and pagination
 *     tags: [Cars]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Sedan, SUV, Hatchback, Van, Truck, Luxury, Electric]
 *         description: Filter cars by category
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort fields (e.g. dailyRate, -createdAt)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 25
 *     responses:
 *       200:
 *         description: Successfully retrieved cars
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CarListResponse'
 *       400:
 *         description: Bad query format
 *   post:
 *     summary: Create new vehicle (Admin only)
 *     tags: [Cars]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Car'
 *     responses:
 *       201:
 *         description: Car created successfully
 *       400:
 *         description: Validation error or invalid provider ID
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden - Requires admin role
 */
router
  .route('/')
  .get(getCars)
  .post(protect, authorize('admin'), createCar);

/**
 * @swagger
 * /cars/search:
 *   get:
 *     summary: Faceted search and real-time category aggregation pipeline (<200ms SLA)
 *     tags: [Cars]
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: Keyword search on brand or model
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Category filter
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: integer
 *         description: Minimum daily rate in Satang
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: integer
 *         description: Maximum daily rate in Satang
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Faceted search results and category counts
 */
router.route('/search').get(searchCars);

/**
 * @swagger
 * /cars/{id}:
 *   get:
 *     summary: Get single car by ID with populated provider and virtual bookings
 *     tags: [Cars]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Car MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Car found
 *       400:
 *         description: Invalid Car ID format
 *       404:
 *         description: Car not found
 *   put:
 *     summary: Update car attributes (Admin only)
 *     tags: [Cars]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Car MongoDB ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               brand:
 *                 type: string
 *               model:
 *                 type: string
 *               category:
 *                 type: string
 *               dailyRate:
 *                 type: integer
 *                 description: Rate in Satang
 *               capacity:
 *                 type: integer
 *               isAvailable:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Car updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Car not found
 *   delete:
 *     summary: Delete car with cascade delete of associated bookings (Admin only)
 *     tags: [Cars]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Car MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Car deleted successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Car not found
 */
router
  .route('/:id')
  .get(getCar)
  .put(protect, authorize('admin'), updateCar)
  .delete(protect, authorize('admin'), deleteCar);

module.exports = router;

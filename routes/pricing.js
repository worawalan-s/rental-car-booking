const express = require('express');
const { calculatePrice } = require('../controllers/pricing');
const { validateBookingDates } = require('../middleware/validate');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Pricing
 *   description: Pure integer Satang financial calculator (<100ms SLA) with 7% VAT rounding
 */

/**
 * @swagger
 * /pricing/calculate:
 *   post:
 *     summary: Calculate itemized rental quote in Satang with 7% VAT (<100ms SLA)
 *     tags: [Pricing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - startDate
 *               - endDate
 *             properties:
 *               car:
 *                 type: string
 *                 description: Optional Car ObjectId (used if dailyRate is omitted)
 *               dailyRate:
 *                 type: integer
 *                 description: Daily rate in Satang (100 Satang = 1.00 THB)
 *                 example: 150000
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-12-10"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-12-12"
 *               numOfCars:
 *                 type: integer
 *                 default: 1
 *                 example: 1
 *               addOns:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: Child Safety Seat
 *                     price:
 *                       type: integer
 *                       description: Daily add-on rate in Satang
 *                       example: 20000
 *                     quantity:
 *                       type: integer
 *                       default: 1
 *                       example: 1
 *     responses:
 *       200:
 *         description: Itemized pricing breakdown in Satang
 *       400:
 *         description: Invalid dates, non-integer Satang rate, or duration > 30 days
 */
router.route('/calculate').post(validateBookingDates, calculatePrice);

module.exports = router;

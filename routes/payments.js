const express = require('express');
const { handlePaymentWebhook } = require('../controllers/bookings');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment gateway webhook handling and asynchronous state resolution
 */

/**
 * @swagger
 * /payments/webhook:
 *   post:
 *     summary: Handle payment gateway webhook (idempotent state transition)
 *     tags: [Payments]
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
 *                 example: evt_pay_123456
 *               eventType:
 *                 type: string
 *                 enum: [payment.succeeded, payment.failed, payment.refunded]
 *                 example: payment.succeeded
 *               bookingId:
 *                 type: string
 *                 example: 60d5ec49f1b2c8b1f8e4e1a1
 *     responses:
 *       200:
 *         description: Webhook processed successfully or already handled idempotently
 *       400:
 *         description: Missing eventId, bookingId, or unsupported eventType
 *       404:
 *         description: Booking not found
 */
router.post('/webhook', handlePaymentWebhook);

module.exports = router;

const express = require('express');
const {
  getProviders,
  getProvider,
  createProvider,
  updateProvider,
  deleteProvider,
} = require('../controllers/provider');

const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  validateObjectId,
  validateProviderPayload,
  validateProviderUpdate,
} = require('../middleware/validate');

/**
 * @swagger
 * tags:
 *   name: Providers
 *   description: Rental car provider branches and Redis-cached branch catalog
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Provider:
 *       type: object
 *       required:
 *         - name
 *         - address
 *         - tel
 *       properties:
 *         name:
 *           type: string
 *           example: Bangkok City Rentals
 *         address:
 *           type: string
 *           example: 123 Sukhumvit Road, Khlong Toei, Bangkok 10110
 *         tel:
 *           type: string
 *           description: 10-digit Thai telephone number (/^0[0-9]{9}$/)
 *           example: "0212345678"
 */

/**
 * @swagger
 * /providers:
 *   get:
 *     summary: Get all rental car provider branches (Redis cached)
 *     tags: [Providers]
 *     responses:
 *       200:
 *         description: List of all providers
 *   post:
 *     summary: Create a new provider branch (Admin only)
 *     tags: [Providers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Provider'
 *     responses:
 *       201:
 *         description: Provider created successfully
 *       400:
 *         description: Validation error or invalid 10-digit Thai phone number
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden - Admin only
 */
router
  .route('/')
  .get(getProviders)
  .post(protect, authorize('admin'), validateProviderPayload, createProvider);

/**
 * @swagger
 * /providers/{id}:
 *   get:
 *     summary: Get single provider branch by ID
 *     tags: [Providers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Provider MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Provider retrieved successfully
 *       400:
 *         description: Invalid provider ID format
 *       404:
 *         description: Provider not found
 *   put:
 *     summary: Update provider details (Admin only)
 *     tags: [Providers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Provider MongoDB ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               address:
 *                 type: string
 *               tel:
 *                 type: string
 *                 example: "0812345678"
 *     responses:
 *       200:
 *         description: Provider updated successfully
 *       400:
 *         description: Invalid phone format
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Provider not found
 *   delete:
 *     summary: Delete provider with cascade delete of associated cars & bookings (Admin only)
 *     tags: [Providers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Provider MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Provider deleted successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Provider not found
 */
router
  .route('/:id')
  .get(validateObjectId('id', 'provider ID'), getProvider)
  .put(
    protect,
    authorize('admin'),
    validateObjectId('id', 'provider ID'),
    validateProviderUpdate,
    updateProvider
  )
  .delete(
    protect,
    authorize('admin'),
    validateObjectId('id', 'provider ID'),
    deleteProvider
  );

module.exports = router;

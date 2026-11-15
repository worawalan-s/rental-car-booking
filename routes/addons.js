const express = require('express');
const {
  getAddOns,
  getAddOn,
  createAddOn,
  updateAddOn,
  deleteAddOn,
} = require('../controllers/addons');

const { protect, authorize } = require('../middleware/auth');
const {
  validateObjectId,
  validateQueryObjectId,
  validateAddOnPayload,
  validateAddOnUpdatePayload,
} = require('../middleware/validate');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: AddOns
 *   description: Physical rental accessory inventory, pricing, and atomic reservation
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AddOn:
 *       type: object
 *       required:
 *         - name
 *         - category
 *         - dailyRate
 *         - inventoryStock
 *         - provider
 *       properties:
 *         name:
 *           type: string
 *           example: Garmin GPS Navigator
 *         category:
 *           type: string
 *           enum: [Equipment, Child Safety, Connectivity, Accessory]
 *           example: Equipment
 *         description:
 *           type: string
 *           example: Voice-guided GPS navigation unit
 *         dailyRate:
 *           type: integer
 *           description: Price per day in Satang
 *           example: 15000
 *         inventoryStock:
 *           type: integer
 *           example: 10
 *         isAvailable:
 *           type: boolean
 *           default: true
 *         provider:
 *           type: string
 *           example: 60d5ec49f1b2c8b1f8e4e1b2
 */

/**
 * @swagger
 * /addons:
 *   get:
 *     summary: List physical add-on catalog with optional provider or category filter
 *     tags: [AddOns]
 *     parameters:
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *         description: Filter by provider branch ObjectId
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Equipment, Child Safety, Connectivity, Accessory]
 *     responses:
 *       200:
 *         description: Add-ons retrieved successfully
 *   post:
 *     summary: Create new rental accessory item (Admin only)
 *     tags: [AddOns]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddOn'
 *     responses:
 *       201:
 *         description: Add-on created successfully
 *       400:
 *         description: Validation error or duplicate name for same provider
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden - Admin only
 */
router
  .route('/')
  .get(validateQueryObjectId('provider', 'provider ID'), getAddOns)
  .post(protect, authorize('admin'), validateAddOnPayload, createAddOn);

/**
 * @swagger
 * /addons/{id}:
 *   get:
 *     summary: Get single add-on by ID
 *     tags: [AddOns]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: AddOn MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Add-on found
 *       400:
 *         description: Invalid add-on ID format
 *       404:
 *         description: Add-on not found
 *   put:
 *     summary: Update add-on pricing, stock, or details (Admin only)
 *     tags: [AddOns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: AddOn MongoDB ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               dailyRate:
 *                 type: integer
 *               inventoryStock:
 *                 type: integer
 *               isAvailable:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Add-on updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Add-on not found
 *   delete:
 *     summary: Delete add-on document (Admin only)
 *     tags: [AddOns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: AddOn MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Add-on deleted successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Add-on not found
 */
router
  .route('/:id')
  .get(validateObjectId('id', 'add-on ID'), getAddOn)
  .put(
    protect,
    authorize('admin'),
    validateObjectId('id', 'add-on ID'),
    validateAddOnUpdatePayload,
    updateAddOn
  )
  .delete(
    protect,
    authorize('admin'),
    validateObjectId('id', 'add-on ID'),
    deleteAddOn
  );

module.exports = router;

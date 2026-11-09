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

router
  .route('/')
  .get(validateQueryObjectId('provider', 'provider ID'), getAddOns)
  .post(protect, authorize('admin'), validateAddOnPayload, createAddOn);

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

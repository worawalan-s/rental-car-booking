const express = require("express");
const {
  getProviders,
  getProvider,
  createProvider,
  updateProvider,
  deleteProvider,
} = require("../controllers/provider");

const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  validateObjectId,
  validateProviderPayload,
  validateProviderUpdate,
} = require("../middleware/validate");

router
  .route("/")
  .get(getProviders)
  .post(protect, authorize("admin"), validateProviderPayload, createProvider);

router
  .route("/:id")
  .get(validateObjectId("id", "provider ID"), getProvider)
  .put(
    protect,
    authorize("admin"),
    validateObjectId("id", "provider ID"),
    validateProviderUpdate,
    updateProvider
  )
  .delete(
    protect,
    authorize("admin"),
    validateObjectId("id", "provider ID"),
    deleteProvider
  );

module.exports = router;

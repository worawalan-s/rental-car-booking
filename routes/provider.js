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
  validateProviderPayload,
  validateProviderUpdate,
} = require("../middleware/validate");

router
  .route("/")
  .get(getProviders)
  .post(protect, authorize("admin"), validateProviderPayload, createProvider);

router
  .route("/:id")
  .get(getProvider)
  .put(protect, authorize("admin"), validateProviderUpdate, updateProvider)
  .delete(protect, authorize("admin"), deleteProvider);

module.exports = router;

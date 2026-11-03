const express = require('express');
const { calculatePrice } = require('../controllers/pricing');
const { validateBookingDates } = require('../middleware/validate');

const router = express.Router();

router.route('/calculate').post(validateBookingDates, calculatePrice);

module.exports = router;

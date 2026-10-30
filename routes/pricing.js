const express = require('express');
const { calculatePrice } = require('../controllers/pricing');

const router = express.Router();

router.route('/calculate').post(calculatePrice);

module.exports = router;

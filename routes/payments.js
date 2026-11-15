const express = require('express');
const { handlePaymentWebhook } = require('../controllers/bookings');

const router = express.Router();

router.post('/webhook', handlePaymentWebhook);

module.exports = router;

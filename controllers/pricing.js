const mongoose = require('mongoose');
const Car = require('../models/Car');
const { calculatePricing } = require('../utils/pricingCalculator');

// @desc      Calculate rental pricing breakdown with pure integer Satang arithmetic & 7% VAT (<100ms)
// @route     POST /api/v1/pricing/calculate
// @access    Public
exports.calculatePrice = async (req, res, next) => {
  try {
    const { car, startDate, endDate, numOfCars, addOns } = req.body;
    let dailyRate = req.body.dailyRate;

    // If car ID is provided and dailyRate is omitted, fetch car dailyRate from DB
    if (dailyRate === undefined && car) {
      if (!mongoose.isValidObjectId(car)) {
        return res.status(400).json({
          success: false,
          message: `Invalid car ID format: ${car}`,
        });
      }

      const carDoc = await Car.findById(car);
      if (!carDoc) {
        return res.status(404).json({
          success: false,
          message: `Car not found with id of ${car}`,
        });
      }

      dailyRate = carDoc.dailyRate;
    }

    if (dailyRate === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either dailyRate or a valid car ID',
      });
    }

    // Parse dailyRate if string
    dailyRate = typeof dailyRate === 'string' ? parseInt(dailyRate, 10) : dailyRate;

    const pricing = calculatePricing({
      dailyRate,
      startDate,
      endDate,
      numOfCars,
      addOns,
    });

    res.status(200).json({
      success: true,
      data: pricing,
    });
  } catch (err) {
    // Two-key error envelope
    res.status(400).json({
      success: false,
      message: err.message || 'Cannot calculate pricing',
    });
  }
};

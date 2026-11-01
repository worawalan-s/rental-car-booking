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

      let carDoc;
      try {
        carDoc = await Car.findById(car);
      } catch (dbErr) {
        return res.status(500).json({
          success: false,
          message: 'Cannot calculate pricing',
        });
      }

      if (!carDoc) {
        return res.status(404).json({
          success: false,
          message: `Car not found with id of ${car}`,
        });
      }

      dailyRate = carDoc.dailyRate;
    }

    if (dailyRate === undefined || dailyRate === null) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either dailyRate or a valid car ID',
      });
    }

    // Strictly validate dailyRate (reject floats, non-digits, and non-positive numbers)
    let parsedRate;
    if (typeof dailyRate === 'string') {
      const trimmed = dailyRate.trim();
      if (!/^\d+$/.test(trimmed)) {
        return res.status(400).json({
          success: false,
          message: 'Daily rate must be a positive integer in Satang (min: 1)',
        });
      }
      parsedRate = parseInt(trimmed, 10);
    } else if (typeof dailyRate === 'number' && Number.isInteger(dailyRate)) {
      parsedRate = dailyRate;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Daily rate must be a positive integer in Satang (min: 1)',
      });
    }

    if (parsedRate < 1) {
      return res.status(400).json({
        success: false,
        message: 'Daily rate must be a positive integer in Satang (min: 1)',
      });
    }

    const pricing = calculatePricing({
      dailyRate: parsedRate,
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
    if (err.statusCode === 400 || err.message) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    // Strict two-key error envelope without internal diagnostics leak
    res.status(500).json({
      success: false,
      message: 'Cannot calculate pricing',
    });
  }
};

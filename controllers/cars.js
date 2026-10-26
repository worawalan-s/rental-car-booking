const Car = require('../models/Car');
const Provider = require('../models/Provider');
const Booking = require('../models/Booking');

// @desc      Get all cars
// @route     GET /api/v1/cars
// @access    Public
exports.getCars = async (req, res, next) => {
  try {
    let query;

    // Whitelist allowed filter fields matching Car schema
    const ALLOWED_FILTER_FIELDS = [
      'brand',
      'model',
      'category',
      'dailyRate',
      'capacity',
      'isAvailable',
      'provider',
    ];

    // Filter req.query: reject non-whitelisted keys and keys starting with $ or __proto__
    const reqQuery = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (
        !key.startsWith('$') &&
        key !== '__proto__' &&
        ALLOWED_FILTER_FIELDS.includes(key)
      ) {
        reqQuery[key] = value;
      }
    }

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, $lt, $lte, $in)
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`
    );

    const parsedQuery = JSON.parse(queryStr);

    // Finding resource with populated provider and virtual bookings (Assignment 7.2 pattern)
    query = Car.find(parsedQuery)
      .populate({
        path: 'provider',
        select: 'name address tel',
      })
      .populate('bookings');

    // Select Fields
    if (req.query.select && typeof req.query.select === 'string') {
      const fields = req.query.select.split(',').join(' ');
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort && typeof req.query.sort === 'string') {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Pagination with safe boundaries (cap limit between 1 and 50)
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const rawLimit = parseInt(req.query.limit, 10) || 25;
    const limit = Math.min(Math.max(rawLimit, 1), 50);
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Car.countDocuments(parsedQuery);

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const cars = await query;

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit,
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit,
      };
    }

    res.status(200).json({
      success: true,
      count: cars.length,
      pagination,
      data: cars,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc      Get single car
// @route     GET /api/v1/cars/:id
// @access    Public
exports.getCar = async (req, res, next) => {
  try {
    const car = await Car.findById(req.params.id)
      .populate({
        path: 'provider',
        select: 'name address tel',
      })
      .populate('bookings');

    if (!car) {
      return res.status(404).json({
        success: false,
        message: `Car not found with id of ${req.params.id}`,
      });
    }

    res.status(200).json({
      success: true,
      data: car,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc      Create new car
// @route     POST /api/v1/cars
// @access    Private (Admin only)
exports.createCar = async (req, res, next) => {
  try {
    // Validate provider existence if provider ID is supplied
    if (req.body.provider) {
      const provider = await Provider.findById(req.body.provider);
      if (!provider) {
        return res.status(404).json({
          success: false,
          message: `Provider not found with id of ${req.body.provider}`,
        });
      }
    }

    const car = await Car.create(req.body);

    res.status(201).json({
      success: true,
      data: car,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc      Update car
// @route     PUT /api/v1/cars/:id
// @access    Private (Admin only)
exports.updateCar = async (req, res, next) => {
  try {
    if (req.body.provider) {
      const provider = await Provider.findById(req.body.provider);
      if (!provider) {
        return res.status(404).json({
          success: false,
          message: `Provider not found with id of ${req.body.provider}`,
        });
      }
    }

    const car = await Car.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: 'after',
      runValidators: true,
    });

    if (!car) {
      return res.status(404).json({
        success: false,
        message: `Car not found with id of ${req.params.id}`,
      });
    }

    res.status(200).json({
      success: true,
      data: car,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc      Delete car
// @route     DELETE /api/v1/cars/:id
// @access    Private (Admin only)
exports.deleteCar = async (req, res, next) => {
  try {
    const car = await Car.findById(req.params.id);

    if (!car) {
      return res.status(404).json({
        success: false,
        message: `Car not found with id of ${req.params.id}`,
      });
    }

    // Cascade delete associated bookings (Assignment 7.2 pattern)
    await Booking.deleteMany({ car: req.params.id });
    await Car.deleteOne({ _id: req.params.id });

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

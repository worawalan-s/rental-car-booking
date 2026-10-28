const mongoose = require('mongoose');
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

// @desc      Search cars with real-time category aggregation pipeline (<200ms)
// @route     GET /api/v1/cars/search
// @access    Public
exports.searchCars = async (req, res, next) => {
  const startTime = Date.now();
  try {
    // 1. Build sanitized match query for vehicles
    const matchQuery = {};

    // Filter by availability (default: true unless explicitly requested otherwise)
    if (req.query.isAvailable !== undefined) {
      matchQuery.isAvailable = req.query.isAvailable === 'true';
    } else {
      matchQuery.isAvailable = true;
    }

    // Filter by provider (Adv Req 2: "when viewing a provider's catalog")
    if (req.query.provider) {
      if (mongoose.isValidObjectId(req.query.provider)) {
        matchQuery.provider = new mongoose.Types.ObjectId(req.query.provider);
      } else {
        return res.status(400).json({
          success: false,
          message: `Invalid provider ID format: ${req.query.provider}`,
        });
      }
    }

    // Filter by vehicle category (single or comma-separated)
    if (req.query.category) {
      if (Array.isArray(req.query.category)) {
        matchQuery.category = { $in: req.query.category };
      } else if (typeof req.query.category === 'string') {
        const categories = req.query.category.split(',').map((c) => c.trim());
        matchQuery.category =
          categories.length > 1 ? { $in: categories } : categories[0];
      }
    }

    // Filter by capacity ($gte or exact)
    if (req.query.capacity) {
      if (typeof req.query.capacity === 'object') {
        const capFilter = {};
        for (const [op, val] of Object.entries(req.query.capacity)) {
          if (['gt', 'gte', 'lt', 'lte'].includes(op)) {
            capFilter[`$${op}`] = parseInt(val, 10);
          }
        }
        if (Object.keys(capFilter).length > 0) matchQuery.capacity = capFilter;
      } else {
        matchQuery.capacity = { $gte: parseInt(req.query.capacity, 10) };
      }
    }

    // Filter by dailyRate in Satang (fixed-point integer)
    if (req.query.dailyRate && typeof req.query.dailyRate === 'object') {
      const rateFilter = {};
      for (const [op, val] of Object.entries(req.query.dailyRate)) {
        if (['gt', 'gte', 'lt', 'lte'].includes(op)) {
          rateFilter[`$${op}`] = parseInt(val, 10);
        }
      }
      if (Object.keys(rateFilter).length > 0) matchQuery.dailyRate = rateFilter;
    }

    // Pagination parameters
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const rawLimit = parseInt(req.query.limit, 10) || 25;
    const limit = Math.min(Math.max(rawLimit, 1), 50);
    const skip = (page - 1) * limit;

    // Build category count match stage:
    // When searching within a provider, categoryCounts reflect available cars for that provider.
    const categoryCountMatch = { isAvailable: true };
    if (matchQuery.provider) {
      categoryCountMatch.provider = matchQuery.provider;
    }

    // 2. Execute $facet aggregation pipeline in a single database roundtrip
    const [result] = await Car.aggregate([
      {
        $facet: {
          paginatedResults: [
            { $match: matchQuery },
            { $sort: { dailyRate: 1, _id: 1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'providers',
                localField: 'provider',
                foreignField: '_id',
                as: 'provider',
              },
            },
            {
              $unwind: {
                path: '$provider',
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                brand: 1,
                model: 1,
                category: 1,
                dailyRate: 1,
                capacity: 1,
                isAvailable: 1,
                createdAt: 1,
                'provider._id': 1,
                'provider.name': 1,
                'provider.address': 1,
                'provider.tel': 1,
              },
            },
          ],
          totalCount: [
            { $match: matchQuery },
            { $count: 'total' },
          ],
          categoryCounts: [
            { $match: categoryCountMatch },
            {
              $group: {
                _id: '$category',
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    // 3. Process facet results
    const cars = (result && result.paginatedResults) || [];
    const total =
      (result &&
        result.totalCount &&
        result.totalCount[0] &&
        result.totalCount[0].total) ||
      0;

    // Standardize categoryCounts map across all 7 valid categories
    const ALL_CATEGORIES = [
      'Sedan',
      'SUV',
      'Hatchback',
      'Van',
      'Truck',
      'Luxury',
      'Electric',
    ];

    const categoryCountsMap = {};
    ALL_CATEGORIES.forEach((cat) => {
      categoryCountsMap[cat] = 0;
    });

    if (result && Array.isArray(result.categoryCounts)) {
      result.categoryCounts.forEach((item) => {
        if (categoryCountsMap[item._id] !== undefined) {
          categoryCountsMap[item._id] = item.count;
        }
      });
    }

    // Pagination metadata
    const pagination = {};
    if (skip + limit < total) {
      pagination.next = {
        page: page + 1,
        limit,
      };
    }
    if (skip > 0) {
      pagination.prev = {
        page: page - 1,
        limit,
      };
    }

    const executionTimeMs = Date.now() - startTime;

    res.status(200).json({
      success: true,
      count: cars.length,
      total,
      pagination,
      categoryCounts: categoryCountsMap,
      executionTimeMs,
      data: cars,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Server error during car search and aggregation',
      error: err.message,
    });
  }
};


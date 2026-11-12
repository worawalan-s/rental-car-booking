const mongoose = require("mongoose");
const Provider = require("../models/Provider");
const Car = require("../models/Car");
const Booking = require("../models/Booking");
const AddOn = require("../models/AddOn");
const redisClient = require("../config/redis");

// Helper to format clean, safe error messages without leaking database internals
const formatProviderError = (err, req) => {
  if (err.name === "CastError") {
    return `Invalid provider ID format: ${req.params ? req.params.id : ""}`;
  }
  if (err.code === 11000) {
    return `Provider with name '${req.body ? req.body.name : ""}' already exists`;
  }
  if (err.name === "ValidationError") {
    return Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
  }
  return "An unexpected error occurred";
};

// @desc     Get all providers
// @route    GET /api/v1/providers
// @access   Public
exports.getProviders = async (req, res, next) => {
  try {
    // Cache-aside: deterministic key from sorted query params
    const sortedQueryEntries = Object.keys(req.query)
      .sort()
      .map((k) => [k, req.query[k]]);
    const cacheKey = `providers:list:${JSON.stringify(sortedQueryEntries)}`;

    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    let query;

    // Whitelist allowed filter fields and strip $ / __proto__ keys (matches controllers/cars.js)
    const ALLOWED_FILTER_FIELDS = ["name", "address", "tel"];
    const reqQuery = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (
        !key.startsWith("$") &&
        key !== "__proto__" &&
        ALLOWED_FILTER_FIELDS.includes(key)
      ) {
        reqQuery[key] = value;
      }
    }

    // Create query string
    let queryStr = JSON.stringify(reqQuery);
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`,
    );

    const parsedQuery = JSON.parse(queryStr);

    // Finding resource
    query = Provider.find(parsedQuery).populate("cars");

    // Select Fields
    if (req.query.select && typeof req.query.select === "string") {
      const fields = req.query.select.split(",").join(" ");
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort && typeof req.query.sort === "string") {
      const sortBy = req.query.sort.split(",").join(" ");
      query = query.sort(sortBy);
    } else {
      query = query.sort("-createdAt");
    }

    // Pagination with safe boundaries (cap limit between 1 and 50)
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const rawLimit = parseInt(req.query.limit, 10) || 25;
    const limit = Math.min(Math.max(rawLimit, 1), 50);
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Provider.countDocuments(parsedQuery);

    query = query.skip(startIndex).limit(limit);

    const providers = await query;

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

    const responsePayload = {
      success: true,
      count: providers.length,
      pagination,
      data: providers,
    };

    // Store in Redis with TTL
    await redisClient.set(cacheKey, responsePayload);

    res.status(200).json(responsePayload);
  } catch (err) {
    res.status(400).json({
      success: false,
      message: formatProviderError(err, req),
    });
  }
};

// @desc     Get single provider
// @route    GET /api/v1/providers/:id
// @access   Public
exports.getProvider = async (req, res, next) => {
  try {
    const cacheKey = `providers:single:${req.params.id}`;
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const provider = await Provider.findById(req.params.id).populate("cars");

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: `Provider not found with id of ${req.params.id}`,
      });
    }

    const responsePayload = { success: true, data: provider };
    await redisClient.set(cacheKey, responsePayload);

    res.status(200).json(responsePayload);
  } catch (err) {
    res.status(400).json({
      success: false,
      message: formatProviderError(err, req),
    });
  }
};

// @desc     Create new provider
// @route    POST /api/v1/providers
// @access   Private (Admin only)
exports.createProvider = async (req, res, next) => {
  try {
    const provider = await Provider.create(req.body);

    // Invalidate provider cache on creation
    await redisClient.clearPattern("providers:*");

    res.status(201).json({ success: true, data: provider });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: formatProviderError(err, req),
    });
  }
};

// @desc     Update single provider
// @route    PUT /api/v1/providers/:id
// @access   Private (Admin only)
exports.updateProvider = async (req, res, next) => {
  try {
    const provider = await Provider.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: "after",
      runValidators: true,
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: `Provider not found with id of ${req.params.id}`,
      });
    }

    // Invalidate provider cache on update
    await redisClient.clearPattern("providers:*");

    res.status(200).json({ success: true, data: provider });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: formatProviderError(err, req),
    });
  }
};

// @desc     Delete single provider
// @route    DELETE /api/v1/providers/:id
// @access   Private (Admin only)
exports.deleteProvider = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const provider = await Provider.findById(req.params.id).session(session);

    if (!provider) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: `Provider not found with id of ${req.params.id}`,
      });
    }

    // Cascade delete bookings, add-ons, and cars belonging to this provider atomically
    await Booking.deleteMany({ provider: req.params.id }, { session });
    await AddOn.deleteMany({ provider: req.params.id }, { session });
    await Car.deleteMany({ provider: req.params.id }, { session });
    await Provider.deleteOne({ _id: req.params.id }, { session });

    await session.commitTransaction();

    // Invalidate provider cache on deletion
    await redisClient.clearPattern("providers:*");

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({
      success: false,
      message: formatProviderError(err, req),
    });
  } finally {
    session.endSession();
  }
};

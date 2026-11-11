const Provider = require("../models/Provider");
const Car = require("../models/Car");
const Booking = require("../models/Booking");

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
  return err.message || "An unexpected error occurred";
};

// @desc     Get all providers
// @route    GET /api/v1/providers
// @access   Public
exports.getProviders = async (req, res, next) => {
  try {
    let query;

    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ["select", "sort", "page", "limit"];

    // Loop over remove fields and delete them from reqQuery
    removeFields.forEach((param) => delete reqQuery[param]);

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

    // Pagination with safe boundaries
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 25, 1);
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

    res.status(200).json({
      success: true,
      count: providers.length,
      pagination,
      data: providers,
    });
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
    const provider = await Provider.findById(req.params.id).populate("cars");

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: `Provider not found with id of ${req.params.id}`,
      });
    }

    res.status(200).json({ success: true, data: provider });
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
  try {
    const provider = await Provider.findById(req.params.id);

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: `Provider not found with id of ${req.params.id}`,
      });
    }

    // Cascade delete bookings and cars belonging to this provider
    await Booking.deleteMany({ provider: req.params.id });
    await Car.deleteMany({ provider: req.params.id });
    await Provider.deleteOne({ _id: req.params.id });

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: formatProviderError(err, req),
    });
  }
};

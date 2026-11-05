const AddOn = require('../models/AddOn');
const Provider = require('../models/Provider');

// Centralized error handler for add-on controllers
const handleAddOnError = (err, res, defaultMsg) => {
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
    return res.status(400).json({ success: false, message });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Resource not found with id of ${err.value}`,
    });
  }
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message:
        'Duplicate add-on: An add-on with this name already exists for this provider',
    });
  }
  return res.status(500).json({
    success: false,
    message: defaultMsg,
  });
};

// @desc      Get all add-ons
// @route     GET /api/v1/addons
// @access    Public
exports.getAddOns = async (req, res, next) => {
  try {
    const filter = { isAvailable: true };

    if (req.query.provider) {
      filter.provider = req.query.provider;
    }

    if (req.query.category) {
      filter.category = req.query.category;
    }

    const addOns = await AddOn.find(filter).populate({
      path: 'provider',
      select: 'name address tel',
    });

    res.status(200).json({
      success: true,
      count: addOns.length,
      data: addOns,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Cannot retrieve add-ons',
    });
  }
};

// @desc      Get single add-on
// @route     GET /api/v1/addons/:id
// @access    Public
exports.getAddOn = async (req, res, next) => {
  try {
    const addOn = await AddOn.findById(req.params.id).populate({
      path: 'provider',
      select: 'name address tel',
    });

    if (!addOn) {
      return res.status(404).json({
        success: false,
        message: `No add-on found with id of ${req.params.id}`,
      });
    }

    res.status(200).json({
      success: true,
      data: addOn,
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Resource not found with id of ${err.value}`,
      });
    }
    res.status(500).json({
      success: false,
      message: 'Cannot retrieve add-on',
    });
  }
};

// @desc      Create new add-on
// @route     POST /api/v1/addons
// @access    Private (Admin)
exports.createAddOn = async (req, res, next) => {
  try {
    // Prevent clients from overriding availableStock or manually setting allocatedStock
    delete req.body.availableStock;
    req.body.allocatedStock = 0;

    if (!req.body.provider) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid provider ID for the add-on',
      });
    }

    const provider = await Provider.findById(req.body.provider);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: `Provider not found with id of ${req.body.provider}`,
      });
    }

    const addOn = await AddOn.create(req.body);

    res.status(201).json({
      success: true,
      data: addOn,
    });
  } catch (err) {
    handleAddOnError(err, res, 'Cannot create add-on');
  }
};

// @desc      Update add-on
// @route     PUT /api/v1/addons/:id
// @access    Private (Admin)
exports.updateAddOn = async (req, res, next) => {
  try {
    const addOn = await AddOn.findById(req.params.id);
    if (!addOn) {
      return res.status(404).json({
        success: false,
        message: `No add-on found with id of ${req.params.id}`,
      });
    }

    // Never allow direct manual override of availableStock or allocatedStock
    delete req.body.availableStock;
    delete req.body.allocatedStock;

    // If provider is updated, verify it exists
    if (req.body.provider) {
      const providerExists = await Provider.findById(req.body.provider);
      if (!providerExists) {
        return res.status(404).json({
          success: false,
          message: `Provider not found with id of ${req.body.provider}`,
        });
      }
    }

    // Apply updates and invoke Mongoose pre-save hooks and validations
    addOn.set(req.body);
    await addOn.save();

    res.status(200).json({
      success: true,
      data: addOn,
    });
  } catch (err) {
    handleAddOnError(err, res, 'Cannot update add-on');
  }
};

// @desc      Delete add-on
// @route     DELETE /api/v1/addons/:id
// @access    Private (Admin)
exports.deleteAddOn = async (req, res, next) => {
  try {
    const addOn = await AddOn.findById(req.params.id);
    if (!addOn) {
      return res.status(404).json({
        success: false,
        message: `No add-on found with id of ${req.params.id}`,
      });
    }

    await addOn.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Resource not found with id of ${err.value}`,
      });
    }
    res.status(500).json({
      success: false,
      message: 'Cannot delete add-on',
    });
  }
};

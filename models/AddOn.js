const mongoose = require('mongoose');

const AddOnSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add an add-on name'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    category: {
      type: String,
      required: [true, 'Please add an add-on category'],
      enum: {
        values: ['Equipment', 'Child Safety', 'Connectivity', 'Accessory'],
        message: '{VALUE} is not a valid add-on category',
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    dailyRate: {
      type: Number,
      required: [true, 'Please add a daily rental rate for this add-on'],
      min: [0, 'Daily rate cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Daily rate must be an integer in Satang',
      },
      // Stored as an Integer in Satang (Fixed-point arithmetic ADR 0001)
    },
    inventoryStock: {
      type: Number,
      required: [true, 'Please specify total inventory stock'],
      min: [0, 'Inventory stock cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Inventory stock must be an integer',
      },
    },
    allocatedStock: {
      type: Number,
      default: 0,
      min: [0, 'Allocated stock cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Allocated stock must be an integer',
      },
    },
    availableStock: {
      type: Number,
      min: [0, 'Available stock cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Available stock must be an integer',
      },
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    provider: {
      type: mongoose.Schema.ObjectId,
      ref: 'Provider',
      required: [true, 'Please specify the rental provider for this add-on'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-save hook: auto-compute availableStock = inventoryStock - allocatedStock
AddOnSchema.pre('save', function () {
  const currentAllocated = this.allocatedStock || 0;
  if (this.inventoryStock < currentAllocated) {
    const validationError = new mongoose.Error.ValidationError(this);
    validationError.errors.inventoryStock = new mongoose.Error.ValidatorError({
      message: 'Inventory stock cannot be less than allocated stock',
      path: 'inventoryStock',
      value: this.inventoryStock,
    });
    throw validationError;
  }
  this.availableStock = this.inventoryStock - currentAllocated;
});

// Compound Indexes for fast provider inventory queries & concurrency checks
AddOnSchema.index({ provider: 1, isAvailable: 1, availableStock: 1 });
AddOnSchema.index({ name: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('AddOn', AddOnSchema);

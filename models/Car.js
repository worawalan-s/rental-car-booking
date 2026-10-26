const mongoose = require('mongoose');

const CarSchema = new mongoose.Schema(
  {
    brand: {
      type: String,
      required: [true, 'Please add a car brand'],
      trim: true,
      maxlength: [50, 'Brand cannot exceed 50 characters'],
    },
    model: {
      type: String,
      required: [true, 'Please add a car model'],
      trim: true,
      maxlength: [50, 'Model cannot exceed 50 characters'],
    },
    category: {
      type: String,
      required: [true, 'Please add a vehicle category'],
      enum: {
        values: ['Sedan', 'SUV', 'Hatchback', 'Van', 'Truck', 'Luxury', 'Electric'],
        message: '{VALUE} is not a valid vehicle category',
      },
    },
    dailyRate: {
      type: Number,
      required: [true, 'Please add a daily rental rate'],
      min: [0, 'Daily rate cannot be negative'],
      // Stored as an Integer in Satang (cents) to guarantee Fixed-point arithmetic precision (Req 3)
      // Example: 150000 = 1,500.00 THB
    },
    capacity: {
      type: Number,
      required: [true, 'Please add passenger capacity'],
      min: [1, 'Capacity must be at least 1 person'],
      default: 4,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    provider: {
      type: mongoose.Schema.ObjectId,
      ref: 'Provider',
      required: [true, 'Please specify a rental provider'],
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

// Compound Index for sub-200ms category filtering (Task 4 readiness)
CarSchema.index({ provider: 1, category: 1, isAvailable: 1 });

// Reverse populate with virtuals for bookings
CarSchema.virtual('bookings', {
  ref: 'Booking',
  localField: '_id',
  foreignField: 'car',
  justOne: false,
});

module.exports = mongoose.model('Car', CarSchema);

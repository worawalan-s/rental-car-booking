const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Please specify the booking user'],
  },
  car: {
    type: mongoose.Schema.ObjectId,
    ref: 'Car',
    required: [true, 'Please specify the rented car'],
  },
  provider: {
    type: mongoose.Schema.ObjectId,
    ref: 'Provider',
    required: [true, 'Please specify the provider'],
  },
  startDate: {
    type: Date,
    required: [true, 'Please specify the rental start date'],
  },
  endDate: {
    type: Date,
    required: [true, 'Please specify the rental return date'],
  },
  numOfCars: {
    type: Number,
    required: [true, 'Please specify number of cars'],
    default: 1,
    min: [1, 'Number of cars must be at least 1'],
    max: [3, 'Number of cars cannot exceed 3 per booking'], // Quota rule
  },
  status: {
    type: String,
    enum: {
      values: ['Pending', 'Confirmed', 'Active', 'Completed', 'Cancelled'],
      message: '{VALUE} is not a valid booking status',
    },
    default: 'Pending',
  },
  totalPrice: {
    type: Number,
    default: 0,
    min: [0, 'Total price cannot be negative'],
    // Stored as Integer in Satang (cents) for Fixed-point arithmetic precision (Req 3)
  },
  addOns: [
    {
      addOn: {
        type: mongoose.Schema.ObjectId,
        ref: 'AddOn',
      },
      quantity: {
        type: Number,
        default: 1,
        min: [1, 'Add-on quantity must be at least 1'],
      },
      price: {
        type: Number,
        default: 0, // In Satang
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound indexes for user quota checks and car availability verification
BookingSchema.index({ user: 1, status: 1 });
BookingSchema.index({ car: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('Booking', BookingSchema);

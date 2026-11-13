const mongoose = require('mongoose');

const ProviderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a provider name'],
      unique: true,
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    address: {
      type: String,
      required: [true, 'Please add an address'],
    },
    tel: {
      type: String,
      required: [true, 'Please add a telephone number'],
      trim: true,
      match: [
        /^0[0-9]{9}$/,
        'Please add a valid 10-digit Thai phone number (0xxxxxxxxx)',
      ],
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

// Reverse populate with virtuals for cars
ProviderSchema.virtual('cars', {
  ref: 'Car',
  localField: '_id',
  foreignField: 'provider',
  justOne: false,
});

module.exports = mongoose.model('Provider', ProviderSchema);

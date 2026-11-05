const AddOn = require('../models/AddOn');

/**
 * Releases allocated stock for physical add-ons in an active booking.
 * Can execute within an optional Mongoose transaction session.
 *
 * @param {Object} booking - The booking document containing status and addOns
 * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session
 */
const releaseBookingAddOns = async (booking, session = null) => {
  if (
    !booking ||
    !['Pending', 'Confirmed', 'Active'].includes(booking.status) ||
    !Array.isArray(booking.addOns) ||
    booking.addOns.length === 0
  ) {
    return;
  }

  for (const item of booking.addOns) {
    if (item.addOn && item.quantity) {
      const options = session ? { session } : {};
      await AddOn.findByIdAndUpdate(
        item.addOn,
        {
          $inc: {
            allocatedStock: -item.quantity,
            availableStock: item.quantity,
          },
        },
        options
      );
    }
  }
};

module.exports = {
  releaseBookingAddOns,
};

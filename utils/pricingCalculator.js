/**
 * Calculates baseline total rental price in Satang (fixed-point integer).
 * Formula: (dailyRate * durationDays * numOfCars) + addOnsTotal
 *
 * Note: This is a baseline pricing calculator for Task 6.
 * In Task 5 (Pricing Engine), this will be extended with VAT 7%, platform fees,
 * and structured itemized breakdowns.
 *
 * @param {Object} params
 * @param {number} params.dailyRate - Daily rate in Satang
 * @param {number} params.durationDays - Rental duration in days
 * @param {number} [params.numOfCars=1] - Number of cars booked
 * @param {Array} [params.addOns=[]] - Array of add-ons { price, quantity }
 * @returns {number} Total price in Satang
 */
const calculateBaselinePrice = ({
  dailyRate,
  durationDays,
  numOfCars = 1,
  addOns = [],
}) => {
  const rentalBase = durationDays * dailyRate * numOfCars;
  const addOnsTotal = Array.isArray(addOns)
    ? addOns.reduce(
        (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
        0
      )
    : 0;

  return rentalBase + addOnsTotal;
};

module.exports = {
  calculateBaselinePrice,
};

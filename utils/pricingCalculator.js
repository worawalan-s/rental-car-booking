/**
 * Calculates rental duration in days (minimum 1 day for same-day rentals).
 *
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @returns {number} Duration in days
 */
const calculateDurationDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
};

/**
 * Calculates baseline total rental price in Satang (fixed-point integer).
 * Formula: (dailyRate * durationDays * numOfCars) + addOnsTotal
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
        (sum, item) =>
          sum + (item.price || 0) * (item.quantity || 1) * durationDays,
        0
      )
    : 0;

  return rentalBase + addOnsTotal;
};

/**
 * Calculates deterministic pricing breakdown using pure integer Satang fixed-point arithmetic.
 * Zero IEEE 754 floating-point drift.
 *
 * Formula:
 * - durationDays = Math.max(1, ceil((endDate - startDate) / 1 day))
 * - rentalBase = dailyRate * durationDays * numOfCars
 * - addOnsTotal = sum(addOn.price * addOn.quantity * durationDays)
 * - subtotal = rentalBase + addOnsTotal
 * - vat = Math.round(subtotal * 7 / 100) (VAT 7% rounded to nearest Satang)
 * - total = subtotal + vat
 *
 * @param {Object} params
 * @param {number} params.dailyRate - Daily rate in Satang (integer)
 * @param {Date|string} params.startDate - Rental pickup date
 * @param {Date|string} params.endDate - Rental return date
 * @param {number} [params.numOfCars=1] - Number of vehicles (1-3)
 * @param {Array} [params.addOns=[]] - Optional add-on items [{ price, quantity }]
 * @returns {Object} Complete pricing calculation breakdown in Satang
 */
const calculatePricing = ({
  dailyRate,
  startDate,
  endDate,
  numOfCars = 1,
  addOns = [],
}) => {
  // Validate dailyRate
  if (
    typeof dailyRate !== 'number' ||
    !Number.isInteger(dailyRate) ||
    dailyRate < 0
  ) {
    throw new Error('Daily rate must be a non-negative integer in Satang');
  }

  // Validate dates
  if (!startDate || !endDate) {
    throw new Error('Please provide valid start and end dates');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Please provide valid start and end dates');
  }

  if (end.getTime() < start.getTime()) {
    throw new Error('Rental return date cannot be before start date');
  }

  // Validate numOfCars
  const carsCount = parseInt(numOfCars, 10) || 1;
  if (carsCount < 1 || carsCount > 3) {
    throw new Error('Number of cars must be between 1 and 3');
  }

  // Duration in days (minimum 1 day for same-day rental)
  const durationDays = calculateDurationDays(startDate, endDate);

  // Rental base charge: dailyRate * durationDays * numOfCars
  const rentalBase = dailyRate * durationDays * carsCount;

  // Add-ons total calculation (daily add-on rate * quantity * durationDays)
  let addOnsTotal = 0;
  const addOnsBreakdown = [];

  if (Array.isArray(addOns)) {
    for (const item of addOns) {
      const price = parseInt(item.price, 10) || 0;
      const quantity = parseInt(item.quantity, 10) || 1;

      if (price < 0 || quantity < 1) {
        throw new Error(
          'Add-on quantity must be at least 1 and price cannot be negative'
        );
      }

      const itemTotal = price * quantity * durationDays;
      addOnsTotal += itemTotal;

      addOnsBreakdown.push({
        ...(item.addOn ? { addOn: item.addOn } : {}),
        price,
        quantity,
        durationDays,
        total: itemTotal,
      });
    }
  }

  // Subtotal before tax
  const subtotal = rentalBase + addOnsTotal;

  // VAT 7% integer rounding in Satang
  // e.g. subtotal = 100000 (1,000 THB) -> vat = 7000 (70 THB)
  const vatRate = 0.07;
  const vat = Math.round((subtotal * 7) / 100);

  // Grand total
  const total = subtotal + vat;

  return {
    durationDays,
    dailyRate,
    numOfCars: carsCount,
    rentalBase,
    addOnsTotal,
    addOnsBreakdown,
    subtotal,
    vatRate,
    vat,
    total,
    totalPrice: total,
  };
};

module.exports = {
  calculateDurationDays,
  calculateBaselinePrice,
  calculatePricing,
};

const { calculateDurationDays } = require('./date');

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
 * @param {number} params.dailyRate - Daily rate in Satang (integer >= 1)
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
  // Validate dailyRate: strictly positive integer in Satang (min: 1)
  if (
    typeof dailyRate !== 'number' ||
    !Number.isInteger(dailyRate) ||
    dailyRate < 1
  ) {
    const err = new Error(
      'Daily rate must be a positive integer in Satang (min: 1)'
    );
    err.statusCode = 400;
    throw err;
  }

  // Validate dates
  if (!startDate || !endDate) {
    const err = new Error('Please provide valid start and end dates');
    err.statusCode = 400;
    throw err;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const err = new Error('Please provide valid start and end dates');
    err.statusCode = 400;
    throw err;
  }

  if (end.getTime() < start.getTime()) {
    const err = new Error('Rental return date cannot be before start date');
    err.statusCode = 400;
    throw err;
  }

  // Duration in days (minimum 1 day for same-day rental via shared utils/date)
  const durationDays = calculateDurationDays(startDate, endDate);

  // Validate duration limit (max 30 days)
  if (durationDays > 30) {
    const err = new Error('Rental duration cannot exceed 30 days per booking');
    err.statusCode = 400;
    throw err;
  }

  // Validate numOfCars strictly without || 1 fallback bypassing validation
  let carsCount = 1;
  if (numOfCars !== undefined && numOfCars !== null) {
    if (typeof numOfCars === 'string') {
      if (!/^\d+$/.test(numOfCars.trim())) {
        const err = new Error(
          'Number of cars must be an integer between 1 and 3'
        );
        err.statusCode = 400;
        throw err;
      }
      carsCount = parseInt(numOfCars.trim(), 10);
    } else if (typeof numOfCars === 'number' && Number.isInteger(numOfCars)) {
      carsCount = numOfCars;
    } else {
      const err = new Error(
        'Number of cars must be an integer between 1 and 3'
      );
      err.statusCode = 400;
      throw err;
    }

    if (carsCount < 1 || carsCount > 3) {
      const err = new Error(
        'Number of cars must be an integer between 1 and 3'
      );
      err.statusCode = 400;
      throw err;
    }
  }

  // Rental base charge: dailyRate * durationDays * numOfCars
  const rentalBase = dailyRate * durationDays * carsCount;

  // Add-ons total calculation (daily add-on rate * quantity * durationDays)
  let addOnsTotal = 0;
  const addOnsBreakdown = [];

  if (Array.isArray(addOns)) {
    for (const item of addOns) {
      if (!item || typeof item !== 'object') {
        const err = new Error('Each addOn item must be an object');
        err.statusCode = 400;
        throw err;
      }

      // Validate price strictly: required non-negative integer Satang
      let price;
      if (item.price === undefined || item.price === null) {
        const err = new Error(
          'Each addOn item must specify a non-negative integer price in Satang'
        );
        err.statusCode = 400;
        throw err;
      }
      if (typeof item.price === 'string') {
        if (!/^\d+$/.test(item.price.trim())) {
          const err = new Error(
            'AddOn price must be a non-negative integer in Satang'
          );
          err.statusCode = 400;
          throw err;
        }
        price = parseInt(item.price.trim(), 10);
      } else if (
        typeof item.price === 'number' &&
        Number.isInteger(item.price) &&
        item.price >= 0
      ) {
        price = item.price;
      } else {
        const err = new Error(
          'AddOn price must be a non-negative integer in Satang'
        );
        err.statusCode = 400;
        throw err;
      }

      // Validate quantity strictly: default 1, but if provided must be >= 1 without || 1 bypass
      let quantity = 1;
      if (item.quantity !== undefined && item.quantity !== null) {
        if (typeof item.quantity === 'string') {
          if (!/^\d+$/.test(item.quantity.trim())) {
            const err = new Error(
              'AddOn quantity must be an integer of at least 1'
            );
            err.statusCode = 400;
            throw err;
          }
          quantity = parseInt(item.quantity.trim(), 10);
        } else if (
          typeof item.quantity === 'number' &&
          Number.isInteger(item.quantity)
        ) {
          quantity = item.quantity;
        } else {
          const err = new Error(
            'AddOn quantity must be an integer of at least 1'
          );
          err.statusCode = 400;
          throw err;
        }

        if (quantity < 1) {
          const err = new Error(
            'AddOn quantity must be an integer of at least 1'
          );
          err.statusCode = 400;
          throw err;
        }
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

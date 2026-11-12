/**
 * Calculates total reserved cars across active booking documents.
 * Formula: sum(b.numOfCars || 1)
 *
 * @param {Array} bookings - Array of booking documents
 * @returns {number} Cumulative active cars sum
 */
const calculateActiveCars = (bookings) => {
  if (!Array.isArray(bookings)) return 0;
  return bookings.reduce((total, b) => total + (b.numOfCars || 1), 0);
};

/**
 * Checks if adding requested cars exceeds the 3-car quota limit (AGENTS.md Invariant 4).
 * Pure boolean evaluator: returns true if (activeCars + requestedCars) > 3.
 *
 * @param {number} currentActiveCars - Current active cars reserved
 * @param {number} [requestedCars=1] - Number of cars requested
 * @returns {boolean} True if total active cars exceed 3
 */
const isQuotaExceeded = (currentActiveCars, requestedCars = 1) => {
  const active =
    typeof currentActiveCars === 'number' && currentActiveCars >= 0
      ? currentActiveCars
      : 0;
  const requested =
    typeof requestedCars === 'number' && requestedCars >= 1
      ? requestedCars
      : 1;

  return active + requested > 3;
};

module.exports = {
  calculateActiveCars,
  isQuotaExceeded,
};

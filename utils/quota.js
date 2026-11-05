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

module.exports = {
  calculateActiveCars,
};

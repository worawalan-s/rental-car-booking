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
  return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
};

module.exports = {
  calculateDurationDays,
};

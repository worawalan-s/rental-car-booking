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

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Please provide valid start and end dates');
  }

  if (end.getTime() < start.getTime()) {
    throw new Error('Rental return date cannot be before start date');
  }

  return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
};

/**
 * Checks if two booking intervals overlap (AGENTS.md Invariant 5).
 * Formula: (existingStart < newEnd) && (existingEnd > newStart)
 *
 * @param {Object} existingInterval - Existing booking interval { startDate, endDate }
 * @param {Object} newInterval - New booking interval { startDate, endDate }
 * @returns {boolean} True if schedules overlap
 */
const hasScheduleOverlap = (existingInterval, newInterval) => {
  if (!existingInterval || !newInterval) {
    return false;
  }

  const existingStart = new Date(existingInterval.startDate).getTime();
  const existingEnd = new Date(existingInterval.endDate).getTime();
  const newStart = new Date(newInterval.startDate).getTime();
  const newEnd = new Date(newInterval.endDate).getTime();

  if (
    isNaN(existingStart) ||
    isNaN(existingEnd) ||
    isNaN(newStart) ||
    isNaN(newEnd)
  ) {
    return false;
  }

  // Standard Schedule Collision Formula (AGENTS.md Invariant 5):
  // Existing startDate < newEndDate AND Existing endDate > newStartDate
  return existingStart < newEnd && existingEnd > newStart;
};

module.exports = {
  calculateDurationDays,
  hasScheduleOverlap,
};

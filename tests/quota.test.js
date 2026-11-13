const {
  calculateActiveCars,
  isQuotaExceeded,
} = require('../utils/quota');

describe('Booking Quota Unit Tests (3-Car Cumulative Limit - Invariant 4)', () => {
  describe('calculateActiveCars', () => {
    it('should return 0 when bookings argument is null, undefined, or not an array', () => {
      expect(calculateActiveCars(null)).toBe(0);
      expect(calculateActiveCars(undefined)).toBe(0);
      expect(calculateActiveCars('invalid')).toBe(0);
      expect(calculateActiveCars(123)).toBe(0);
      expect(calculateActiveCars({})).toBe(0);
    });

    it('should return 0 for an empty bookings array', () => {
      expect(calculateActiveCars([])).toBe(0);
    });

    it('should calculate sum correctly with explicit numOfCars on bookings', () => {
      const bookings = [
        { _id: '1', numOfCars: 1 },
        { _id: '2', numOfCars: 2 },
      ];
      expect(calculateActiveCars(bookings)).toBe(3);
    });

    it('should default to 1 car per booking document if numOfCars is omitted or 0', () => {
      const bookings = [
        { _id: '1' }, // Missing numOfCars defaults to 1
        { _id: '2', numOfCars: 0 }, // 0 defaults to 1
        { _id: '3', numOfCars: 2 },
      ];
      expect(calculateActiveCars(bookings)).toBe(4);
    });
  });

  describe('isQuotaExceeded (Boundary Value Analysis)', () => {
    // Equivalence Partitioning & BVA:
    // Total cars = currentActiveCars + requestedCars
    // Boundary 1 (Min): 0 active + 1 requested = 1 (valid, false)
    // Boundary 2 (Nominal): 1 active + 1 requested = 2 (valid, false)
    // Boundary 3 (Max limit): 2 active + 1 requested = 3 (valid, false)
    // Boundary 4 (Max limit): 0 active + 3 requested = 3 (valid, false)
    // Boundary 5 (Exceeded): 3 active + 1 requested = 4 (exceeded, true)
    // Boundary 6 (Exceeded): 2 active + 2 requested = 4 (exceeded, true)
    // Boundary 7 (Exceeded): 1 active + 3 requested = 4 (exceeded, true)

    it('should return false when total cars <= 3', () => {
      expect(isQuotaExceeded(0, 1)).toBe(false);
      expect(isQuotaExceeded(1, 1)).toBe(false);
      expect(isQuotaExceeded(2, 1)).toBe(false);
      expect(isQuotaExceeded(0, 3)).toBe(false);
      expect(isQuotaExceeded(1, 2)).toBe(false);
    });

    it('should return true when total cars exceed 3', () => {
      expect(isQuotaExceeded(3, 1)).toBe(true);
      expect(isQuotaExceeded(2, 2)).toBe(true);
      expect(isQuotaExceeded(1, 3)).toBe(true);
      expect(isQuotaExceeded(3, 3)).toBe(true);
    });

    it('should default to requestedCars=1', () => {
      // 2 active + default 1 requested = 3 (false)
      expect(isQuotaExceeded(2)).toBe(false);
      // 3 active + default 1 requested = 4 (true)
      expect(isQuotaExceeded(3)).toBe(true);
      // negative or invalid activeCars defaults to 0 safely
      expect(isQuotaExceeded(-5)).toBe(false);
      expect(isQuotaExceeded(null)).toBe(false);
    });

    it('should handle non-number or out-of-bound inputs safely as boolean without throwing', () => {
      // requestedCars defaults safely to 1 if <= 0 or invalid
      expect(isQuotaExceeded(2, 0)).toBe(false); // 2 + 1 = 3 (false)
      expect(isQuotaExceeded(3, 0)).toBe(true); // 3 + 1 = 4 (true)
      expect(isQuotaExceeded(2, null)).toBe(false);
      expect(isQuotaExceeded(3, null)).toBe(true);
    });
  });
});

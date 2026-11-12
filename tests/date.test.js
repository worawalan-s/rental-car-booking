const {
  calculateDurationDays,
  hasScheduleOverlap,
} = require('../utils/date');

describe('Date Utilities & Schedule Collision Unit Tests (Invariant 5 & 6)', () => {
  describe('calculateDurationDays (Invariant 6: Same-Day Rental)', () => {
    it('should return 1 for exact same day rentals', () => {
      expect(calculateDurationDays('2026-06-01', '2026-06-01')).toBe(1);
      expect(calculateDurationDays('2026-12-31', '2026-12-31')).toBe(1);
    });

    it('should calculate 1 day for 24-hour difference', () => {
      expect(
        calculateDurationDays('2026-06-01T10:00:00Z', '2026-06-02T10:00:00Z')
      ).toBe(1);
    });

    it('should calculate multiple full days correctly', () => {
      expect(calculateDurationDays('2026-06-01', '2026-06-08')).toBe(7);
      expect(calculateDurationDays('2026-06-01', '2026-06-15')).toBe(14);
      expect(calculateDurationDays('2026-06-01', '2026-07-01')).toBe(30);
    });

    it('should handle leap years accurately (Feb 29 exists in 2024)', () => {
      expect(calculateDurationDays('2024-02-28', '2024-03-01')).toBe(2);
      expect(calculateDurationDays('2025-02-28', '2025-03-01')).toBe(1);
    });

    it('should throw an Error when return date is before start date', () => {
      expect(() => calculateDurationDays('2026-06-05', '2026-06-01')).toThrow(
        'Rental return date cannot be before start date'
      );
    });

    it('should throw an Error when date arguments are invalid or missing', () => {
      expect(() => calculateDurationDays('', '2026-06-01')).toThrow(
        'Please provide valid start and end dates'
      );
      expect(() => calculateDurationDays('2026-06-01', 'not-a-date')).toThrow(
        'Please provide valid start and end dates'
      );
    });
  });

  describe('hasScheduleOverlap (Invariant 5: Schedule Collision Formula)', () => {
    // Formula: existingStart < newEnd AND existingEnd > newStart
    const existing = {
      startDate: '2026-06-10',
      endDate: '2026-06-15',
    };

    it('should return false when new booking is completely before existing (No Overlap)', () => {
      const newBooking = { startDate: '2026-06-01', endDate: '2026-06-05' };
      expect(hasScheduleOverlap(existing, newBooking)).toBe(false);
    });

    it('should return false when new booking ends exactly when existing starts (Adjacent Before)', () => {
      const newBooking = { startDate: '2026-06-05', endDate: '2026-06-10' };
      expect(hasScheduleOverlap(existing, newBooking)).toBe(false);
    });

    it('should return false when new booking starts exactly when existing ends (Adjacent After)', () => {
      const newBooking = { startDate: '2026-06-15', endDate: '2026-06-20' };
      expect(hasScheduleOverlap(existing, newBooking)).toBe(false);
    });

    it('should return false when new booking is completely after existing (No Overlap)', () => {
      const newBooking = { startDate: '2026-06-20', endDate: '2026-06-25' };
      expect(hasScheduleOverlap(existing, newBooking)).toBe(false);
    });

    it('should return true when new booking overlaps on the start boundary (Front Collision)', () => {
      const newBooking = { startDate: '2026-06-08', endDate: '2026-06-12' };
      expect(hasScheduleOverlap(existing, newBooking)).toBe(true);
    });

    it('should return true when new booking overlaps on the rear boundary (Back Collision)', () => {
      const newBooking = { startDate: '2026-06-13', endDate: '2026-06-18' };
      expect(hasScheduleOverlap(existing, newBooking)).toBe(true);
    });

    it('should return true when new booking is completely inside existing (Internal Collision)', () => {
      const newBooking = { startDate: '2026-06-11', endDate: '2026-06-14' };
      expect(hasScheduleOverlap(existing, newBooking)).toBe(true);
    });

    it('should return true when new booking completely engulfs existing (Enclosing Collision)', () => {
      const newBooking = { startDate: '2026-06-05', endDate: '2026-06-20' };
      expect(hasScheduleOverlap(existing, newBooking)).toBe(true);
    });

    it('should return true for identical dates (Exact Match Collision)', () => {
      expect(hasScheduleOverlap(existing, existing)).toBe(true);
    });

    it('should detect collision when an intermediate booking falls within a multi-day rental', () => {
      const multiDay = { startDate: '2026-06-01', endDate: '2026-06-05' };
      const intermediateInside = {
        startDate: '2026-06-02',
        endDate: '2026-06-04',
      };
      expect(hasScheduleOverlap(multiDay, intermediateInside)).toBe(true);
      expect(hasScheduleOverlap(intermediateInside, multiDay)).toBe(true);
    });

    it('should symmetrically allow adjacent handovers on return date (no collision)', () => {
      const multiDay = { startDate: '2026-06-01', endDate: '2026-06-05' };
      const adjacentNext = {
        startDate: '2026-06-05',
        endDate: '2026-06-10',
      };
      // Overlap must be symmetric: existing.end === new.start -> no overlap
      expect(hasScheduleOverlap(multiDay, adjacentNext)).toBe(false);
      expect(hasScheduleOverlap(adjacentNext, multiDay)).toBe(false);
    });

    it('should return false if either interval is null, undefined, or contains invalid dates', () => {
      expect(hasScheduleOverlap(null, existing)).toBe(false);
      expect(hasScheduleOverlap(existing, null)).toBe(false);
      expect(hasScheduleOverlap(undefined, undefined)).toBe(false);
      expect(
        hasScheduleOverlap({ startDate: 'invalid' }, { startDate: '2026-06-01' })
      ).toBe(false);
    });
  });
});

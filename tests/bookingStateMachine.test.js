const mongoose = require('mongoose');
const {
  BOOKING_STATUS,
  ALLOWED_STATUS_TRANSITIONS,
  TERMINAL_STATUSES,
  isValidStatus,
  isTerminalStatus,
  isActiveStatus,
  isValidStatusTransition,
  validateStatusTransition,
} = require('../utils/bookingStateMachine');
const { calculateActiveCars, isQuotaExceeded } = require('../utils/quota');
const { releaseBookingAddOns } = require('../utils/bookingInventory');
const { updateBooking } = require('../controllers/bookings');
const Booking = require('../models/Booking');
const User = require('../models/User');

jest.mock('../utils/bookingInventory', () => ({
  releaseBookingAddOns: jest.fn().mockResolvedValue(),
}));

describe('Task 15: Booking State Machine & Transition Invariants Suite (#22)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. State Machine Transition Table & Pure Validation Logic', () => {
    it('should define the 5 standard booking statuses', () => {
      expect(BOOKING_STATUS.PENDING).toBe('Pending');
      expect(BOOKING_STATUS.CONFIRMED).toBe('Confirmed');
      expect(BOOKING_STATUS.ACTIVE).toBe('Active');
      expect(BOOKING_STATUS.COMPLETED).toBe('Completed');
      expect(BOOKING_STATUS.CANCELLED).toBe('Cancelled');
    });

    it('should allow valid forward transitions', () => {
      // Pending -> Confirmed, Cancelled
      expect(isValidStatusTransition('Pending', 'Confirmed')).toBe(true);
      expect(isValidStatusTransition('Pending', 'Cancelled')).toBe(true);

      // Confirmed -> Active, Cancelled
      expect(isValidStatusTransition('Confirmed', 'Active')).toBe(true);
      expect(isValidStatusTransition('Confirmed', 'Cancelled')).toBe(true);

      // Active -> Completed, Cancelled
      expect(isValidStatusTransition('Active', 'Completed')).toBe(true);
      expect(isValidStatusTransition('Active', 'Cancelled')).toBe(true);

      // Idempotent (same status)
      expect(isValidStatusTransition('Pending', 'Pending')).toBe(true);
      expect(isValidStatusTransition('Confirmed', 'Confirmed')).toBe(true);
      expect(isValidStatusTransition('Active', 'Active')).toBe(true);
    });

    it('should reject illegal status regressions and skips', () => {
      // Regressions
      expect(isValidStatusTransition('Confirmed', 'Pending')).toBe(false);
      expect(isValidStatusTransition('Active', 'Pending')).toBe(false);
      expect(isValidStatusTransition('Active', 'Confirmed')).toBe(false);

      // Skips
      expect(isValidStatusTransition('Pending', 'Active')).toBe(false);
      expect(isValidStatusTransition('Pending', 'Completed')).toBe(false);
      expect(isValidStatusTransition('Confirmed', 'Completed')).toBe(false);

      // From Terminal States
      expect(isValidStatusTransition('Completed', 'Pending')).toBe(false);
      expect(isValidStatusTransition('Completed', 'Active')).toBe(false);
      expect(isValidStatusTransition('Completed', 'Cancelled')).toBe(false);
      expect(isValidStatusTransition('Completed', 'Completed')).toBe(false);
      expect(isValidStatusTransition('Cancelled', 'Cancelled')).toBe(false);
      expect(isValidStatusTransition('Cancelled', 'Pending')).toBe(false);
      expect(isValidStatusTransition('Cancelled', 'Confirmed')).toBe(false);
    });

    it('should classify terminal and active states correctly', () => {
      expect(isTerminalStatus('Completed')).toBe(true);
      expect(isTerminalStatus('Cancelled')).toBe(true);
      expect(isTerminalStatus('Pending')).toBe(false);
      expect(isTerminalStatus('Confirmed')).toBe(false);
      expect(isTerminalStatus('Active')).toBe(false);

      expect(isActiveStatus('Pending')).toBe(true);
      expect(isActiveStatus('Confirmed')).toBe(true);
      expect(isActiveStatus('Active')).toBe(true);
      expect(isActiveStatus('Completed')).toBe(false);
      expect(isActiveStatus('Cancelled')).toBe(false);
    });

    it('should provide informative error messages from validateStatusTransition', () => {
      const invalidStatusRes = validateStatusTransition('Pending', 'UnknownStatus');
      expect(invalidStatusRes.isValid).toBe(false);
      expect(invalidStatusRes.error).toBe("'UnknownStatus' is not a valid booking status");

      const terminalModRes = validateStatusTransition('Completed', 'Pending');
      expect(terminalModRes.isValid).toBe(false);
      expect(terminalModRes.error).toBe("Cannot modify booking with terminal status of 'Completed'");

      const terminalSelfModRes = validateStatusTransition('Completed', 'Completed');
      expect(terminalSelfModRes.isValid).toBe(false);
      expect(terminalSelfModRes.error).toBe("Cannot modify booking with terminal status of 'Completed'");

      const regressionRes = validateStatusTransition('Active', 'Pending');
      expect(regressionRes.isValid).toBe(false);
      expect(regressionRes.error).toBe("Cannot transition booking status from 'Active' to 'Pending'");
    });
  });

  describe('2. Controller updateBooking State Machine Enforcement', () => {
    let mockSession;
    let mockReq;
    let mockRes;
    let jsonResponse;
    let statusCode;

    beforeEach(() => {
      jsonResponse = null;
      statusCode = null;
      mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);

      mockRes = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => {
              jsonResponse = data;
            },
          };
        },
      };
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should reject modification if booking is already in a terminal state (Completed/Cancelled)', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const mockBooking = {
        _id: new mongoose.Types.ObjectId(),
        user: userId,
        status: 'Completed',
        startDate: new Date('2026-12-01'),
        endDate: new Date('2026-12-05'),
      };

      jest.spyOn(Booking, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      mockReq = {
        params: { id: mockBooking._id.toString() },
        user: { id: userId, role: 'admin' },
        body: { status: 'Pending' },
      };

      await updateBooking(mockReq, mockRes);

      expect(statusCode).toBe(400);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.message).toBe("Cannot modify booking with terminal status of 'Completed'");
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it('should prevent regular user from updating status to anything other than Cancelled', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const mockBooking = {
        _id: new mongoose.Types.ObjectId(),
        user: userId,
        status: 'Pending',
        startDate: new Date('2026-12-01'),
        endDate: new Date('2026-12-05'),
      };

      jest.spyOn(Booking, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      mockReq = {
        params: { id: mockBooking._id.toString() },
        user: { id: userId, role: 'user' },
        body: { status: 'Confirmed' }, // User trying to self-confirm
      };

      await updateBooking(mockReq, mockRes);

      expect(statusCode).toBe(403);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.message).toBe('Only admins can update booking status to values other than Cancelled');
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it('should reject illegal status regression (Active -> Pending) with 400', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const mockBooking = {
        _id: new mongoose.Types.ObjectId(),
        user: userId,
        status: 'Active',
        startDate: new Date('2026-12-01'),
        endDate: new Date('2026-12-05'),
      };

      jest.spyOn(Booking, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      mockReq = {
        params: { id: mockBooking._id.toString() },
        user: { id: userId, role: 'admin' },
        body: { status: 'Pending' },
      };

      await updateBooking(mockReq, mockRes);

      expect(statusCode).toBe(400);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.message).toBe("Cannot transition booking status from 'Active' to 'Pending'");
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it('should release add-ons and commit when transitioning to terminal status Cancelled', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const mockBooking = {
        _id: new mongoose.Types.ObjectId(),
        user: userId,
        status: 'Confirmed',
        startDate: new Date('2026-12-01'),
        endDate: new Date('2026-12-05'),
        addOns: [{ addOn: new mongoose.Types.ObjectId(), quantity: 1, price: 10000 }],
      };

      jest.spyOn(Booking, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      const updatedBooking = { ...mockBooking, status: 'Cancelled' };
      jest.spyOn(Booking, 'findByIdAndUpdate').mockResolvedValue(updatedBooking);

      mockReq = {
        params: { id: mockBooking._id.toString() },
        user: { id: userId, role: 'user' }, // User cancelling their own confirmed booking
        body: { status: 'Cancelled' },
      };

      await updateBooking(mockReq, mockRes);

      expect(statusCode).toBe(200);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data.status).toBe('Cancelled');
      expect(releaseBookingAddOns).toHaveBeenCalledWith(mockBooking, mockSession);
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it('should release add-ons when transitioning to terminal status Completed', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const mockBooking = {
        _id: new mongoose.Types.ObjectId(),
        user: userId,
        status: 'Active',
        startDate: new Date('2026-12-01'),
        endDate: new Date('2026-12-05'),
        addOns: [{ addOn: new mongoose.Types.ObjectId(), quantity: 2, price: 20000 }],
      };

      jest.spyOn(Booking, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      const updatedBooking = { ...mockBooking, status: 'Completed' };
      jest.spyOn(Booking, 'findByIdAndUpdate').mockResolvedValue(updatedBooking);

      mockReq = {
        params: { id: mockBooking._id.toString() },
        user: { id: userId, role: 'admin' }, // Admin completing the rental
        body: { status: 'Completed' },
      };

      await updateBooking(mockReq, mockRes);

      expect(statusCode).toBe(200);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data.status).toBe('Completed');
      expect(releaseBookingAddOns).toHaveBeenCalledWith(mockBooking, mockSession);
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('3. Quota Release Verification on Terminal States', () => {
    it('should automatically exclude Completed and Cancelled bookings from active cars calculation', () => {
      const activeBookings = [
        { status: 'Pending', numOfCars: 1 },
        { status: 'Confirmed', numOfCars: 1 },
        { status: 'Active', numOfCars: 1 },
      ];

      // Sum of active is 3 cars (limit reached)
      expect(calculateActiveCars(activeBookings)).toBe(3);
      expect(isQuotaExceeded(3, 1)).toBe(true);

      // Once a booking becomes Completed or Cancelled, it is excluded from active bookings
      const afterCompletion = [
        { status: 'Pending', numOfCars: 1 },
        { status: 'Confirmed', numOfCars: 1 },
        // Previously Active is now Completed and not returned by find({ status: { $in: ['Pending', 'Confirmed', 'Active'] } })
      ];

      expect(calculateActiveCars(afterCompletion)).toBe(2);
      expect(isQuotaExceeded(2, 1)).toBe(false); // Can now book 1 more car!
    });
  });
});

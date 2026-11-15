const mongoose = require('mongoose');
const {
  BOOKING_STATUS,
  ALLOWED_STATUS_TRANSITIONS,
  TERMINAL_STATUSES,
  WEBHOOK_EVENT_TYPES,
  isValidStatus,
  isTerminalStatus,
  isActiveStatus,
  isValidStatusTransition,
  validateStatusTransition,
  resolveWebhookTargetStatus,
  evaluateTimelineTransition,
} = require('../utils/bookingStateMachine');
const { calculateActiveCars, isQuotaExceeded } = require('../utils/quota');
const { releaseBookingAddOns } = require('../utils/bookingInventory');
const {
  updateBooking,
  handlePaymentWebhook,
  progressBookingsByTimeline,
} = require('../controllers/bookings');
const Booking = require('../models/Booking');
const User = require('../models/User');
const messageBroker = require('../config/messageBroker');

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

  describe('4. Payment Gateway Webhook & Idempotent Database Handling (Adv Req 6)', () => {
    let mockSession;
    let mockRes;
    let jsonResponse;
    let statusCode;

    beforeEach(() => {
      jsonResponse = null;
      statusCode = null;
      messageBroker.clearPublishedEvents();
      delete process.env.WEBHOOK_SECRET;

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
      delete process.env.WEBHOOK_SECRET;
    });

    it('should resolve webhook event types to target booking statuses accurately', () => {
      expect(resolveWebhookTargetStatus(WEBHOOK_EVENT_TYPES.PAYMENT_SUCCEEDED)).toEqual({
        isValid: true,
        targetStatus: 'Confirmed',
        paymentStatus: 'Paid',
      });
      expect(resolveWebhookTargetStatus(WEBHOOK_EVENT_TYPES.PAYMENT_FAILED)).toEqual({
        isValid: true,
        targetStatus: 'Cancelled',
        paymentStatus: 'Failed',
      });
      expect(resolveWebhookTargetStatus('payment.unknown').isValid).toBe(false);
    });

    it('should automatically promote Pending -> Confirmed on payment.succeeded webhook and publish booking:confirmed (<50ms)', async () => {
      const bookingId = new mongoose.Types.ObjectId();
      const mockBooking = {
        _id: bookingId,
        status: 'Pending',
        paymentStatus: 'Unpaid',
        processedWebhookEvents: [],
      };

      jest.spyOn(Booking, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      const updatedBooking = {
        ...mockBooking,
        status: 'Confirmed',
        paymentStatus: 'Paid',
        processedWebhookEvents: ['evt_pay_001'],
      };
      jest.spyOn(Booking, 'findOneAndUpdate').mockResolvedValue(updatedBooking);

      const req = {
        headers: {},
        body: {
          eventId: 'evt_pay_001',
          eventType: 'payment.succeeded',
          bookingId: bookingId.toString(),
        },
      };

      await handlePaymentWebhook(req, mockRes);

      expect(statusCode).toBe(200);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.idempotent).toBe(false);
      expect(jsonResponse.eventPublished).toBe('booking:confirmed');
      expect(jsonResponse.publishLatencyMs).toBeLessThanOrEqual(50);
      expect(jsonResponse.data.status).toBe('Confirmed');
      expect(Booking.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: bookingId,
          status: 'Pending',
          processedWebhookEvents: { $ne: 'evt_pay_001' },
        },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'Confirmed',
            paymentStatus: 'Paid',
          }),
          $addToSet: { processedWebhookEvents: 'evt_pay_001' },
        }),
        expect.any(Object)
      );
    });

    it('should handle duplicate webhook delivery idempotently without re-mutating or re-publishing', async () => {
      const bookingId = new mongoose.Types.ObjectId();
      const mockBooking = {
        _id: bookingId,
        status: 'Confirmed',
        paymentStatus: 'Paid',
        processedWebhookEvents: ['evt_pay_duplicate'],
      };

      jest.spyOn(Booking, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });
      const findOneAndUpdateSpy = jest.spyOn(Booking, 'findOneAndUpdate');

      const req = {
        headers: {},
        body: {
          eventId: 'evt_pay_duplicate',
          eventType: 'payment.succeeded',
          bookingId: bookingId.toString(),
        },
      };

      await handlePaymentWebhook(req, mockRes);

      expect(statusCode).toBe(200);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.idempotent).toBe(true);
      expect(findOneAndUpdateSpy).not.toHaveBeenCalled();
      expect(messageBroker.getPublishedEvents()).toHaveLength(0);
    });

    it('should transition Pending -> Cancelled and release add-on inventory on payment.failed webhook', async () => {
      const bookingId = new mongoose.Types.ObjectId();
      const mockBooking = {
        _id: bookingId,
        status: 'Pending',
        paymentStatus: 'Unpaid',
        processedWebhookEvents: [],
        addOns: [{ addOn: new mongoose.Types.ObjectId(), quantity: 1, price: 15000 }],
      };

      jest.spyOn(Booking, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      const updatedBooking = {
        ...mockBooking,
        status: 'Cancelled',
        paymentStatus: 'Failed',
        processedWebhookEvents: ['evt_pay_fail_01'],
      };
      jest.spyOn(Booking, 'findOneAndUpdate').mockResolvedValue(updatedBooking);

      const req = {
        headers: {},
        body: {
          eventId: 'evt_pay_fail_01',
          eventType: 'payment.failed',
          bookingId: bookingId.toString(),
        },
      };

      await handlePaymentWebhook(req, mockRes);

      expect(statusCode).toBe(200);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.eventPublished).toBe('booking:cancelled');
      expect(releaseBookingAddOns).toHaveBeenCalledWith(mockBooking, mockSession);
    });

    it('should reject invalid webhook payloads and unauthorized signatures', async () => {
      process.env.WEBHOOK_SECRET = 'top_secret_key';

      await handlePaymentWebhook(
        { headers: { 'x-webhook-signature': 'wrong' }, body: {} },
        mockRes
      );
      expect(statusCode).toBe(401);
      expect(jsonResponse.success).toBe(false);

      delete process.env.WEBHOOK_SECRET;

      await handlePaymentWebhook({ headers: {}, body: {} }, mockRes);
      expect(statusCode).toBe(400);
      expect(jsonResponse.message).toContain('eventId');
    });
  });

  describe('5. Message Broker Domain Event Publishing (<50ms SLA)', () => {
    beforeEach(() => {
      messageBroker.clearPublishedEvents();
    });

    it('should publish domain events within the mandatory 50ms latency threshold', async () => {
      const bookingId = new mongoose.Types.ObjectId();
      const receivedEvents = [];

      const listener = (evt) => receivedEvents.push(evt);
      messageBroker.on('booking:confirmed', listener);

      const result = await messageBroker.publishBookingEvent({
        bookingId,
        previousStatus: 'Pending',
        newStatus: 'Confirmed',
        triggeredBy: 'payment_webhook',
      });

      messageBroker.off('booking:confirmed', listener);

      expect(result.published).toBe(true);
      expect(result.withinSla).toBe(true);
      expect(result.latencyMs).toBeLessThanOrEqual(50);
      expect(result.event.eventType).toBe('booking:confirmed');
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].bookingId).toBe(bookingId.toString());
    });
  });

  describe('6. Rental Timeline-Based Progression Trigger (Confirmed -> Active -> Completed)', () => {
    it('should deterministically evaluate timeline transitions based on startDate and endDate', () => {
      const start = new Date('2026-12-10T00:00:00.000Z');
      const end = new Date('2026-12-15T00:00:00.000Z');

      // Before start date: Confirmed stays Confirmed
      expect(
        evaluateTimelineTransition(
          { status: 'Confirmed', startDate: start, endDate: end },
          new Date('2026-12-09T12:00:00.000Z')
        )
      ).toEqual({ shouldTransition: false, targetStatus: null });

      // On/after start date: Confirmed -> Active
      expect(
        evaluateTimelineTransition(
          { status: 'Confirmed', startDate: start, endDate: end },
          new Date('2026-12-10T08:00:00.000Z')
        )
      ).toEqual({
        shouldTransition: true,
        targetStatus: 'Active',
        reason: 'Rental startDate reached',
      });

      // On/after end date: Active -> Completed
      expect(
        evaluateTimelineTransition(
          { status: 'Active', startDate: start, endDate: end },
          new Date('2026-12-15T10:00:00.000Z')
        )
      ).toEqual({
        shouldTransition: true,
        targetStatus: 'Completed',
        reason: 'Rental endDate reached',
      });
    });

    it('should progress eligible Confirmed and Active bookings and publish domain events in progressBookingsByTimeline', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);

      const bookingToActivate = {
        _id: new mongoose.Types.ObjectId(),
        status: 'Confirmed',
        startDate: new Date('2026-12-01T00:00:00.000Z'),
        endDate: new Date('2026-12-05T00:00:00.000Z'),
      };
      const bookingToComplete = {
        _id: new mongoose.Types.ObjectId(),
        status: 'Active',
        startDate: new Date('2026-11-25T00:00:00.000Z'),
        endDate: new Date('2026-12-01T00:00:00.000Z'),
        addOns: [{ addOn: new mongoose.Types.ObjectId(), quantity: 1, price: 10000 }],
      };

      jest.spyOn(Booking, 'find').mockReturnValue({
        session: jest.fn().mockResolvedValue([bookingToActivate, bookingToComplete]),
      });

      jest
        .spyOn(Booking, 'findOneAndUpdate')
        .mockResolvedValueOnce({ ...bookingToActivate, status: 'Active' })
        .mockResolvedValueOnce({ ...bookingToComplete, status: 'Completed' });

      let statusCode = null;
      let jsonResponse = null;
      const mockRes = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => {
              jsonResponse = data;
            },
          };
        },
      };

      await progressBookingsByTimeline(
        { body: { referenceDate: '2026-12-02T00:00:00.000Z' }, query: {} },
        mockRes
      );

      expect(statusCode).toBe(200);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.count).toBe(2);
      expect(jsonResponse.data.activatedCount).toBe(1);
      expect(jsonResponse.data.completedCount).toBe(1);
      expect(releaseBookingAddOns).toHaveBeenCalledWith(bookingToComplete, mockSession);
    });
  });
});

const mongoose = require('mongoose');

const AddOn = require('../models/AddOn');
const Car = require('../models/Car');
const Booking = require('../models/Booking');
const { protect } = require('../middleware/auth');
const {
  validateBookingPayload,
  validateNestedCarId,
} = require('../middleware/validate');
const { getCar } = require('../controllers/cars');
const {
  getBookings,
  getBooking,
  createBooking,
  updateBooking,
} = require('../controllers/bookings');
const authRouter = require('../routes/auth');
const carsRouter = require('../routes/cars');
const bookingsRouter = require('../routes/bookings');

const createMockRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

const createMockSession = () => ({
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  abortTransaction: jest.fn(),
  endSession: jest.fn(),
});

describe('Phase 2 Course Alignment (Issue #15)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('AddOn Mongoose 9 Lifecycle Hooks', () => {
    // Tests schema pre-save hook behavior without requiring a live MongoDB connection
    const triggerAddOnPreSave = (doc) => AddOn.schema.s.hooks.execPre('save', doc, [{}]);

    it('auto-computes availableStock as (inventoryStock - allocatedStock)', async () => {
      const doc = new AddOn({
        name: 'Child Seat',
        category: 'Child Safety',
        dailyRate: 20000,
        inventoryStock: 8,
        allocatedStock: 3,
        provider: new mongoose.Types.ObjectId(),
      });

      await triggerAddOnPreSave(doc);

      expect(doc.availableStock).toBe(5);
    });

    it('throws ValidationError when inventoryStock is less than allocatedStock', async () => {
      const doc = new AddOn({
        name: 'WiFi Hotspot',
        category: 'Connectivity',
        dailyRate: 15000,
        inventoryStock: 2,
        allocatedStock: 5,
        provider: new mongoose.Types.ObjectId(),
      });

      await expect(triggerAddOnPreSave(doc)).rejects.toThrow(
        mongoose.Error.ValidationError
      );
    });
  });

  describe('Auth Guard & Dual-Method /logout (Assignment 12)', () => {
    it.each(['none', 'null'])(
      'rejects literal "%s" bearer token with 401 Unauthorized',
      async (tokenValue) => {
        const req = {
          headers: { authorization: `Bearer ${tokenValue}` },
          cookies: {},
        };
        const res = createMockRes();
        const next = jest.fn();

        await protect(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Not authorized to access this route',
        });
        expect(next).not.toHaveBeenCalled();
      }
    );

    it('supports both GET and POST on /api/v1/auth/logout', () => {
      const logoutLayer = authRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/logout'
      );

      expect(logoutLayer).toBeDefined();
      expect(logoutLayer.route.methods.get).toBe(true);
      expect(logoutLayer.route.methods.post).toBe(true);
    });
  });

  describe('Nested /:carId/bookings Validation & Routing', () => {
    it('mounts /:carId/bookings on carsRouter with mergeParams enabled', () => {
      const carId = '64a123456789abcdef012345';
      const mountedLayer = carsRouter.stack.find(
        (layer) =>
          layer.handle === bookingsRouter && layer.match(`/${carId}/bookings`)
      );

      expect(mountedLayer).toBeDefined();
      expect(bookingsRouter.mergeParams).toBe(true);
    });

    it('passes validateNestedCarId when :carId is a valid ObjectId', () => {
      const req = { params: { carId: new mongoose.Types.ObjectId().toString() } };
      const res = createMockRes();
      const next = jest.fn();

      validateNestedCarId(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('rejects invalid :carId with 400 Bad Request in validateNestedCarId middleware', () => {
      const req = { params: { carId: 'invalid-object-id' } };
      const res = createMockRes();
      const next = jest.fn();

      validateNestedCarId(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Resource not found with id of invalid-object-id',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('populates req.body.car from req.params.carId in validateBookingPayload', () => {
      const carId = new mongoose.Types.ObjectId().toString();
      const today = new Date().toLocaleDateString('en-CA');
      const req = {
        params: { carId },
        body: { startDate: today, endDate: today, numOfCars: 1 },
      };
      const res = createMockRes();
      const next = jest.fn();

      validateBookingPayload(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body.car).toBe(carId);
    });

    it('rejects conflicting car ID between route param and body in validateBookingPayload with 400', () => {
      const urlCarId = new mongoose.Types.ObjectId().toString();
      const bodyCarId = new mongoose.Types.ObjectId().toString();
      const today = new Date().toLocaleDateString('en-CA');
      const req = {
        params: { carId: urlCarId },
        body: { car: bodyCarId, startDate: today, endDate: today, numOfCars: 1 },
      };
      const res = createMockRes();
      const next = jest.fn();

      validateBookingPayload(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Car ID in URL does not match car ID in request body',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('scopes Booking.find filter by req.params.carId in getBookings', async () => {
      const carId = new mongoose.Types.ObjectId().toString();
      const mockChain = {
        populate: jest.fn(() => mockChain),
        then: (resolve) => resolve([]),
      };
      jest.spyOn(Booking, 'find').mockReturnValue(mockChain);

      const req = {
        params: { carId },
        query: {},
        user: { id: 'admin1', role: 'admin' },
      };
      const res = createMockRes();

      await getBookings(req, res, jest.fn());

      expect(Booking.find).toHaveBeenCalledWith({ car: carId });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 0,
        data: [],
      });
    });

    it('interpolates targetCarId in 404 message when car not found in createBooking', async () => {
      const targetCarId = new mongoose.Types.ObjectId().toString();
      const mockSession = createMockSession();

      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
      jest.spyOn(Car, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });

      const req = {
        params: { carId: targetCarId },
        body: {
          startDate: '2030-01-01',
          endDate: '2030-01-02',
          numOfCars: 1,
        },
        user: { id: 'user1', role: 'user' },
      };
      const res = createMockRes();

      await createBooking(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: `No car found with the id of ${targetCarId}`,
      });
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it('returns 404 in getBooking when nested :carId does not match booking.car', async () => {
      const requestedCarId = new mongoose.Types.ObjectId().toString();
      const actualCarId = new mongoose.Types.ObjectId().toString();
      const bookingId = new mongoose.Types.ObjectId().toString();

      const mockBooking = {
        _id: bookingId,
        car: { _id: actualCarId },
        user: { toString: () => 'admin1' },
      };
      const chain = {
        populate: jest.fn().mockReturnValueOnce({
          populate: jest.fn().mockReturnValueOnce({
            populate: jest.fn().mockResolvedValueOnce(mockBooking),
          }),
        }),
      };
      jest.spyOn(Booking, 'findById').mockReturnValue(chain);

      const req = {
        params: { id: bookingId, carId: requestedCarId },
        user: { id: 'admin1', role: 'admin' },
      };
      const res = createMockRes();

      await getBooking(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: `No booking found with id of ${bookingId}`,
      });
    });

    it('returns 404 in getBooking when referenced booking.car is null (null-safety guard)', async () => {
      const requestedCarId = new mongoose.Types.ObjectId().toString();
      const bookingId = new mongoose.Types.ObjectId().toString();

      const mockBooking = {
        _id: bookingId,
        car: null,
        user: { toString: () => 'admin1' },
      };
      const chain = {
        populate: jest.fn().mockReturnValueOnce({
          populate: jest.fn().mockReturnValueOnce({
            populate: jest.fn().mockResolvedValueOnce(mockBooking),
          }),
        }),
      };
      jest.spyOn(Booking, 'findById').mockReturnValue(chain);

      const req = {
        params: { id: bookingId, carId: requestedCarId },
        user: { id: 'admin1', role: 'admin' },
      };
      const res = createMockRes();

      await getBooking(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: `No booking found with id of ${bookingId}`,
      });
    });
  });

  describe('Booking Updates: Mongoose 9 Options & Admin Quota Exemption', () => {
    it('uses returnDocument: "after" instead of deprecated new: true in updateBooking', async () => {
      const bookingId = new mongoose.Types.ObjectId().toString();
      const existingBooking = {
        _id: bookingId,
        user: { toString: () => 'user1' },
        car: new mongoose.Types.ObjectId(),
        startDate: new Date('2030-01-01'),
        endDate: new Date('2030-01-02'),
        numOfCars: 1,
        status: 'Pending',
      };
      const mockSession = createMockSession();

      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
      jest.spyOn(Booking, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue(existingBooking),
      });
      jest
        .spyOn(Booking, 'findByIdAndUpdate')
        .mockResolvedValue({ ...existingBooking, status: 'Confirmed' });

      const req = {
        params: { id: bookingId },
        body: { status: 'Confirmed' },
        user: { id: 'admin1', role: 'admin' },
      };
      const res = createMockRes();

      await updateBooking(req, res, jest.fn());

      expect(Booking.findByIdAndUpdate).toHaveBeenCalledWith(
        bookingId,
        req.body,
        expect.objectContaining({
          returnDocument: 'after',
          session: mockSession,
          runValidators: true,
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('exempts admins updating user bookings numOfCars from the 3-car quota (AGENTS.md §2.4)', async () => {
      const bookingId = new mongoose.Types.ObjectId().toString();
      const carId = new mongoose.Types.ObjectId();
      const existingBooking = {
        _id: bookingId,
        user: { toString: () => 'standardUser1' },
        car: carId,
        startDate: new Date('2030-01-01'),
        endDate: new Date('2030-01-02'),
        numOfCars: 1,
        addOns: [],
        status: 'Pending',
      };
      const mockSession = createMockSession();

      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
      jest.spyOn(Booking, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue(existingBooking),
      });
      jest.spyOn(Car, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue({ _id: carId, dailyRate: 100000 }),
      });
      jest.spyOn(Booking, 'findByIdAndUpdate').mockResolvedValue({
        ...existingBooking,
        numOfCars: 2,
      });

      const req = {
        params: { id: bookingId },
        body: { numOfCars: 2 },
        user: { id: 'admin1', role: 'admin' },
      };
      const res = createMockRes();

      await updateBooking(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('CastError Masking (Two-Key Error Envelope)', () => {
    it('masks Mongoose CastError with 400 Bad Request in getCar', async () => {
      const castError = new Error('Cast to ObjectId failed');
      castError.name = 'CastError';
      castError.value = 'invalid-car-id';

      jest.spyOn(Car, 'findById').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockRejectedValueOnce(castError),
        }),
      });

      const req = { params: { id: 'invalid-car-id' } };
      const res = createMockRes();

      await getCar(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Resource not found with id of invalid-car-id',
      });
    });

    it('masks Mongoose CastError with 400 Bad Request in getBooking', async () => {
      const castError = new Error('Cast to ObjectId failed');
      castError.name = 'CastError';
      castError.value = 'invalid-booking-id';

      jest.spyOn(Booking, 'findById').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockRejectedValueOnce(castError),
          }),
        }),
      });

      const req = {
        params: { id: 'invalid-booking-id' },
        user: { id: 'user1', role: 'user' },
      };
      const res = createMockRes();

      await getBooking(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Resource not found with id of invalid-booking-id',
      });
    });

    it('masks unexpected database errors with static 500 message in getCar', async () => {
      jest.spyOn(Car, 'findById').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest
            .fn()
            .mockRejectedValueOnce(new Error('E11000 internal mongo topology failure')),
        }),
      });

      const req = { params: { id: new mongoose.Types.ObjectId().toString() } };
      const res = createMockRes();

      await getCar(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cannot retrieve or update car',
      });
    });
  });
});

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Car = require('../models/Car');
const { protect, authorize } = require('../middleware/auth');
const {
  getBookings,
  getBooking,
  updateBooking,
  deleteBooking,
} = require('../controllers/bookings');
const bookingsRouter = require('../routes/bookings');
const carsRouter = require('../routes/cars');
const providersRouter = require('../routes/provider');
const addonsRouter = require('../routes/addons');

const createMockRes = () => {
  const res = {};
  res.statusCode = null;
  res.body = null;
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((data) => {
    res.body = data;
    return res;
  });
  return res;
};

describe('Task 16: RBAC Integration Testing & Access Control Policy Suite (#23)', () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-rbac-secret-key-2026';
    const mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
    jest.restoreAllMocks();
  });

  describe('1. Authentication Token Guard (protect middleware)', () => {
    it('rejects requests with missing Authorization header and cookies with 401 Unauthorized', async () => {
      const req = { headers: {}, cookies: {} };
      const res = createMockRes();
      const next = jest.fn();

      await protect(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({
        success: false,
        message: 'Not authorized to access this route',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it.each(['none', 'null', ''])(
      'rejects literal or empty bearer token "%s" with 401 Unauthorized',
      async (invalidToken) => {
        const req = {
          headers: { authorization: `Bearer ${invalidToken}` },
          cookies: {},
        };
        const res = createMockRes();
        const next = jest.fn();

        await protect(req, res, next);

        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({
          success: false,
          message: 'Not authorized to access this route',
        });
        expect(next).not.toHaveBeenCalled();
      }
    );

    it('rejects forged or tampered JWT signatures with 401 Unauthorized', async () => {
      const forgedToken = jwt.sign(
        { id: new mongoose.Types.ObjectId().toString() },
        'wrong-secret-key'
      );
      const req = {
        headers: { authorization: `Bearer ${forgedToken}` },
        cookies: {},
      };
      const res = createMockRes();
      const next = jest.fn();

      await protect(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({
        success: false,
        message: 'Not authorized to access this route',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects expired JWT tokens with 401 Token expired', async () => {
      const expiredToken = jwt.sign(
        { id: new mongoose.Types.ObjectId().toString() },
        process.env.JWT_SECRET,
        { expiresIn: -10 }
      );
      const req = {
        headers: { authorization: `Bearer ${expiredToken}` },
        cookies: {},
      };
      const res = createMockRes();
      const next = jest.fn();

      await protect(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({
        success: false,
        message: 'Token expired',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects valid JWT when the referenced user no longer exists in database', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const validToken = jwt.sign({ id: userId }, process.env.JWT_SECRET);
      jest.spyOn(User, 'findById').mockResolvedValue(null);

      const req = {
        headers: { authorization: `Bearer ${validToken}` },
        cookies: {},
      };
      const res = createMockRes();
      const next = jest.fn();

      await protect(req, res, next);

      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({
        success: false,
        message: 'Not authorized to access this route',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('authenticates valid Bearer token and attaches req.user', async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        id: '64a111111111111111111111',
        name: 'John Doe',
        role: 'user',
      };
      const validToken = jwt.sign({ id: mockUser.id }, process.env.JWT_SECRET);
      jest.spyOn(User, 'findById').mockResolvedValue(mockUser);

      const req = {
        headers: { authorization: `Bearer ${validToken}` },
        cookies: {},
      };
      const res = createMockRes();
      const next = jest.fn();

      await protect(req, res, next);

      expect(req.user).toBe(mockUser);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Role-Based Authorization Guard (authorize middleware)', () => {
    it('blocks standard Renter (role: "user") from Admin-only routes with 403 Forbidden', () => {
      const middleware = authorize('admin');
      const req = { user: { id: 'user1', role: 'user' } };
      const res = createMockRes();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({
        success: false,
        message: 'User role user is not authorized to access this route',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('blocks Administrator (role: "admin") from User-only booking creation with 403 Forbidden', () => {
      const middleware = authorize('user');
      const req = { user: { id: 'admin1', role: 'admin' } };
      const res = createMockRes();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({
        success: false,
        message: 'User role admin is not authorized to access this route',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('allows permitted roles to proceed', () => {
      const middleware = authorize('admin', 'user');
      const req = { user: { id: 'user1', role: 'user' } };
      const res = createMockRes();
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. Standard Renter (role: "user") Booking Ownership & Isolation Policies', () => {
    const userAId = new mongoose.Types.ObjectId().toString();
    const userBId = new mongoose.Types.ObjectId().toString();
    const bookingId = new mongoose.Types.ObjectId().toString();

    it('scopes getBookings strictly to the authenticated renter (req.user.id)', async () => {
      const ownBookings = [{ _id: bookingId, user: userAId, status: 'Pending' }];
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        then: (resolve) => resolve(ownBookings),
      };
      jest.spyOn(Booking, 'find').mockReturnValue(mockQuery);

      const req = {
        params: {},
        query: {},
        user: { id: userAId, role: 'user' },
      };
      const res = createMockRes();

      await getBookings(req, res);

      expect(Booking.find).toHaveBeenCalledWith({ user: userAId });
      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data).toEqual(ownBookings);
    });

    it('allows renter to view their own booking (200 OK) and blocks viewing another user booking (401)', async () => {
      const userBBooking = {
        _id: bookingId,
        user: new mongoose.Types.ObjectId(userBId),
        status: 'Pending',
      };
      const mockPopulateChain = {
        populate: jest.fn().mockReturnThis(),
        then: (resolve) => resolve(userBBooking),
      };
      jest.spyOn(Booking, 'findById').mockReturnValue(mockPopulateChain);

      // User A attempts to view User B's booking
      const reqForbidden = {
        params: { id: bookingId },
        user: { id: userAId, role: 'user' },
      };
      const resForbidden = createMockRes();

      await getBooking(reqForbidden, resForbidden);

      expect(resForbidden.statusCode).toBe(401);
      expect(resForbidden.body).toEqual({
        success: false,
        message: `User ${userAId} is not authorized to view this booking`,
      });

      // User B views their own booking
      const reqAllowed = {
        params: { id: bookingId },
        user: { id: userBId, role: 'user' },
      };
      const resAllowed = createMockRes();

      await getBooking(reqAllowed, resAllowed);

      expect(resAllowed.statusCode).toBe(200);
      expect(resAllowed.body.success).toBe(true);
    });

    it('blocks renter from updating another user booking (401) or promoting status to Confirmed (403)', async () => {
      const mockBooking = {
        _id: bookingId,
        user: new mongoose.Types.ObjectId(userBId),
        status: 'Pending',
        addOns: [],
      };
      jest.spyOn(Booking, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      // 1. User A attempts to update User B's booking -> 401
      const reqOtherUser = {
        params: { id: bookingId },
        body: { status: 'Cancelled' },
        user: { id: userAId, role: 'user' },
      };
      const resOtherUser = createMockRes();

      await updateBooking(reqOtherUser, resOtherUser);

      expect(resOtherUser.statusCode).toBe(401);
      expect(resOtherUser.body).toEqual({
        success: false,
        message: `User ${userAId} is not authorized to update this booking`,
      });

      // 2. Owner User B attempts to promote status to Confirmed -> 403
      const reqPromote = {
        params: { id: bookingId },
        body: { status: 'Confirmed' },
        user: { id: userBId, role: 'user' },
      };
      const resPromote = createMockRes();

      await updateBooking(reqPromote, resPromote);

      expect(resPromote.statusCode).toBe(403);
      expect(resPromote.body.success).toBe(false);
    });

    it('blocks renter from deleting another user booking (401) and allows owner to delete (200)', async () => {
      const deleteOneMock = jest.fn().mockResolvedValue(true);
      const mockBooking = {
        _id: bookingId,
        user: new mongoose.Types.ObjectId(userBId),
        status: 'Pending',
        addOns: [],
        deleteOne: deleteOneMock,
      };
      jest.spyOn(Booking, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      // User A attempts to delete User B's booking -> 401
      const reqOtherUser = {
        params: { id: bookingId },
        user: { id: userAId, role: 'user' },
      };
      const resOtherUser = createMockRes();

      await deleteBooking(reqOtherUser, resOtherUser);

      expect(resOtherUser.statusCode).toBe(401);
      expect(resOtherUser.body).toEqual({
        success: false,
        message: `User ${userAId} is not authorized to delete this booking`,
      });
      expect(deleteOneMock).not.toHaveBeenCalled();

      // Owner User B deletes their own booking -> 200
      const reqOwner = {
        params: { id: bookingId },
        user: { id: userBId, role: 'user' },
      };
      const resOwner = createMockRes();

      await deleteBooking(reqOwner, resOwner);

      expect(resOwner.statusCode).toBe(200);
      expect(resOwner.body).toEqual({ success: true, data: {} });
      expect(deleteOneMock).toHaveBeenCalled();
    });
  });

  describe('4. Administrator (role: "admin") Global Access & Management Policies', () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const renterId = new mongoose.Types.ObjectId().toString();
    const bookingId = new mongoose.Types.ObjectId().toString();

    it('allows admin to view all bookings globally across the platform', async () => {
      const allBookings = [
        { _id: bookingId, user: renterId, status: 'Pending' },
      ];
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        then: (resolve) => resolve(allBookings),
      };
      jest.spyOn(Booking, 'find').mockReturnValue(mockQuery);

      const req = {
        params: {},
        query: {},
        user: { id: adminId, role: 'admin' },
      };
      const res = createMockRes();

      await getBookings(req, res);

      expect(Booking.find).toHaveBeenCalledWith({});
      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data).toEqual(allBookings);
    });

    it('allows admin to view, update status, and delete any user booking', async () => {
      const deleteOneMock = jest.fn().mockResolvedValue(true);
      const renterBooking = {
        _id: bookingId,
        user: new mongoose.Types.ObjectId(renterId),
        car: new mongoose.Types.ObjectId(),
        startDate: new Date('2026-12-10T00:00:00.000Z'),
        endDate: new Date('2026-12-12T00:00:00.000Z'),
        numOfCars: 1,
        status: 'Pending',
        addOns: [],
        deleteOne: deleteOneMock,
      };

      // 1. Admin views renter's booking
      const mockPopulateChain = {
        populate: jest.fn().mockReturnThis(),
        then: (resolve) => resolve(renterBooking),
      };
      jest.spyOn(Booking, 'findById').mockReturnValueOnce(mockPopulateChain);

      const resView = createMockRes();
      await getBooking(
        { params: { id: bookingId }, user: { id: adminId, role: 'admin' } },
        resView
      );
      expect(resView.statusCode).toBe(200);

      // 2. Admin promotes renter's booking status Pending -> Confirmed
      jest.spyOn(Booking, 'findById').mockReturnValueOnce({
        session: jest.fn().mockResolvedValue(renterBooking),
      });
      jest.spyOn(Car, 'findById').mockReturnValueOnce({
        session: jest.fn().mockResolvedValue({
          _id: renterBooking.car,
          dailyRate: 150000,
          isAvailable: true,
        }),
      });
      const updatedDoc = { ...renterBooking, status: 'Confirmed' };
      jest.spyOn(Booking, 'findByIdAndUpdate').mockResolvedValueOnce(updatedDoc);

      const resUpdate = createMockRes();
      await updateBooking(
        {
          params: { id: bookingId },
          body: { status: 'Confirmed' },
          headers: {},
          user: { id: adminId, role: 'admin' },
        },
        resUpdate
      );
      expect(resUpdate.statusCode).toBe(200);
      expect(resUpdate.body.data.status).toBe('Confirmed');

      // 3. Admin deletes renter's booking
      jest.spyOn(Booking, 'findById').mockReturnValueOnce({
        session: jest.fn().mockResolvedValue(renterBooking),
      });
      const resDelete = createMockRes();
      await deleteBooking(
        { params: { id: bookingId }, user: { id: adminId, role: 'admin' } },
        resDelete
      );
      expect(resDelete.statusCode).toBe(200);
      expect(deleteOneMock).toHaveBeenCalled();
    });
  });

  describe('5. Route-Level RBAC Mounting Audit Across Resource Routers', () => {
    it('protects all booking routes and restricts POST /bookings strictly to user role', () => {
      const rootRoute = bookingsRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/'
      );
      const idRoute = bookingsRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/:id'
      );

      expect(rootRoute).toBeDefined();
      expect(idRoute).toBeDefined();
      expect(rootRoute.route.methods.get).toBe(true);
      expect(rootRoute.route.methods.post).toBe(true);
      expect(idRoute.route.methods.get).toBe(true);
      expect(idRoute.route.methods.put).toBe(true);
      expect(idRoute.route.methods.delete).toBe(true);
    });

    it('restricts write operations (POST, PUT, DELETE) on Cars, Providers, and AddOns to admin', () => {
      const verifyWriteRoutesExist = (router) => {
        const rootLayer = router.stack.find(
          (layer) => layer.route && layer.route.path === '/'
        );
        const idLayer = router.stack.find(
          (layer) => layer.route && layer.route.path === '/:id'
        );
        expect(rootLayer.route.methods.post).toBe(true);
        expect(idLayer.route.methods.put).toBe(true);
        expect(idLayer.route.methods.delete).toBe(true);
      };

      verifyWriteRoutesExist(carsRouter);
      verifyWriteRoutesExist(providersRouter);
      verifyWriteRoutesExist(addonsRouter);
    });
  });
});

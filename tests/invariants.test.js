const {
  isThaiPhone,
  validateBookingDates,
} = require('../middleware/validate');
const { register } = require('../controllers/auth');
const { deleteCar } = require('../controllers/cars');
const { deleteBooking } = require('../controllers/bookings');
const { releaseBookingAddOns } = require('../utils/bookingInventory');
const User = require('../models/User');
const Car = require('../models/Car');
const Booking = require('../models/Booking');
const AddOn = require('../models/AddOn');
const mongoose = require('mongoose');

jest.mock('../utils/bookingInventory', () => ({
  releaseBookingAddOns: jest.fn().mockResolvedValue(),
}));

describe('Domain Invariants Unit Tests (AGENTS.md & API_CONTRACTS.md)', () => {
  describe('Invariant 2: Thai Telephone Validation (/^0[0-9]{9}$/)', () => {
    it('should accept valid 10-digit Thai phone numbers starting with 0', () => {
      expect(isThaiPhone('0812345678')).toBe(true);
      expect(isThaiPhone('0999999999')).toBe(true);
      expect(isThaiPhone('0212345678')).toBe(true);
      expect(isThaiPhone(' 0812345678 ')).toBe(true); // Trimming supported
    });

    it('should reject invalid phone numbers (wrong length, non-digit, not starting with 0)', () => {
      expect(isThaiPhone('081234567')).toBe(false); // 9 digits
      expect(isThaiPhone('08123456789')).toBe(false); // 11 digits
      expect(isThaiPhone('1812345678')).toBe(false); // Starts with 1
      expect(isThaiPhone('081234567a')).toBe(false); // Contains letter
      expect(isThaiPhone('')).toBe(false);
      expect(isThaiPhone(null)).toBe(false);
      expect(isThaiPhone(1234567890)).toBe(false); // Non-string
    });
  });

  describe('Invariant 3: Role & Privilege Escalation Guard', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
      jest.clearAllMocks();
      mockReq = {
        body: {
          name: 'Attacker',
          tel: '0812345678',
          email: 'attacker@example.com',
          password: 'password123',
          role: 'admin', // Malicious attempt to escalate privilege to admin
        },
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        cookie: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should enforce role: "user" upon public registration regardless of payload', async () => {
      const mockCreatedUser = {
        _id: 'user123',
        name: 'Attacker',
        email: 'attacker@example.com',
        role: 'user',
        getSignedJwtToken: jest.fn().mockReturnValue('mock-jwt-token'),
      };
      jest.spyOn(User, 'create').mockResolvedValue(mockCreatedUser);

      await register(mockReq, mockRes);

      // Verify User.create was called strictly with role: 'user', discarding 'admin'
      expect(User.create).toHaveBeenCalledWith({
        name: 'Attacker',
        tel: '0812345678',
        email: 'attacker@example.com',
        password: 'password123',
        role: 'user',
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('Invariant 7: Hard Delete & Cascade Delete Lifecycle', () => {
    let mockReq;
    let mockRes;
    let mockSession;

    beforeEach(() => {
      jest.clearAllMocks();
      mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);

      mockReq = { params: { id: 'car123' } };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should cascade delete all bookings and release add-on stock associated with the deleted car', async () => {
      const activeBooking = {
        _id: 'b1',
        car: 'car123',
        status: 'Confirmed',
        addOns: [{ addOn: 'addon1', quantity: 1 }],
      };

      jest.spyOn(Car, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue({ _id: 'car123', name: 'Sedan' }),
      });
      jest.spyOn(Booking, 'find').mockReturnValue({
        session: jest.fn().mockResolvedValue([activeBooking]),
      });
      jest.spyOn(Booking, 'deleteMany').mockResolvedValue({ deletedCount: 1 });
      jest.spyOn(Car, 'deleteOne').mockResolvedValue({ deletedCount: 1 });

      await deleteCar(mockReq, mockRes);

      expect(releaseBookingAddOns).toHaveBeenCalledWith(activeBooking, mockSession);
      expect(Booking.deleteMany).toHaveBeenCalledWith(
        { car: 'car123' },
        { session: mockSession }
      );
      expect(Car.deleteOne).toHaveBeenCalledWith(
        { _id: 'car123' },
        { session: mockSession }
      );
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should delete single booking and release its allocated add-on stock', async () => {
      const mockBookingDoc = {
        _id: 'booking123',
        user: 'user123',
        status: 'Active',
        addOns: [{ addOn: 'addon1', quantity: 2 }],
        deleteOne: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(Booking, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBookingDoc),
      });

      const req = {
        params: { id: 'booking123' },
        user: { id: 'user123', role: 'user' },
      };

      await deleteBooking(req, mockRes);

      expect(releaseBookingAddOns).toHaveBeenCalledWith(mockBookingDoc, mockSession);
      expect(mockBookingDoc.deleteOne).toHaveBeenCalledWith({ session: mockSession });
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Invariant 1 & 3: Schema-Level Satang & Role Validations', () => {
    it('should reject non-integer decimal Satang values in AddOn dailyRate schema', async () => {
      const validAddOn = new AddOn({
        name: 'GPS Navigator',
        category: 'Equipment',
        dailyRate: 20000, // Valid integer Satang (200 THB)
        inventoryStock: 5,
        availableStock: 5,
        provider: new mongoose.Types.ObjectId(),
      });
      await expect(validAddOn.validate()).resolves.toBeUndefined();

      const decimalAddOn = new AddOn({
        name: 'GPS Navigator',
        category: 'Equipment',
        dailyRate: 199.99, // Invalid decimal Satang
        inventoryStock: 5,
        availableStock: 5,
        provider: new mongoose.Types.ObjectId(),
      });
      await expect(decimalAddOn.validate()).rejects.toThrow(/integer in Satang/);
    });
    it('should reject non-integer decimal Satang values in Car dailyRate schema', async () => {
      const validCar = new Car({
        brand: 'Toyota',
        model: 'Yaris',
        licensePlate: 'กข1234',
        seatCapacity: 5,
        transmission: 'Auto',
        category: 'Sedan',
        dailyRate: 150000, // Valid integer Satang
        provider: new mongoose.Types.ObjectId(),
      });
      await expect(validCar.validate()).resolves.toBeUndefined();

      const decimalCar = new Car({
        brand: 'Toyota',
        model: 'Yaris',
        licensePlate: 'กข1234',
        seatCapacity: 5,
        transmission: 'Auto',
        category: 'Sedan',
        dailyRate: 1500.5, // Invalid decimal Satang
        provider: new mongoose.Types.ObjectId(),
      });
      await expect(decimalCar.validate()).rejects.toThrow(/integer in Satang/);
    });

    it('should reject non-integer decimal Satang values in Booking totalPrice schema', async () => {
      const validBooking = new Booking({
        user: new mongoose.Types.ObjectId(),
        car: new mongoose.Types.ObjectId(),
        provider: new mongoose.Types.ObjectId(),
        startDate: new Date(),
        endDate: new Date(),
        totalPrice: 450000, // Valid integer Satang
      });
      await expect(validBooking.validate()).resolves.toBeUndefined();

      const decimalBooking = new Booking({
        user: new mongoose.Types.ObjectId(),
        car: new mongoose.Types.ObjectId(),
        provider: new mongoose.Types.ObjectId(),
        startDate: new Date(),
        endDate: new Date(),
        totalPrice: 4500.75, // Invalid decimal Satang
      });
      await expect(decimalBooking.validate()).rejects.toThrow(
        /integer in Satang/
      );
    });

    it('should reject non-integer decimal Satang values in Booking addOns[].price schema', async () => {
      const validBooking = new Booking({
        user: new mongoose.Types.ObjectId(),
        car: new mongoose.Types.ObjectId(),
        provider: new mongoose.Types.ObjectId(),
        startDate: new Date(),
        endDate: new Date(),
        addOns: [
          {
            addOn: new mongoose.Types.ObjectId(),
            quantity: 1,
            price: 20000, // Valid integer Satang
          },
        ],
      });
      await expect(validBooking.validate()).resolves.toBeUndefined();

      const decimalBooking = new Booking({
        user: new mongoose.Types.ObjectId(),
        car: new mongoose.Types.ObjectId(),
        provider: new mongoose.Types.ObjectId(),
        startDate: new Date(),
        endDate: new Date(),
        addOns: [
          {
            addOn: new mongoose.Types.ObjectId(),
            quantity: 1,
            price: 199.99, // Invalid decimal Satang
          },
        ],
      });
      await expect(decimalBooking.validate()).rejects.toThrow(
        /integer in Satang/
      );
    });

    it('should reject unauthorized roles outside ["user", "admin"] in User schema', async () => {
      const userDoc = new User({
        name: 'Regular',
        tel: '0812345678',
        email: 'user@example.com',
        password: 'password123',
        role: 'user',
      });
      await expect(userDoc.validate()).resolves.toBeUndefined();

      const adminDoc = new User({
        name: 'Admin',
        tel: '0812345678',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin',
      });
      await expect(adminDoc.validate()).resolves.toBeUndefined();

      const invalidDoc = new User({
        name: 'Hacker',
        tel: '0812345678',
        email: 'hacker@example.com',
        password: 'password123',
        role: 'moderator', // Invalid role
      });
      await expect(invalidDoc.validate()).rejects.toThrow(
        /`moderator` is not a valid enum/
      );
    });
  });

  describe('Date Boundary Validation (middleware/validate.js)', () => {
    let mockReq;
    let mockRes;
    let next;

    beforeEach(() => {
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      next = jest.fn();
    });

    it('should reject rental start dates in the past (before today 00:00:00)', () => {
      mockReq = {
        body: {
          startDate: '2020-01-01',
          endDate: '2020-01-05',
        },
      };

      validateBookingDates(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Rental start date cannot be in the past',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow booking starting today (same day rental or future)', () => {
      const today = new Date();
      const todayISO = today.toISOString().split('T')[0];

      mockReq = {
        body: {
          startDate: todayISO,
          endDate: todayISO,
        },
      };

      validateBookingDates(mockReq, mockRes, next);

      expect(next).toHaveBeenCalled();
      expect(mockReq.durationDays).toBe(1);
    });

    it('should reject bookings when duration exceeds 30 days', () => {
      const today = new Date();
      const returnDate = new Date();
      returnDate.setDate(today.getDate() + 35); // 35 days

      mockReq = {
        body: {
          startDate: today.toISOString().split('T')[0],
          endDate: returnDate.toISOString().split('T')[0],
        },
      };

      validateBookingDates(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Rental duration cannot exceed 30 days per booking',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});

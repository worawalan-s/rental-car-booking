const { releaseBookingAddOns } = require('../utils/bookingInventory');
const AddOn = require('../models/AddOn');

// Mock Mongoose model AddOn
jest.mock('../models/AddOn', () => ({
  findByIdAndUpdate: jest.fn(),
}));

describe('Booking Inventory Unit Tests (Add-On Lock Release)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should do nothing when booking is null, undefined, or missing required structure', async () => {
    await releaseBookingAddOns(null);
    await releaseBookingAddOns(undefined);
    await releaseBookingAddOns({});
    await releaseBookingAddOns({ status: 'Pending', addOns: null });
    await releaseBookingAddOns({ status: 'Pending', addOns: [] });

    expect(AddOn.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('should do nothing when booking status is not an active reservation status', async () => {
    // Only 'Pending', 'Confirmed', 'Active' should release stock
    await releaseBookingAddOns({
      status: 'Cancelled',
      addOns: [{ addOn: '60d5ec49f1b2c8b1f8e4e1a1', quantity: 1 }],
    });
    await releaseBookingAddOns({
      status: 'Completed',
      addOns: [{ addOn: '60d5ec49f1b2c8b1f8e4e1a1', quantity: 1 }],
    });

    expect(AddOn.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('should release inventory for each valid add-on item in active booking', async () => {
    AddOn.findByIdAndUpdate.mockResolvedValue({});

    const booking = {
      status: 'Confirmed',
      addOns: [
        { addOn: '60d5ec49f1b2c8b1f8e4e1a1', quantity: 2 },
        { addOn: '60d5ec49f1b2c8b1f8e4e1a2', quantity: 1 },
      ],
    };

    await releaseBookingAddOns(booking);

    expect(AddOn.findByIdAndUpdate).toHaveBeenCalledTimes(2);
    expect(AddOn.findByIdAndUpdate).toHaveBeenNthCalledWith(
      1,
      '60d5ec49f1b2c8b1f8e4e1a1',
      {
        $inc: {
          allocatedStock: -2,
          availableStock: 2,
        },
      },
      {}
    );
    expect(AddOn.findByIdAndUpdate).toHaveBeenNthCalledWith(
      2,
      '60d5ec49f1b2c8b1f8e4e1a2',
      {
        $inc: {
          allocatedStock: -1,
          availableStock: 1,
        },
      },
      {}
    );
  });

  it('should pass Mongoose session options if session is provided', async () => {
    AddOn.findByIdAndUpdate.mockResolvedValue({});
    const mockSession = { id: 'mock-session-id' };

    const booking = {
      status: 'Active',
      addOns: [{ addOn: '60d5ec49f1b2c8b1f8e4e1a1', quantity: 3 }],
    };

    await releaseBookingAddOns(booking, mockSession);

    expect(AddOn.findByIdAndUpdate).toHaveBeenCalledWith(
      '60d5ec49f1b2c8b1f8e4e1a1',
      {
        $inc: {
          allocatedStock: -3,
          availableStock: 3,
        },
      },
      { session: mockSession }
    );
  });

  it('should skip malformed addOn items without addOn id or quantity', async () => {
    AddOn.findByIdAndUpdate.mockResolvedValue({});

    const booking = {
      status: 'Pending',
      addOns: [
        { addOn: null, quantity: 1 },
        { addOn: '60d5ec49f1b2c8b1f8e4e1a1', quantity: 0 },
        { addOn: '60d5ec49f1b2c8b1f8e4e1a2', quantity: 2 },
      ],
    };

    await releaseBookingAddOns(booking);

    // Only the 3rd item is valid
    expect(AddOn.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    expect(AddOn.findByIdAndUpdate).toHaveBeenCalledWith(
      '60d5ec49f1b2c8b1f8e4e1a2',
      {
        $inc: {
          allocatedStock: -2,
          availableStock: 2,
        },
      },
      {}
    );
  });
});

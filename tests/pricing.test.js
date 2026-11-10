const {
  calculateBaselinePrice,
  calculatePricing,
} = require('../utils/pricingCalculator');

describe('Pricing Engine Unit Tests (Fixed-Point Satang Arithmetic)', () => {
  describe('calculateBaselinePrice', () => {
    it('should calculate baseline without add-ons and default 1 car', () => {
      const price = calculateBaselinePrice({
        dailyRate: 150000, // 1,500 THB in Satang
        durationDays: 3,
      });
      // 150000 * 3 * 1 = 450000 Satang (4,500 THB)
      expect(price).toBe(450000);
    });

    it('should calculate baseline with multiple cars and multiple add-ons', () => {
      const price = calculateBaselinePrice({
        dailyRate: 200000, // 2,000 THB
        durationDays: 2,
        numOfCars: 2,
        addOns: [
          { price: 20000, quantity: 1 }, // 200 THB * 1 * 2 days = 40000
          { price: 15000, quantity: 2 }, // 150 THB * 2 * 2 days = 60000
        ],
      });
      // Rental base: 200000 * 2 * 2 = 800000
      // Add-ons total: 40000 + 60000 = 100000
      // Total: 900000
      expect(price).toBe(900000);
    });

    it('should handle non-array addOns and missing item properties safely', () => {
      const price1 = calculateBaselinePrice({
        dailyRate: 100000,
        durationDays: 1,
        addOns: null,
      });
      expect(price1).toBe(100000);

      const price2 = calculateBaselinePrice({
        dailyRate: 100000,
        durationDays: 1,
        addOns: [{}], // Missing price & quantity defaults to 0
      });
      expect(price2).toBe(100000);
    });
  });

  describe('calculatePricing (Comprehensive Breakdown & Invariant Rules)', () => {
    it('should calculate complete pricing breakdown accurately with VAT 7%', () => {
      const result = calculatePricing({
        dailyRate: 150000, // 1,500.00 THB
        startDate: '2026-06-01',
        endDate: '2026-06-04', // 3 days
        numOfCars: 1,
        addOns: [
          {
            addOn: '60d5ec49f1b2c8b1f8e4e1a1',
            price: 20000, // 200.00 THB/day
            quantity: 1,
          },
        ],
      });

      expect(result.durationDays).toBe(3);
      expect(result.dailyRate).toBe(150000);
      expect(result.numOfCars).toBe(1);
      expect(result.rentalBase).toBe(450000); // 150000 * 3
      expect(result.addOnsTotal).toBe(60000); // 20000 * 1 * 3
      expect(result.subtotal).toBe(510000); // 450000 + 60000
      expect(result.vatRate).toBe(0.07);
      // VAT: Math.round(510000 * 7 / 100) = 35700
      expect(result.vat).toBe(35700);
      expect(result.total).toBe(545700);
      expect(result.totalPrice).toBe(545700);
      expect(result.addOnsBreakdown).toHaveLength(1);
      expect(result.addOnsBreakdown[0]).toEqual({
        addOn: '60d5ec49f1b2c8b1f8e4e1a1',
        price: 20000,
        quantity: 1,
        durationDays: 3,
        total: 60000,
      });
    });

    it('should round VAT 7% correctly to nearest Satang (half-up rounding)', () => {
      // Subtotal where 7% has a fractional Satang
      // subtotal = 100007 Satang
      // 100007 * 0.07 = 7000.49 -> rounds to 7000
      const res1 = calculatePricing({
        dailyRate: 100007,
        startDate: '2026-06-01',
        endDate: '2026-06-01',
      });
      expect(res1.subtotal).toBe(100007);
      expect(res1.vat).toBe(7000);
      expect(res1.total).toBe(107007);

      // subtotal = 100008 Satang
      // 100008 * 0.07 = 7000.56 -> rounds to 7001
      const res2 = calculatePricing({
        dailyRate: 100008,
        startDate: '2026-06-01',
        endDate: '2026-06-01',
      });
      expect(res2.subtotal).toBe(100008);
      expect(res2.vat).toBe(7001);
      expect(res2.total).toBe(107009);
    });

    it('should parse valid string inputs for numOfCars, price, and quantity', () => {
      const result = calculatePricing({
        dailyRate: 100000,
        startDate: '2026-06-01',
        endDate: '2026-06-02',
        numOfCars: ' 2 ',
        addOns: [
          {
            price: ' 50000 ',
            quantity: ' 2 ',
          },
        ],
      });

      expect(result.numOfCars).toBe(2);
      expect(result.rentalBase).toBe(200000);
      expect(result.addOnsTotal).toBe(100000); // 50000 * 2 * 1
      expect(result.subtotal).toBe(300000);
    });

    it('should handle null/omitted numOfCars, non-array addOns, and null/omitted item quantity', () => {
      // numOfCars = null defaults to 1
      // addOns = null defaults safely
      const res1 = calculatePricing({
        dailyRate: 100000,
        startDate: '2026-06-01',
        endDate: '2026-06-02',
        numOfCars: null,
        addOns: null,
      });
      expect(res1.numOfCars).toBe(1);
      expect(res1.addOnsTotal).toBe(0);

      // item.quantity = null and item.quantity = undefined defaults to quantity 1
      const res2 = calculatePricing({
        dailyRate: 100000,
        startDate: '2026-06-01',
        endDate: '2026-06-02',
        addOns: [
          { price: 20000, quantity: null },
          { price: 30000 }, // quantity omitted (undefined)
        ],
      });
      expect(res2.addOnsBreakdown[0].quantity).toBe(1);
      expect(res2.addOnsBreakdown[1].quantity).toBe(1);
      expect(res2.addOnsTotal).toBe(50000); // (20000*1 + 30000*1) * 1 day
    });
  });

  describe('calculatePricing Validation & Error Handling (Boundary Value Analysis)', () => {
    it('should throw 400 when dailyRate is missing, non-integer, float, or < 1', () => {
      expect(() =>
        calculatePricing({ dailyRate: null, startDate: '2026-06-01', endDate: '2026-06-02' })
      ).toThrow('Daily rate must be a positive integer in Satang (min: 1)');

      expect(() =>
        calculatePricing({ dailyRate: 1500.5, startDate: '2026-06-01', endDate: '2026-06-02' })
      ).toThrow('Daily rate must be a positive integer in Satang (min: 1)');

      expect(() =>
        calculatePricing({ dailyRate: 0, startDate: '2026-06-01', endDate: '2026-06-02' })
      ).toThrow('Daily rate must be a positive integer in Satang (min: 1)');

      expect(() =>
        calculatePricing({ dailyRate: -500, startDate: '2026-06-01', endDate: '2026-06-02' })
      ).toThrow('Daily rate must be a positive integer in Satang (min: 1)');
    });

    it('should throw 400 when dates are missing or invalid', () => {
      expect(() =>
        calculatePricing({ dailyRate: 100000, startDate: '', endDate: '2026-06-02' })
      ).toThrow('Please provide valid start and end dates');

      expect(() =>
        calculatePricing({ dailyRate: 100000, startDate: 'invalid-date', endDate: '2026-06-02' })
      ).toThrow('Please provide valid start and end dates');

      expect(() =>
        calculatePricing({ dailyRate: 100000, startDate: '2026-06-05', endDate: '2026-06-01' })
      ).toThrow('Rental return date cannot be before start date');
    });

    it('should throw 400 when duration exceeds 30 days', () => {
      expect(() =>
        calculatePricing({
          dailyRate: 100000,
          startDate: '2026-06-01',
          endDate: '2026-07-02', // 31 days
        })
      ).toThrow('Rental duration cannot exceed 30 days per booking');
    });

    it('should throw 400 when numOfCars is out of boundary (1-3)', () => {
      expect(() =>
        calculatePricing({
          dailyRate: 100000,
          startDate: '2026-06-01',
          endDate: '2026-06-02',
          numOfCars: 0,
        })
      ).toThrow('Number of cars must be an integer between 1 and 3');

      expect(() =>
        calculatePricing({
          dailyRate: 100000,
          startDate: '2026-06-01',
          endDate: '2026-06-02',
          numOfCars: 4,
        })
      ).toThrow('Number of cars must be an integer between 1 and 3');

      expect(() =>
        calculatePricing({
          dailyRate: 100000,
          startDate: '2026-06-01',
          endDate: '2026-06-02',
          numOfCars: 'not-a-number',
        })
      ).toThrow('Number of cars must be an integer between 1 and 3');

      expect(() =>
        calculatePricing({
          dailyRate: 100000,
          startDate: '2026-06-01',
          endDate: '2026-06-02',
          numOfCars: 1.5,
        })
      ).toThrow('Number of cars must be an integer between 1 and 3');
    });

    it('should throw 400 when addOn item is malformed', () => {
      expect(() =>
        calculatePricing({
          dailyRate: 100000,
          startDate: '2026-06-01',
          endDate: '2026-06-02',
          addOns: ['not-an-object'],
        })
      ).toThrow('Each addOn item must be an object');

      expect(() =>
        calculatePricing({
          dailyRate: 100000,
          startDate: '2026-06-01',
          endDate: '2026-06-02',
          addOns: [{ price: null }],
        })
      ).toThrow('Each addOn item must specify a non-negative integer price in Satang');

      expect(() =>
        calculatePricing({
          dailyRate: 100000,
          startDate: '2026-06-01',
          endDate: '2026-06-02',
          addOns: [{ price: 'invalid' }],
        })
      ).toThrow('AddOn price must be a non-negative integer in Satang');

      expect(() =>
        calculatePricing({
          dailyRate: 100000,
          startDate: '2026-06-01',
          endDate: '2026-06-02',
          addOns: [{ price: -100 }],
        })
      ).toThrow('AddOn price must be a non-negative integer in Satang');

      expect(() =>
        calculatePricing({
          dailyRate: 100000,
          startDate: '2026-06-01',
          endDate: '2026-06-02',
          addOns: [{ price: 5000, quantity: 0 }],
        })
      ).toThrow('AddOn quantity must be an integer of at least 1');

      expect(() =>
        calculatePricing({
          dailyRate: 100000,
          startDate: '2026-06-01',
          endDate: '2026-06-02',
          addOns: [{ price: 5000, quantity: 'invalid' }],
        })
      ).toThrow('AddOn quantity must be an integer of at least 1');

      expect(() =>
        calculatePricing({
          dailyRate: 100000,
          startDate: '2026-06-01',
          endDate: '2026-06-02',
          addOns: [{ price: 5000, quantity: 2.5 }],
        })
      ).toThrow('AddOn quantity must be an integer of at least 1');
    });
  });
});

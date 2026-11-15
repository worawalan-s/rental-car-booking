const path = require('path');
const fs = require('fs');
const mongoSanitize = require('express-mongo-sanitize');
const helmet = require('helmet');
const { xss } = require('express-xss-sanitizer');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const cors = require('cors');

describe('Task 15 / Issue #27: Assignment 12 Security Hardening Suite', () => {
  describe('1. Middleware Order in server.js (Course Assignment 12 & AGENTS.md §5.2)', () => {
    const serverPath = path.join(__dirname, '../server.js');
    const serverSource = fs.readFileSync(serverPath, 'utf8');

    it('enforces strict middleware execution order in server.js', () => {
      const idxJson = serverSource.indexOf('app.use(express.json());');
      const idxMongoSanitize = serverSource.indexOf('app.use(mongoSanitize());');
      const idxHelmet = serverSource.indexOf('app.use(helmet());');
      const idxXss = serverSource.indexOf('app.use(xss());');
      const idxRateLimit = serverSource.indexOf('app.use(limiter);');
      const idxHpp = serverSource.indexOf('app.use(hpp());');
      const idxCors = serverSource.indexOf('app.use(cors());');
      const idxCookie = serverSource.indexOf('app.use(cookieParser());');
      const idxQueryParser = serverSource.indexOf("app.set('query parser', 'extended');");

      expect(idxJson).toBeGreaterThan(-1);
      expect(idxMongoSanitize).toBeGreaterThan(idxJson);
      expect(idxHelmet).toBeGreaterThan(idxMongoSanitize);
      expect(idxXss).toBeGreaterThan(idxHelmet);
      expect(idxRateLimit).toBeGreaterThan(idxXss);
      expect(idxHpp).toBeGreaterThan(idxRateLimit);
      expect(idxCors).toBeGreaterThan(idxHpp);
      expect(idxCookie).toBeGreaterThan(idxCors);
      expect(idxQueryParser).toBeGreaterThan(idxCookie);
    });

    it('configures rateLimit with 100 max requests per 10 minutes window', () => {
      expect(serverSource).toMatch(/windowMs:\s*10\s*\*\s*60\s*\*\s*1000/);
      expect(serverSource).toMatch(/max:\s*100/);
    });

    it('configures extended query parser for bracketed query filters', () => {
      expect(serverSource).toMatch(/app\.set\(['"]query parser['"],\s*['"]extended['"]\)/);
    });
  });

  describe('2. NoSQL Injection Prevention (express-mongo-sanitize)', () => {
    it('strips leading "$" operators from nested object keys in req.body', () => {
      const req = {
        body: {
          email: { $gt: '' },
          username: 'admin',
        },
      };
      const res = {};
      const next = jest.fn();

      mongoSanitize()(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body.email.$gt).toBeUndefined();
      expect(req.body.username).toBe('admin');
    });
  });

  describe('3. Security HTTP Headers (helmet)', () => {
    it('sets standard security response headers (X-Content-Type-Options: nosniff)', () => {
      const req = { headers: {} };
      const headers = {};
      const res = {
        setHeader: (k, v) => {
          headers[k.toLowerCase()] = v;
        },
        getHeader: (k) => headers[k.toLowerCase()],
        removeHeader: jest.fn(),
      };
      const next = jest.fn();

      helmet()(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-dns-prefetch-control']).toBe('off');
    });
  });

  describe('4. Cross-Site Scripting Prevention (express-xss-sanitizer)', () => {
    it('sanitizes script tags from request body fields', () => {
      const req = {
        body: {
          name: '<script>alert("xss")</script>John Doe',
          comment: 'Normal text',
        },
      };
      const res = {};
      const next = jest.fn();

      xss()(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body.name).not.toContain('<script>');
      expect(req.body.comment).toBe('Normal text');
    });
  });

  describe('5. HTTP Parameter Pollution Guard (hpp)', () => {
    it('selects the last value when a parameter is duplicated in req.query', () => {
      const req = {
        query: {
          sort: ['dailyRate', '-createdAt'],
        },
      };
      const res = {};
      const next = jest.fn();

      hpp()(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.query.sort).toBe('-createdAt');
    });
  });

  describe('6. Cross-Origin Resource Sharing (cors)', () => {
    it('enables cross-origin headers on incoming requests', () => {
      const req = {
        method: 'GET',
        headers: {
          origin: 'http://example.com',
        },
      };
      const headers = {};
      const res = {
        setHeader: (k, v) => {
          headers[k.toLowerCase()] = v;
        },
        getHeader: (k) => headers[k.toLowerCase()],
        removeHeader: jest.fn(),
      };
      const next = jest.fn();

      cors()(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('7. Rate Limiter Configuration', () => {
    it('instantiates valid rate limiter middleware function', () => {
      const limiter = rateLimit({
        windowMs: 10 * 60 * 1000,
        max: 100,
      });

      expect(typeof limiter).toBe('function');
    });
  });
});

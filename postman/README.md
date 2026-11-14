# Rental Car Booking Platform: E2E Regression Suite & Automation

This directory contains the course-aligned **Postman Collection** and **Environment Configuration** for **Issue #16 (Centralized End-to-End Regression Snapshot Suite & Newman Collection)**.

---

## 📁 Files Included

- **`rental-car-stage1-2.collection.json`**: Postman v2.1 Collection covering **68 comprehensive requests** with **138 automated assertions**, schema validation, SLA thresholds, and domain invariant tests across 8 modules.
- **`rental-car-local.environment.json`**: Pre-configured environment variables for local testing (`http://localhost:5003`).
- **`fixtures/sample_license.png`**: Lightweight test image fixture for driver's license upload validation.
- **`newman-report.json`**: *(Generated upon running Newman)* JSON export detailing test run statistics, timings, and assertions.

---

## 🚀 How to Run

### Option A: Automated CLI Execution via Newman (Recommended)

Run the automated test runner in a single command. It will check/start the local server, run the full 68-request Newman regression test suite across all 8 modules, and output an execution report:

```bash
npm run test:postman
```

Or run Newman directly with an active server:

```bash
npx newman run postman/rental-car-stage1-2.collection.json \
  -e postman/rental-car-local.environment.json \
  --working-dir . \
  --reporters cli
```

---

### Option B: Postman App GUI (Collection Runner)

1. Open **Postman Desktop Application**.
2. Click **Import** (top left) and select:
   - `postman/rental-car-stage1-2.collection.json`
   - `postman/rental-car-local.environment.json`
3. In the top-right environment dropdown, select **"Rental Car Local Environment"**.
4. Start your local server: `npm start` (or `npm run dev`).
5. Click on the collection: **"Rental Car Booking Platform - E2E Regression & Grading Suite"**.
6. Click **Run Collection** (or the blue **Run** button).
7. Keep the default execution order and click **Run Rental Car Booking Platform...**.
8. All 68 requests and 138 assertions will run automatically without manual intervention.

---

### Option C: Jest Unit Test Suite

Run the isolated unit test suites (pricing engine, date calculation, 3-car quota invariants, course alignment, license upload):

```bash
npm test
```

---

## 🧪 Test Coverage & Invariant Verification Matrix

| Test Suite / Folder | Requests | Endpoints Covered | Key Invariants & Validations Verified |
| :--- | :---: | :--- | :--- |
| **00-Health** | 1 | `GET /health` | • Root API operational health check (`200 OK`)<br>• Success envelope `{ success: true, data: { status: 'healthy', service: 'Rental Car Booking API' } }` |
| **01-Auth** | 14 | `POST /login`, `GET /me`, `GET/POST /logout`, `POST /register`, `PUT /driver-license` | • Admin & User JWT Token extraction<br>• 401 Unauthorized on missing token, invalid token, & literal `Bearer null` token (Two-key error contract)<br>• Dual `GET` / `POST` `/logout` support<br>• **Invariant 3**: Privilege Escalation Guard rigorously verified via `GET /auth/me` with new token (`role === 'user'`)<br>• **Invariant 2**: Thai 10-digit telephone regex (`/^0[0-9]{9}$/`)<br>• Driver license upload validation (Happy path multipart/form-data upload, missing file 400 rejection, unauthorized 401 guard) |
| **02-Providers** | 9 | `GET /providers`, `GET /providers/:id`, `POST /providers`, `PUT /providers/:id`, `DELETE /providers/:id` | • Public provider catalog inspection & single provider lookup<br>• Clean two-key `CastError` masking (`400 Bad Request`) on invalid ObjectId<br>• 403 Forbidden for non-admin provider creation<br>• **Invariant 2**: Rejects non-10-digit Thai phone format (`400 Bad Request`)<br>• Admin Provider CRUD happy path (`POST` 201 -> `PUT` 200 -> `DELETE` 200 -> `GET` 404)<br>• Invalidation of Redis cache keys (`providers:*`) on create/update/delete |
| **03-Cars-and-Search** | 9 | `GET /cars`, `GET /cars/:id`, `GET /cars/search`, `POST /cars`, `PUT /cars/:id` | • **Task 4**: Faceted Aggregation response time **< 200ms SLA** (API_CONTRACTS.md §3.2)<br>• **Invariant 1**: Daily rates stored as integers in Satang (`Number.isInteger`)<br>• Clean two-key `CastError` masking (`400 Bad Request`) on invalid ObjectId<br>• 403 Forbidden for non-admin car mutations<br>• 400 Bad Request on invalid category enum and negative daily rates<br>• Admin car creation (201 Created) & update |
| **04-Pricing-Engine** | 3 | `POST /api/v1/pricing/calculate` | • **Task 5**: Pure Satang financial calculations **< 100ms SLA** (API_CONTRACTS.md §3.4)<br>• **Invariant 6**: Same-day rental (`startDate === endDate`) counts as 1 rental day<br>• 7% VAT rounding & fixed-point zero floating-point drift<br>• 400 Bad Request on invalid date ordering (`endDate < startDate`) |
| **05-AddOns** | 11 | `GET /addons`, `GET /addons/:id`, `POST /addons`, `PUT /addons/:id`, `DELETE /addons/:id` | • Public accessory catalog inspection & single add-on retrieval<br>• Admin Add-On CRUD happy path (`POST` 201 -> `PUT` 200 -> `DELETE` 200 -> `GET` 404)<br>• 403 Forbidden for non-admin add-on creation, update, and deletion<br>• 400 Bad Request on invalid category enum and negative daily rates |
| **06-Bookings-and-Quota** | 15 | `POST /bookings`, `GET /bookings/:id`, `PUT /bookings/:id`, `GET /bookings`, `GET /cars/:carId/bookings` | • **Invariant 5**: Strict Schedule Collision formula (`existingStart < newEnd && existingEnd > newStart`)<br>• Contiguous Adjacent Handover validation (same-day handover is valid)<br>• **Invariant 6**: Same-day booking creation (`startDate === endDate`)<br>• **Invariant 4**: Cumulative 3-Car Quota enforcement (4th active booking returns 400)<br>• **Invariant 4**: User cannot exceed 3-car quota on booking update (`PUT /bookings/:id` returns 400)<br>• **Invariant 4**: Admin Quota Exemption on booking update (`PUT /bookings/:id` returns 200 OK)<br>• **API_CONTRACTS.md §3.3**: Admin Booking Creation Prohibited (403 Forbidden)<br>• **Task 7**: Atomic add-on pessimistic reservation with stock decrement verification (`GET /addons/:id`)<br>• Nested `/cars/:carId/bookings` scoped listing (`200 OK`)<br>• Role-based booking isolation (User sees own, Admin sees all) |
| **07-Cleanup-and-Cascade** | 6 | `DELETE /bookings/:id`, `POST /cars/:carId/bookings`, `DELETE /cars/:id`, `GET /cars/:id`, `GET /bookings/:id` | • User booking deletion and stock release<br>• Nested `POST /cars/:carId/bookings` creation verified prior to cascade cleanup<br>• **Invariant 7**: Hard Delete & Cascade Delete removing vehicle and associated child bookings<br>• **Invariant 7**: Verification of automatic add-on inventory stock restoration upon booking cascade deletion (`GET /addons/:id`)<br>• Two-key 404 Not Found contract on both deleted vehicle and deleted child booking |

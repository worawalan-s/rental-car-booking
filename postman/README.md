# Rental Car Booking Platform: Postman API Verification & Automation

This directory contains the course-aligned **Postman Collection** and **Environment Configuration** for **Stage 1 & Stage 2 API Verification (Issue #29)**.

---

## 📁 Files Included

- **`rental-car-stage1-2.collection.json`**: Postman v2.1 Collection covering 39 comprehensive requests with automated assertions, schema validation, SLA thresholds, and domain invariant tests.
- **`rental-car-local.environment.json`**: Pre-configured environment variables for local testing (`http://localhost:5003`).

---

## 🚀 How to Run

### Option A: Automated CLI Execution via Newman (Recommended for Quick Demo)

Run the automated test runner in a single command. It will check/start the local server, run the full Newman test suite, and output an execution report:

```bash
npm run test:postman
```

Or run Newman directly with an active server:

```bash
npx newman run postman/rental-car-stage1-2.collection.json \
  -e postman/rental-car-local.environment.json \
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
5. Click on the collection: **"Rental Car Booking Platform - Stage 1 & 2 Verification Suite"**.
6. Click **Run Collection** (or the blue **Run** button).
7. Keep the default execution order and click **Run Rental Car Booking Platform...**.
8. All 39 requests and assertions will run automatically without manual clicks.

---

## 🧪 Test Coverage & Invariant Verification Matrix

| Test Suite / Folder | Endpoints Covered | Key Invariants & Validations Verified |
| :--- | :--- | :--- |
| **01-Auth** | `POST /login`, `GET /me`, `POST /logout`, `POST /register` | • Admin & User JWT Token extraction<br>• 401 Unauthorized on missing token & invalid token (Two-key error contract)<br>• **Invariant 3**: Privilege Escalation Guard rigorously verified via `GET /auth/me` with new token (`role === 'user'`)<br>• **Invariant 2**: Thai 10-digit telephone regex (`/^0[0-9]{9}$/`) |
| **02-Cars-and-Search** | `GET /cars`, `GET /cars/:id`, `GET /cars/search`, `POST /cars`, `PUT /cars/:id` | • **Task 4**: Faceted Aggregation response time **< 200ms SLA** (API_CONTRACTS.md §3.2)<br>• **Invariant 1**: Daily rates stored as integers in Satang (`Number.isInteger`)<br>• 403 Forbidden for non-admin car mutations<br>• Admin car creation (201 Created) & update |
| **03-Pricing-Engine** | `POST /api/v1/pricing/calculate` | • **Task 5**: Pure Satang financial calculations **< 100ms SLA** (API_CONTRACTS.md §3.4)<br>• **Invariant 6**: Same-day rental (`startDate === endDate`) counts as 1 rental day<br>• 7% VAT rounding & fixed-point zero floating-point drift<br>• 400 Bad Request on invalid date ordering (`endDate < startDate`) |
| **04-AddOns** | `GET /addons`, `GET /addons/:id`, `POST /addons`, `PUT /addons/:id`, `DELETE /addons/:id` | • Public accessory catalog inspection & single add-on retrieval<br>• Admin Add-on CRUD operations with provider scoping |
| **05-Bookings-and-Quota** | `POST /bookings`, `GET /bookings/:id`, `PUT /bookings/:id`, `GET /bookings` | • **Invariant 5**: Strict Schedule Collision formula (`existingStart < newEnd && existingEnd > newStart`)<br>• Contiguous Adjacent Handover validation (same-day handover is valid)<br>• **Invariant 6**: Same-day booking creation (`startDate === endDate`)<br>• **Invariant 4**: Cumulative 3-Car Quota enforcement (4th booking returns 400)<br>• **Invariant 4**: Admin Quota Exemption (Admin successfully creates bookings without 3-car limit)<br>• Role-based booking isolation (User sees own, Admin sees all) |
| **06-Cleanup-and-Cascade** | `DELETE /bookings/:id`, `DELETE /cars/:id`, `GET /cars/:id`, `GET /bookings/:id` | • User booking deletion and stock release<br>• **Invariant 7**: Hard Delete & Cascade Delete removing vehicle and associated child bookings<br>• Two-key 404 Not Found contract on both deleted vehicle and deleted child booking |

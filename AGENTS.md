# AI Agent Operational Guidelines: Rental Car Booking Platform

Welcome! You are pair programming on the **Rental Car Booking Platform** backend REST API developed for **Software Development Practice (Course 2110503)**.

Whenever an AI coding assistant interacts with this codebase, it MUST strictly adhere to the rules, domain invariants, and engineering standards detailed below.

---

## 1. Architectural Guardrails (Instructor MVC Pattern)

The system strictly follows the architectural pattern established in the course reference project (`VacQ`):

```
rental-car-booking/
├── config/             # Database connection (db.js) and config.env template
├── controllers/        # Express route handler logic
├── middleware/         # Auth (protect, authorize) and business validators (validate.js)
├── models/             # Mongoose schemas with data-level validations and virtuals
├── routes/             # Express routers mounting endpoints and middleware
├── utils/              # Pure domain calculators (pricing, dates)
├── tests/              # Jest and Supertest test suites
├── _data/              # Mock datasets for seeding
└── seeder.js           # CLI database import/destroy script
```

### Critical Architecture Rules
1. **Preserve Instructor Conventions**: Never replace or disrupt standard Express MVC patterns. Route paths, HTTP status codes, and payload envelopes MUST remain 100% compliant with the course evaluation suites and Postman/Newman autograders.
2. **Standardized Response Envelope**:
   - Success: `{ success: true, count?: number, data: ... }`
   - Failure: `{ success: false, message: "Clear description" }`
   - NEVER leak internal stack traces or database error structures to API consumers.
3. **No Unsanitized Global Queries**: Always scope query variables locally inside controller handlers to prevent cross-request leakage.

---

## 2. Inviolable Domain Invariants

Every AI agent working on models, controllers, or utilities MUST enforce these core invariants:

1. **Fixed-Point Arithmetic (Currency in Satang)**:
   - All prices and monetary values MUST be stored, calculated, and exchanged as **integers in Satang** (`100 Satang = 1.00 THB`).
   - Example: 1,500 THB/day is represented as `150000`.
   - Never use floating-point types for monetary values. Prevent IEEE 754 precision drift.
2. **Telephone Naming & Format**:
   - Attribute name is always **`tel`** (never `phone` or `telephone`).
   - Format is validated via regex for 10-digit Thai numbers: `/^0[0-9]{9}$/`.
3. **Roles & Privilege Escalation Guard**:
   - Allowed roles are strictly `['user', 'admin']`.
   - Public registration (`POST /api/v1/auth/register`) strictly sets `role: 'user'` regardless of payload.
4. **Cumulative 3-Car Quota Limit**:
   - Standard renters (`role: 'user'`) are limited to a maximum of 3 cars across all active reservations (`status` in `['Pending', 'Confirmed', 'Active']`).
   - Admin users are exempt from the quota limit.
5. **Schedule Collision Prevention**:
   - The same physical vehicle (`car._id`) cannot have overlapping active reservations.
   - Formula: Existing `startDate < newEndDate` AND Existing `endDate > newStartDate`.
6. **Same-Day Rental Duration**:
   - Same-day rentals (`startDate === endDate`) are valid and count as 1 rental day (`Math.max(1, duration)`).
7. **Hard Delete Lifecycle (Instructor Pattern)**:
   - Records and bookings are physically removed from the database (`deleteOne()`).
   - Cascade delete: Removing a Car automatically removes all associated Bookings (`deleteMany({ car: id })`).

---

## 3. Git Workflow & Stacked PR Strategy

We employ a disciplined Git strategy to enable seamless collaboration between Minnie (Developer 1) and Praise (Developer 2):

1. **Branch Naming**:
   - Features: `feat/<feature-name>` (e.g. `feat/pricing-engine`, `feat/search-pipeline`)
   - Bugfixes: `fix/<bug-name>`
   - Documentation: `docs/<topic>`
   - Refactor: `refactor/<scope>`
2. **Conventional Commits**:
   - Format: `<type>(<scope>): <concise description>`
   - Examples: `feat(bookings): add 3-car quota validation`, `test(pricing): add leap-year test vectors`
3. **Stacked PR Chain**:
   - Features are developed in atomic branches branching off their prerequisite feature.
   - PRs are submitted sequentially into `main` and require peer review before merging.
   - **ZERO DIRECT PUSHES TO `main`**.

---

## 4. Testing & Verification Mandate

1. **Course-Aligned Testing Strategy**:
   - **Current Stages (Stage 1 & 2)**: Verification is performed via Postman API collections and manual testing (matching Course Assignment 7.2 progression), testing happy paths, 400 bad requests, 401/403 auth errors, 404 not found, and 3-car quota enforcement.
   - **Automated Testing (Stage 3 / Task 9)**: Automated unit testing using Jest/Supertest (`npm test`) is deferred until testing is formally taught in class.
2. **Pre-PR Verification**:
   - Manual Postman verification of all new endpoints and error responses.
   - Syntax validation via `node -c <file>` on every new or modified JavaScript file.
3. **Database Seeding**:
   - Use `npm run seed` (`node seeder.js -i`) to refresh mock data in MongoDB Atlas.
   - Use `npm run seed:destroy` (`node seeder.js -d`) to wipe collections safely.

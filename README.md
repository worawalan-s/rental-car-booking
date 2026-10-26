# Rental Car Booking Platform - Backend API

RESTful API backend for Rental Car Booking platform developed for Software Development Practice (2110503).

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT & Cookies, Bcryptjs password hashing
- **Testing**: 

---

## Project Structure
```
rental-car-booking/
├── config/
│   ├── config.env.example    # Configuration template
│   ├── config.env            # Environment variables (ignored by git)
│   └── db.js                 # MongoDB connection logic
├── controllers/              # Request handlers
├── docs/
│   └── API_CONTRACTS.md      # Data models & API contracts specification
├── middleware/               # Auth & validation middleware
├── models/                   # Mongoose schemas
├── routes/                   # Express routes
├── utils/                    # Helper functions & pricing engines
├── .gitignore
├── package.json
├── README.md
└── server.js                 # Entry point
```

---

## Documentation & Contracts
- **[API Contracts & Data Models Reference](docs/API_CONTRACTS.md)**: Comprehensive schema definitions, currency format (Satang), and endpoint contracts for team collaboration.

---

## Getting Started

### 1. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 2. Environment Configuration
Copy the sample environment file and configure your credentials:
```bash
cp config/config.env.example config/config.env
```
Ensure `MONGO_URI` points to the MongoDB Atlas cluster and `JWT_SECRET` is set.

### 3. Run the Server
For development mode with hot-reloading:
```bash
npm run dev
```

For production start:
```bash
npm start
```

### 4. Health Check
Verify the server is running:
```bash
curl http://localhost:5000/api/v1/health
```

---

## Database Seeding & Mock Data

A standalone database seeder utility (`seeder.js`) and realistic mock datasets (`_data/`) are provided to populate the database with providers, cars across all 7 categories, sample reservations, and pre-configured test accounts.

### 1. Seeding Commands
```bash
# Import mock dataset into MongoDB
npm run seed

# Wipe all collections from MongoDB
npm run seed:destroy
```
*(Alternatively: `node seeder.js -i` or `node seeder.js -d`)*

### 2. Seeded Test Accounts
| Role | Email | Password | Telephone | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admin@rentalcar.com` | `adminpassword` | `0812345678` | Primary administrator with full RBAC access |
| **Admin** | `manager@rentalcar.com` | `managerpassword` | `0898765432` | Secondary administrator for management tasks |
| **User** | `john.doe@example.com` | `userpassword` | `0823456789` | Regular customer account |
| **User** | `jane.smith@example.com` | `userpassword` | `0834567890` | Regular customer account |
| **User** | `alice.johnson@example.com` | `userpassword` | `0845678901` | Regular customer account |

> [!NOTE]
> Each user account is individually hashed with a unique cryptographic salt upon seeding, guaranteeing password security and avoiding hash collisions.

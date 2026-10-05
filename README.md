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
├── middleware/               # Auth & validation middleware
├── models/                   # Mongoose schemas
├── routes/                   # Express routes
├── utils/                    # Helper functions & pricing engines
├── __tests__/                # Automated tests
├── .gitignore
├── package.json
├── README.md
└── server.js                 # Entry point
```

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

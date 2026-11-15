const express = require('express');
const {
  register,
  login,
  logout,
  getMe,
  uploadDriverLicense,
} = require('../controllers/auth');
const { protect } = require('../middleware/auth');
const { sanitizeAuthBody } = require('../middleware/validate');
const { uploadDriverLicenseImage } = require('../middleware/upload');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User registration, login, logout, profile inspection, and driver license verification
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     UserRegister:
 *       type: object
 *       required:
 *         - name
 *         - tel
 *         - email
 *         - password
 *       properties:
 *         name:
 *           type: string
 *           example: John Doe
 *         tel:
 *           type: string
 *           description: 10-digit Thai phone number starting with 0
 *           example: "0812345678"
 *         email:
 *           type: string
 *           format: email
 *           example: john.doe@example.com
 *         password:
 *           type: string
 *           format: password
 *           minLength: 6
 *           example: userpassword
 *     UserLogin:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: admin@rentalcar.com
 *         password:
 *           type: string
 *           format: password
 *           example: adminpassword
 *     AuthResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         _id:
 *           type: string
 *           example: 60d5ec49f1b2c8b1f8e4e1a1
 *         name:
 *           type: string
 *           example: John Doe
 *         email:
 *           type: string
 *           example: john.doe@example.com
 *         token:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Clear description of error
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new renter user (role strictly enforced as 'user')
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserRegister'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error or duplicate email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/register', sanitizeAuthBody, register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Authenticate user and receive JWT Bearer token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserLogin'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Missing email or password
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', sanitizeAuthBody, login);

/**
 * @swagger
 * /auth/logout:
 *   get:
 *     summary: Log user out and clear JWT cookie (Course Assignment 12 convention)
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logout successful
 *   post:
 *     summary: Log user out and clear JWT cookie
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.route('/logout').get(logout).post(logout);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get profile of currently authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile data
 *       401:
 *         description: Not authorized to access this route
 */
router.get('/me', protect, getMe);

/**
 * @swagger
 * /auth/driver-license:
 *   put:
 *     summary: Upload driver license credential image to S3 / local storage (max 2MB, JPEG/PNG/WEBP)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - license
 *             properties:
 *               license:
 *                 type: string
 *                 format: binary
 *                 description: Driver license image file (JPEG, PNG, or WEBP, max 2MB)
 *               idNumber:
 *                 type: string
 *                 example: "1103701234567"
 *     responses:
 *       200:
 *         description: Driver license uploaded and verification status set to Pending
 *       400:
 *         description: Missing file, invalid MIME type, or file exceeds 2MB
 *       401:
 *         description: Not authorized
 */
router.put('/driver-license', protect, uploadDriverLicenseImage, uploadDriverLicense);

module.exports = router;

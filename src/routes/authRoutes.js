const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { authMiddleware } = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/login', asyncHandler(authController.login));
router.get('/me', asyncHandler(authMiddleware), asyncHandler(authController.me));
router.post(
  '/profile/credentials',
  asyncHandler(authMiddleware),
  asyncHandler(authController.updateCredentials),
);

module.exports = router;

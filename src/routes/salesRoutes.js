const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { authMiddleware, requireStoreUser } = require('../middleware/auth');
const salesController = require('../controllers/salesController');

const router = express.Router();

router.use(asyncHandler(authMiddleware));
router.use(requireStoreUser);
router.post('/', asyncHandler(salesController.createSale));

module.exports = router;

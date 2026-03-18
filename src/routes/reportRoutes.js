const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { authMiddleware, requireStoreUser } = require('../middleware/auth');
const reportsController = require('../controllers/reportsController');

const router = express.Router();

router.use(asyncHandler(authMiddleware));
router.use(requireStoreUser);
router.get('/summary', asyncHandler(reportsController.getSummary));
router.post('/clear', asyncHandler(reportsController.clearReports));

module.exports = router;

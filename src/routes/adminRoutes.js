const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const adminAccountsController = require('../controllers/adminAccountsController');

const router = express.Router();

router.use(asyncHandler(authMiddleware));
router.use(requireAdmin);
router.get('/accounts', asyncHandler(adminAccountsController.listAccounts));
router.post('/accounts', asyncHandler(adminAccountsController.createAccount));
router.post('/accounts/:id/update', asyncHandler(adminAccountsController.updateAccount));
router.post('/accounts/:id/extend', asyncHandler(adminAccountsController.extendAccount));

module.exports = router;

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { authMiddleware, requireStoreUser } = require('../middleware/auth');
const productsController = require('../controllers/productsController');

const router = express.Router();

router.use(asyncHandler(authMiddleware));
router.use(requireStoreUser);
router.get('/', asyncHandler(productsController.listProducts));
router.get('/barcode/:barcode', asyncHandler(productsController.getProductByBarcode));
router.post('/', asyncHandler(productsController.upsertProduct));

module.exports = router;

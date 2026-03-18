const { z } = require('zod');
const pool = require('../db/pool');
const AppError = require('../utils/appError');

const upsertProductSchema = z.object({
  barcode: z.string().trim().min(2),
  name: z.string().trim().max(120).optional().default(''),
  price: z.coerce.number().min(0),
  quantity: z.coerce.number().int().positive(),
  expiresAt: z.string().trim().optional().nullable(),
});

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(400, 'Yaroqsiz sana yuborildi.');
  }

  return parsed;
}

async function listProducts(req, res) {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        barcode,
        name,
        price,
        quantity,
        expires_at AS expiresAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM products
      WHERE store_id = ?
      ORDER BY updated_at DESC, id DESC
    `,
    [req.user.storeId],
  );

  return res.json({
    products: rows,
  });
}

async function getProductByBarcode(req, res) {
  const barcode = String(req.params.barcode || '').trim();

  if (!barcode) {
    throw new AppError(400, 'Barcode yuborilishi kerak.');
  }

  const [rows] = await pool.query(
    `
      SELECT
        id,
        barcode,
        name,
        price,
        quantity,
        expires_at AS expiresAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM products
      WHERE store_id = ? AND barcode = ?
      LIMIT 1
    `,
    [req.user.storeId, barcode],
  );

  const product = rows[0];

  if (!product) {
    throw new AppError(404, 'Mahsulot topilmadi.');
  }

  return res.json({
    product,
  });
}

async function upsertProduct(req, res) {
  const payload = upsertProductSchema.parse(req.body);
  const expiresAt = normalizeDate(payload.expiresAt);
  const productName = payload.name || payload.barcode;

  const [existingRows] = await pool.query(
    `
      SELECT id
      FROM products
      WHERE store_id = ? AND barcode = ?
      LIMIT 1
    `,
    [req.user.storeId, payload.barcode],
  );

  if (existingRows.length > 0) {
    await pool.query(
      `
        UPDATE products
        SET
          name = ?,
          price = ?,
          expires_at = ?,
          quantity = quantity + ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE store_id = ? AND barcode = ?
      `,
      [
        productName,
        payload.price,
        expiresAt,
        payload.quantity,
        req.user.storeId,
        payload.barcode,
      ],
    );
  } else {
    await pool.query(
      `
        INSERT INTO products (
          store_id,
          barcode,
          name,
          price,
          quantity,
          expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        req.user.storeId,
        payload.barcode,
        productName,
        payload.price,
        payload.quantity,
        expiresAt,
      ],
    );
  }

  const [rows] = await pool.query(
    `
      SELECT
        id,
        barcode,
        name,
        price,
        quantity,
        expires_at AS expiresAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM products
      WHERE store_id = ? AND barcode = ?
      LIMIT 1
    `,
    [req.user.storeId, payload.barcode],
  );

  return res.status(existingRows.length > 0 ? 200 : 201).json({
    message: existingRows.length > 0
      ? 'Mahsulot miqdori yangilandi.'
      : 'Mahsulot saqlandi.',
    product: rows[0],
  });
}

module.exports = {
  listProducts,
  getProductByBarcode,
  upsertProduct,
};

const { z } = require('zod');
const pool = require('../db/pool');
const AppError = require('../utils/appError');

const saleSchema = z.object({
  items: z.array(z.object({
    barcode: z.string().trim().min(2),
    quantity: z.coerce.number().int().positive(),
  })).min(1),
});

function combineItems(items) {
  const map = new Map();

  for (const item of items) {
    const current = map.get(item.barcode) || 0;
    map.set(item.barcode, current + item.quantity);
  }

  return Array.from(map.entries()).map(([barcode, quantity]) => ({
    barcode,
    quantity,
  }));
}

async function createSale(req, res) {
  const payload = saleSchema.parse(req.body);
  const items = combineItems(payload.items);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const preparedItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const [rows] = await connection.query(
        `
          SELECT
            id,
            barcode,
            name,
            price,
            quantity
          FROM products
          WHERE store_id = ? AND barcode = ?
          LIMIT 1
          FOR UPDATE
        `,
        [req.user.storeId, item.barcode],
      );

      const product = rows[0];

      if (!product) {
        throw new AppError(404, `Barcode ${item.barcode} bo‘yicha mahsulot topilmadi.`);
      }

      if (product.quantity < item.quantity) {
        throw new AppError(
          400,
          `${product.name || product.barcode} uchun omborda yetarli miqdor yo‘q.`,
        );
      }

      const lineTotal = Number(product.price) * item.quantity;
      totalAmount += lineTotal;

      preparedItems.push({
        productId: product.id,
        barcode: product.barcode,
        name: product.name || product.barcode,
        unitPrice: Number(product.price),
        quantity: item.quantity,
        lineTotal,
        remainingQuantity: product.quantity - item.quantity,
      });
    }

    const [saleResult] = await connection.query(
      `
        INSERT INTO sales (store_id, total_amount)
        VALUES (?, ?)
      `,
      [req.user.storeId, totalAmount],
    );

    for (const item of preparedItems) {
      await connection.query(
        `
          INSERT INTO sale_items (
            sale_id,
            product_id,
            barcode_snapshot,
            name_snapshot,
            unit_price,
            quantity,
            line_total
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          saleResult.insertId,
          item.productId,
          item.barcode,
          item.name,
          item.unitPrice,
          item.quantity,
          item.lineTotal,
        ],
      );

      await connection.query(
        `
          UPDATE products
          SET
            quantity = quantity - ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND store_id = ?
        `,
        [item.quantity, item.productId, req.user.storeId],
      );
    }

    const [storeRows] = await connection.query(
      `
        SELECT name
        FROM stores
        WHERE id = ?
        LIMIT 1
      `,
      [req.user.storeId],
    );

    await connection.commit();

    return res.status(201).json({
      message: 'Savdo saqlandi.',
      sale: {
        id: saleResult.insertId,
        createdAt: new Date().toISOString(),
        totalAmount,
        storeName: storeRows[0]?.name || 'Do‘kon',
        items: preparedItems.map((item) => ({
          barcode: item.barcode,
          name: item.name,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
          remainingQuantity: item.remainingQuantity,
        })),
      },
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createSale,
};

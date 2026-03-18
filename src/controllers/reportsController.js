const bcrypt = require('bcryptjs');
const { z } = require('zod');
const pool = require('../db/pool');
const AppError = require('../utils/appError');

const clearReportsSchema = z.object({
  currentPassword: z.string().min(3),
});

async function getSummary(req, res) {
  const [todayRows] = await pool.query(
    `
      SELECT
        COUNT(*) AS ordersCount,
        COALESCE(SUM(total_amount), 0) AS totalAmount
      FROM sales
      WHERE store_id = ? AND DATE(created_at) = CURDATE()
    `,
    [req.user.storeId],
  );

  const [overallRows] = await pool.query(
    `
      SELECT
        COUNT(*) AS ordersCount,
        COALESCE(SUM(total_amount), 0) AS totalAmount
      FROM sales
      WHERE store_id = ?
    `,
    [req.user.storeId],
  );

  const [recentRows] = await pool.query(
    `
      SELECT
        DATE_FORMAT(created_at, '%Y-%m-%d') AS saleDate,
        COUNT(*) AS ordersCount,
        COALESCE(SUM(total_amount), 0) AS totalAmount
      FROM sales
      WHERE store_id = ?
      GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
      ORDER BY saleDate DESC
      LIMIT 14
    `,
    [req.user.storeId],
  );

  const [topRows] = await pool.query(
    `
      SELECT
        si.name_snapshot AS name,
        SUM(si.quantity) AS soldQuantity,
        COALESCE(SUM(si.line_total), 0) AS totalAmount
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE s.store_id = ?
      GROUP BY si.name_snapshot
      ORDER BY totalAmount DESC, soldQuantity DESC
      LIMIT 5
    `,
    [req.user.storeId],
  );

  return res.json({
    today: todayRows[0],
    overall: overallRows[0],
    recentDays: recentRows,
    topProducts: topRows,
  });
}

async function clearReports(req, res) {
  const payload = clearReportsSchema.parse(req.body);
  const isPasswordValid = await bcrypt.compare(payload.currentPassword, req.user.password_hash);

  if (!isPasswordValid) {
    throw new AppError(401, 'Parol noto\'g\'ri.');
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `
        DELETE si
        FROM sale_items si
        INNER JOIN sales s ON s.id = si.sale_id
        WHERE s.store_id = ?
      `,
      [req.user.storeId],
    );

    await connection.query(
      'DELETE FROM sales WHERE store_id = ?',
      [req.user.storeId],
    );

    await connection.commit();

    return res.json({
      message: 'Hisobotlar tozalandi.',
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  getSummary,
  clearReports,
};

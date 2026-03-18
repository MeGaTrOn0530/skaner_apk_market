const jwt = require('jsonwebtoken');
const env = require('../config/env');
const pool = require('../db/pool');
const AppError = require('../utils/appError');
const { ensureUserAccess, userSelectSql } = require('../services/userService');

async function authMiddleware(req, _res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError(401, 'Token topilmadi.'));
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const [rows] = await pool.query(
      `
        ${userSelectSql}
        WHERE u.id = ?
        LIMIT 1
      `,
      [Number(payload.sub)],
    );

    const user = rows[0];

    if (!user) {
      throw new AppError(401, 'Foydalanuvchi topilmadi.');
    }

    ensureUserAccess(user);
    req.user = {
      ...user,
      userId: user.id,
      storeId: user.store_id,
      fullName: user.full_name,
      storeName: user.store_name,
      phoneNumber: user.phone_number,
    };
    return next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }

    return next(new AppError(401, 'Token yaroqsiz yoki muddati tugagan.'));
  }
}

function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') {
    return next(new AppError(403, 'Faqat admin foydalanishi mumkin.'));
  }

  return next();
}

function requireStoreUser(req, _res, next) {
  if (req.user?.role !== 'store' || !req.user?.storeId) {
    return next(new AppError(403, 'Faqat do\'kon foydalanuvchisi foydalanishi mumkin.'));
  }

  return next();
}

module.exports = {
  authMiddleware,
  requireAdmin,
  requireStoreUser,
};

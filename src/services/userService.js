const AppError = require('../utils/appError');
const { supportPhone } = require('../config/constants');

const userSelectSql = `
  SELECT
    u.id,
    u.store_id,
    u.role,
    u.username,
    u.full_name,
    u.phone_number,
    u.password_hash,
    u.access_expires_at AS accessExpiresAt,
    u.last_login_at AS lastLoginAt,
    u.is_active,
    u.created_at AS createdAt,
    u.updated_at AS updatedAt,
    s.name AS store_name
  FROM users u
  LEFT JOIN stores s ON s.id = u.store_id
`;

function isExpired(user) {
  if (user.role !== 'store' || !user.accessExpiresAt) {
    return false;
  }

  return new Date(user.accessExpiresAt).getTime() < Date.now();
}

function ensureUserAccess(user) {
  if (!user || !user.is_active) {
    throw new AppError(401, 'Login yoki parol noto\'g\'ri.');
  }

  if (isExpired(user)) {
    throw new AppError(
      403,
      `Sizning vaqtingiz tugadi. Admin bilan bog'laning: ${supportPhone}`,
    );
  }
}

function formatUser(user) {
  return {
    id: user.id,
    storeId: user.store_id,
    role: user.role,
    username: user.username,
    fullName: user.full_name,
    phoneNumber: user.phone_number,
    storeName: user.store_name || 'Admin Panel',
    accessExpiresAt: user.accessExpiresAt,
    isActive: Boolean(user.is_active),
  };
}

module.exports = {
  userSelectSql,
  ensureUserAccess,
  formatUser,
  isExpired,
};

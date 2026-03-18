const bcrypt = require('bcryptjs');
const { z } = require('zod');
const pool = require('../db/pool');
const AppError = require('../utils/appError');

const createAccountSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  organizationName: z.string().trim().min(2).max(120),
  username: z.string().trim().min(3).max(60),
  password: z.string().min(4).max(120),
  phoneNumber: z.string().trim().min(5).max(40),
  durationMonths: z.coerce.number().int().min(1).max(60),
});

const updateAccountSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  organizationName: z.string().trim().min(2).max(120),
  username: z.string().trim().min(3).max(60),
  phoneNumber: z.string().trim().min(5).max(40),
  isActive: z.coerce.boolean(),
  password: z.string().trim().max(120).optional().default(''),
});

const extendSchema = z.object({
  months: z.coerce.number().int().min(1).max(60),
});

function addMonths(baseDate, months) {
  const next = new Date(baseDate);
  next.setMonth(next.getMonth() + months);
  return next;
}

async function getStoreAccountById(connection, id) {
  const [rows] = await connection.query(
    `
      SELECT
        u.id,
        u.store_id,
        u.role,
        u.username,
        u.full_name,
        u.phone_number,
        u.access_expires_at AS accessExpiresAt,
        u.is_active,
        u.created_at AS createdAt,
        u.updated_at AS updatedAt,
        s.name AS organizationName
      FROM users u
      INNER JOIN stores s ON s.id = u.store_id
      WHERE u.id = ? AND u.role = 'store'
      LIMIT 1
    `,
    [id],
  );

  return rows[0];
}

function serializeAccount(account) {
  const expiresAt = account.accessExpiresAt ? new Date(account.accessExpiresAt) : null;
  const diffMs = expiresAt ? expiresAt.getTime() - Date.now() : null;

  return {
    id: account.id,
    storeId: account.store_id,
    fullName: account.full_name,
    organizationName: account.organizationName,
    username: account.username,
    phoneNumber: account.phone_number,
    accessExpiresAt: account.accessExpiresAt,
    isActive: Boolean(account.is_active),
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    daysLeft: diffMs == null ? null : Math.ceil(diffMs / (1000 * 60 * 60 * 24)),
    status: !account.is_active
      ? 'inactive'
      : diffMs != null && diffMs < 0
        ? 'expired'
        : 'active',
  };
}

async function listAccounts(req, res) {
  const [rows] = await pool.query(
    `
      SELECT
        u.id,
        u.store_id,
        u.full_name,
        u.username,
        u.phone_number,
        u.access_expires_at AS accessExpiresAt,
        u.is_active,
        u.created_at AS createdAt,
        u.updated_at AS updatedAt,
        s.name AS organizationName
      FROM users u
      INNER JOIN stores s ON s.id = u.store_id
      WHERE u.role = 'store'
      ORDER BY u.created_at DESC, u.id DESC
    `,
  );

  return res.json({
    accounts: rows.map(serializeAccount),
  });
}

async function createAccount(req, res) {
  const payload = createAccountSchema.parse(req.body);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existingUsername] = await connection.query(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [payload.username],
    );

    if (existingUsername.length > 0) {
      throw new AppError(409, 'Bu login allaqachon mavjud.');
    }

    const [existingStore] = await connection.query(
      'SELECT id FROM stores WHERE name = ? LIMIT 1',
      [payload.organizationName],
    );

    if (existingStore.length > 0) {
      throw new AppError(409, 'Bu tashkilot uchun login allaqachon yaratilgan.');
    }

    const [storeResult] = await connection.query(
      'INSERT INTO stores (name) VALUES (?)',
      [payload.organizationName],
    );

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const accessExpiresAt = addMonths(new Date(), payload.durationMonths);

    const [userResult] = await connection.query(
      `
        INSERT INTO users (
          store_id,
          role,
          username,
          full_name,
          phone_number,
          password_hash,
          access_expires_at,
          is_active
        )
        VALUES (?, 'store', ?, ?, ?, ?, ?, 1)
      `,
      [
        storeResult.insertId,
        payload.username,
        payload.fullName,
        payload.phoneNumber,
        passwordHash,
        accessExpiresAt,
      ],
    );

    const account = await getStoreAccountById(connection, userResult.insertId);
    await connection.commit();

    return res.status(201).json({
      message: 'Store login yaratildi.',
      account: serializeAccount(account),
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateAccount(req, res) {
  const accountId = Number(req.params.id);
  const payload = updateAccountSchema.parse(req.body);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const current = await getStoreAccountById(connection, accountId);

    if (!current) {
      throw new AppError(404, 'Store login topilmadi.');
    }

    const [usernameConflict] = await connection.query(
      'SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1',
      [payload.username, accountId],
    );

    if (usernameConflict.length > 0) {
      throw new AppError(409, 'Bu login boshqa foydalanuvchiga tegishli.');
    }

    const [storeConflict] = await connection.query(
      'SELECT id FROM stores WHERE name = ? AND id <> ? LIMIT 1',
      [payload.organizationName, current.store_id],
    );

    if (storeConflict.length > 0) {
      throw new AppError(409, 'Bu tashkilot nomi allaqachon ishlatilgan.');
    }

    await connection.query(
      'UPDATE stores SET name = ? WHERE id = ?',
      [payload.organizationName, current.store_id],
    );

    let passwordFragment = '';
    const params = [
      payload.username,
      payload.fullName,
      payload.phoneNumber,
      payload.isActive ? 1 : 0,
    ];

    if (payload.password) {
      passwordFragment = ', password_hash = ?';
      params.push(await bcrypt.hash(payload.password, 10));
    }

    params.push(accountId);

    await connection.query(
      `
        UPDATE users
        SET
          username = ?,
          full_name = ?,
          phone_number = ?,
          is_active = ?
          ${passwordFragment}
        WHERE id = ?
      `,
      params,
    );

    const account = await getStoreAccountById(connection, accountId);
    await connection.commit();

    return res.json({
      message: 'Store login yangilandi.',
      account: serializeAccount(account),
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function extendAccount(req, res) {
  const accountId = Number(req.params.id);
  const payload = extendSchema.parse(req.body);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const current = await getStoreAccountById(connection, accountId);

    if (!current) {
      throw new AppError(404, 'Store login topilmadi.');
    }

    const baseDate = current.accessExpiresAt && new Date(current.accessExpiresAt) > new Date()
      ? new Date(current.accessExpiresAt)
      : new Date();
    const nextExpiry = addMonths(baseDate, payload.months);

    await connection.query(
      `
        UPDATE users
        SET access_expires_at = ?
        WHERE id = ?
      `,
      [nextExpiry, accountId],
    );

    const account = await getStoreAccountById(connection, accountId);
    await connection.commit();

    return res.json({
      message: 'Foydalanish vaqti uzaytirildi.',
      account: serializeAccount(account),
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listAccounts,
  createAccount,
  updateAccount,
  extendAccount,
};

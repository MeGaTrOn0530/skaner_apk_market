const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const pool = require('../db/pool');
const env = require('../config/env');
const AppError = require('../utils/appError');
const { ensureUserAccess, formatUser, userSelectSql } = require('../services/userService');

const loginSchema = z.object({
  username: z.string().trim().min(3),
  password: z.string().min(3),
});

const updateCredentialsSchema = z.object({
  username: z.string().trim().min(3).max(60),
  currentPassword: z.string().min(3).max(120),
  newPassword: z.string().trim().max(120).optional().default(''),
});

function buildToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      storeId: user.store_id,
      role: user.role,
      username: user.username,
    },
    env.jwtSecret,
    {
      expiresIn: '7d',
    },
  );
}

async function login(req, res) {
  const payload = loginSchema.parse(req.body);

  const [rows] = await pool.query(
    `
      ${userSelectSql}
      WHERE u.username = ?
      LIMIT 1
    `,
    [payload.username],
  );

  const user = rows[0];

  if (!user) {
    throw new AppError(401, 'Login yoki parol noto\'g\'ri.');
  }

  ensureUserAccess(user);

  const isPasswordValid = await bcrypt.compare(payload.password, user.password_hash);

  if (!isPasswordValid) {
    throw new AppError(401, 'Login yoki parol noto\'g\'ri.');
  }

  await pool.query(
    `
      UPDATE users
      SET last_login_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [user.id],
  );

  const token = buildToken(user);

  return res.json({
    token,
    user: formatUser(user),
  });
}

async function me(req, res) {
  return res.json({
    user: formatUser(req.user),
  });
}

async function updateCredentials(req, res) {
  const payload = updateCredentialsSchema.parse(req.body);
  const nextUsername = payload.username.trim();
  const nextPassword = payload.newPassword.trim();

  const [rows] = await pool.query(
    `
      ${userSelectSql}
      WHERE u.id = ?
      LIMIT 1
    `,
    [req.user.id],
  );

  const user = rows[0];

  if (!user) {
    throw new AppError(404, 'Foydalanuvchi topilmadi.');
  }

  const isPasswordValid = await bcrypt.compare(payload.currentPassword, user.password_hash);

  if (!isPasswordValid) {
    throw new AppError(401, 'Joriy parol noto\'g\'ri.');
  }

  const [conflicts] = await pool.query(
    'SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1',
    [nextUsername, user.id],
  );

  if (conflicts.length > 0) {
    throw new AppError(409, 'Bu login allaqachon band.');
  }

  const params = [nextUsername];
  let passwordSql = '';

  if (nextPassword.isNotEmpty) {
    passwordSql = ', password_hash = ?';
    params.push(await bcrypt.hash(nextPassword, 10));
  }

  params.push(user.id);

  await pool.query(
    `
      UPDATE users
      SET username = ?
      ${passwordSql}
      WHERE id = ?
    `,
    params,
  );

  const [updatedRows] = await pool.query(
    `
      ${userSelectSql}
      WHERE u.id = ?
      LIMIT 1
    `,
    [user.id],
  );

  const updatedUser = updatedRows[0];

  return res.json({
    message: 'Profil yangilandi.',
    token: buildToken(updatedUser),
    user: formatUser(updatedUser),
  });
}

module.exports = {
  login,
  me,
  updateCredentials,
};

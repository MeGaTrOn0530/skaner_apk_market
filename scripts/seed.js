const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');

function addMonths(baseDate, months) {
  const next = new Date(baseDate);
  next.setMonth(next.getMonth() + months);
  return next;
}

async function runSafeQuery(connection, sql, ignoredCodes = []) {
  try {
    await connection.query(sql);
  } catch (error) {
    if (ignoredCodes.includes(error.code)) {
      return;
    }
    throw error;
  }
}

async function ensureUserColumns(connection) {
  await runSafeQuery(
    connection,
    'ALTER TABLE users MODIFY COLUMN store_id INT UNSIGNED NULL',
  );

  await runSafeQuery(
    connection,
    "ALTER TABLE users ADD COLUMN role ENUM('admin', 'store') NOT NULL DEFAULT 'store' AFTER store_id",
    ['ER_DUP_FIELDNAME'],
  );

  await runSafeQuery(
    connection,
    'ALTER TABLE users ADD COLUMN phone_number VARCHAR(40) NULL AFTER full_name',
    ['ER_DUP_FIELDNAME'],
  );

  await runSafeQuery(
    connection,
    'ALTER TABLE users ADD COLUMN access_expires_at DATETIME NULL AFTER password_hash',
    ['ER_DUP_FIELDNAME'],
  );

  await runSafeQuery(
    connection,
    'ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL AFTER access_expires_at',
    ['ER_DUP_FIELDNAME'],
  );

  await runSafeQuery(
    connection,
    'ALTER TABLE users ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
    ['ER_DUP_FIELDNAME'],
  );
}

async function run() {
  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
  });

  try {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schemaSql = fs
      .readFileSync(schemaPath, 'utf8')
      .replace(/multi_store_inventory/g, env.db.database);

    await connection.query(schemaSql);
    await connection.query(`USE \`${env.db.database}\``);
    await ensureUserColumns(connection);

    const storePasswordHash = await bcrypt.hash('123456', 10);
    const adminPasswordHash = await bcrypt.hash('admin123', 10);

    await connection.query(
      `
        INSERT INTO stores (name)
        VALUES (?), (?)
        ON DUPLICATE KEY UPDATE name = VALUES(name)
      `,
      ["Demo Do'kon 1", "Demo Do'kon 2"],
    );

    const [stores] = await connection.query(
      `
        SELECT id, name
        FROM stores
        WHERE name IN (?, ?)
        ORDER BY id ASC
      `,
      ["Demo Do'kon 1", "Demo Do'kon 2"],
    );

    const storeOne = stores.find((store) => store.name === "Demo Do'kon 1");
    const storeTwo = stores.find((store) => store.name === "Demo Do'kon 2");
    const expiresAt = addMonths(new Date(), 12);

    await connection.query(
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
        VALUES
          (?, 'store', ?, ?, ?, ?, ?, 1),
          (?, 'store', ?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
          store_id = VALUES(store_id),
          role = VALUES(role),
          full_name = VALUES(full_name),
          phone_number = VALUES(phone_number),
          password_hash = VALUES(password_hash),
          access_expires_at = VALUES(access_expires_at),
          is_active = 1
      `,
      [
        storeOne.id,
        'store1',
        'Store One Admin',
        '930030531',
        storePasswordHash,
        expiresAt,
        storeTwo.id,
        'store2',
        'Store Two Admin',
        '930030532',
        storePasswordHash,
        expiresAt,
      ],
    );

    await connection.query(
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
        VALUES (NULL, 'admin', ?, ?, ?, ?, NULL, 1)
        ON DUPLICATE KEY UPDATE
          store_id = VALUES(store_id),
          role = VALUES(role),
          full_name = VALUES(full_name),
          phone_number = VALUES(phone_number),
          password_hash = VALUES(password_hash),
          access_expires_at = NULL,
          is_active = 1
      `,
      [
        'admin',
        'System Admin',
        '930030530',
        adminPasswordHash,
      ],
    );

    console.log('Seed tayyor.');
    console.log('Admin login: admin / admin123');
    console.log('Store login 1: store1 / 123456');
    console.log('Store login 2: store2 / 123456');
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

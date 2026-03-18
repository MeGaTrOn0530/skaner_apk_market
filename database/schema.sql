CREATE DATABASE IF NOT EXISTS multi_store_inventory
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE multi_store_inventory;

CREATE TABLE IF NOT EXISTS stores (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_store_name (name)
);

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NULL,
  role ENUM('admin', 'store') NOT NULL DEFAULT 'store',
  username VARCHAR(60) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  phone_number VARCHAR(40) NULL,
  password_hash VARCHAR(255) NOT NULL,
  access_expires_at DATETIME NULL,
  last_login_at DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_username (username),
  KEY idx_users_store_id (store_id),
  CONSTRAINT fk_users_store
    FOREIGN KEY (store_id) REFERENCES stores (id)
    ON DELETE CASCADE
);

ALTER TABLE users
  MODIFY COLUMN store_id INT UNSIGNED NULL;

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL,
  barcode VARCHAR(120) NOT NULL,
  name VARCHAR(120) NOT NULL,
  price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  quantity INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_store_barcode (store_id, barcode),
  KEY idx_products_store_id (store_id),
  CONSTRAINT fk_products_store
    FOREIGN KEY (store_id) REFERENCES stores (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sales (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id INT UNSIGNED NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sales_store_id (store_id),
  KEY idx_sales_created_at (created_at),
  CONSTRAINT fk_sales_store
    FOREIGN KEY (store_id) REFERENCES stores (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  barcode_snapshot VARCHAR(120) NOT NULL,
  name_snapshot VARCHAR(120) NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  line_total DECIMAL(12, 2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sale_items_sale_id (sale_id),
  KEY idx_sale_items_product_id (product_id),
  CONSTRAINT fk_sale_items_sale
    FOREIGN KEY (sale_id) REFERENCES sales (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_sale_items_product
    FOREIGN KEY (product_id) REFERENCES products (id)
    ON DELETE RESTRICT
);

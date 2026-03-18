CREATE DATABASE IF NOT EXISTS multi_store_inventory CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'apkcheck_user'@'localhost' IDENTIFIED BY 'ApkCheckLocal2026';
ALTER USER 'apkcheck_user'@'localhost' IDENTIFIED BY 'ApkCheckLocal2026';
CREATE USER IF NOT EXISTS 'apkcheck_user'@'127.0.0.1' IDENTIFIED BY 'ApkCheckLocal2026';
ALTER USER 'apkcheck_user'@'127.0.0.1' IDENTIFIED BY 'ApkCheckLocal2026';
GRANT ALL PRIVILEGES ON multi_store_inventory.* TO 'apkcheck_user'@'localhost';
GRANT ALL PRIVILEGES ON multi_store_inventory.* TO 'apkcheck_user'@'127.0.0.1';
FLUSH PRIVILEGES;

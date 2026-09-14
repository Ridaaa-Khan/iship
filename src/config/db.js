const mysql = require('mysql2/promise');
const env = require('./env');
const { log, logError } = require('../utils/logger');

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

async function connect() {
  try {
    await pool.query('SELECT 1');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scanner_profiles (
        id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id       BIGINT UNSIGNED NOT NULL,
        scanner_name  VARCHAR(150) NOT NULL,
        gate_number   VARCHAR(50) NULL,
        created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_scanner_profiles_user_id (user_id),
        CONSTRAINT fk_scanner_profiles_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await pool.query(`
      INSERT INTO scanner_profiles (user_id, scanner_name, gate_number)
      SELECT u.id, SUBSTRING_INDEX(u.email, '@', 1), NULL
      FROM users u
      LEFT JOIN scanner_profiles sp ON sp.user_id = u.id
      WHERE u.role = 'SCANNER' AND sp.id IS NULL
    `);
    log('MySQL pool connected');
    return pool;
  } catch (err) {
    logError('MySQL connection failed', err.message);
    throw err;
  }
}

module.exports = pool;
module.exports.connect = connect;

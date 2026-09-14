const pool = require('../src/config/db');
const { log, logError } = require('../src/utils/logger');

async function hasColumn(column) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS n
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'event_registrations'
       AND COLUMN_NAME = :column`,
    { column }
  );
  return Number(rows[0].n) > 0;
}

async function addColumn(sql, column) {
  if (await hasColumn(column)) {
    log('Column already present', column);
    return;
  }
  await pool.execute(sql);
  log('Added column', column);
}

async function run() {
  try {
    await addColumn(
      `ALTER TABLE event_registrations
       ADD COLUMN addon_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER amount_paise`,
      'addon_count'
    );
    await addColumn(
      `ALTER TABLE event_registrations
       ADD COLUMN entered_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER addon_count`,
      'entered_count'
    );
    log('Add-on migration complete');
  } catch (err) {
    logError('Add-on migration failed', err.message || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();

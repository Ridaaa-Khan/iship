const pool = require('../src/config/db');
const { log, logError } = require('../src/utils/logger');

async function hasColumn(column) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS n
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'member_profiles'
       AND COLUMN_NAME = :column`,
    { column }
  );
  return Number(rows[0].n) > 0;
}

async function dropColumn(column) {
  if (!(await hasColumn(column))) {
    log('Column already absent', column);
    return;
  }
  await pool.execute(`ALTER TABLE member_profiles DROP COLUMN ${column}`);
  log('Dropped column', column);
}

async function run() {
  try {
    await dropColumn('student_id');
    await dropColumn('department');
    log('Member profile column cleanup complete');
  } catch (err) {
    logError('Member profile column cleanup failed', err.message || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();

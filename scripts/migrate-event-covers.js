require('dotenv').config();

const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 4000),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true'
      ? { minVersion: 'TLSv1.2' }
      : undefined,
  });

  try {
    const [events] = await connection.execute(
      'SELECT id, title, cover_image, cover_image_public_id FROM events ORDER BY id'
    );

    let uploaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const event of events) {
      const filename = event.cover_image;

      if (!filename || /^https?:\/\//i.test(filename) || event.cover_image_public_id) {
        console.log(`SKIP: ${event.title} (already migrated or no image)`);
        skipped++;
        continue;
      }

      const filePath = path.join(
        __dirname,
        '../uploads/events',
        path.basename(filename)
      );

      if (!fs.existsSync(filePath)) {
        console.log(`MISSING: ${event.title} — ${filename}`);
        failed++;
        continue;
      }

      try {
        const result = await cloudinary.uploader.upload(filePath, {
          folder: 'iship/event-covers',
          resource_type: 'image',
        });

        await connection.execute(
          'UPDATE events SET cover_image = ?, cover_image_public_id = ? WHERE id = ?',
          [result.secure_url, result.public_id, event.id]
        );

        console.log(`UPLOADED: ${event.title}`);
        uploaded++;
      } catch (error) {
        console.error(`FAILED: ${event.title} — ${error.message}`);
        failed++;
      }
    }

    console.log('\nMigration summary:');
    console.log(`Uploaded: ${uploaded}`);
    console.log(`Skipped:  ${skipped}`);
    console.log(`Missing/failed: ${failed}`);
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error('Migration stopped:', error.message);
  process.exitCode = 1;
});

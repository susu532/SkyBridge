const Database = require('better-sqlite3');
const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.db'));
for (const file of files) {
  try {
    const db = new Database(file);
    const rows = db.prepare('SELECT world, COUNT(*) as count FROM chunk_data GROUP BY world').all();
    if (rows.length > 0) {
      console.log(file, rows);
    }
  } catch (e) {
    // Ignore errors for non-matching schema
  }
}

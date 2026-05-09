import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'skybridge.db');
const db = new Database(dbPath);
const stmt = db.prepare(`DELETE FROM chunk_data WHERE world LIKE '%skycastles%'`);
const result = stmt.run();
console.log(`Deleted ${result.changes} chunks from skycastles world.`);

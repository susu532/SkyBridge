import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const cwd = process.cwd();
const dbPath = path.join(cwd, 'db_skycastles_1.db');
if (!fs.existsSync(dbPath)) {
    console.error("Database not found", dbPath);
    process.exit(1);
}

const db = new Database(dbPath);
const worlds = db.prepare(`SELECT DISTINCT world FROM chunk_data`).all();
console.log("Worlds:", worlds);

const chunks = db.prepare(`SELECT * FROM chunk_data WHERE world = 'skycastles_1'`).all();
console.log("Found chunks for skycastles_1:", chunks.length);

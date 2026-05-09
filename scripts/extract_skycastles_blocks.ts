import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'skybridge.db');
const db = new Database(dbPath);

console.log('Fetching chunks for skycastles world...');
const rows = db.prepare(`SELECT * FROM chunk_data WHERE world LIKE '/skycastles_%'`).all() as any[];

const bakedBlocks: Record<string, number> = {};

for (const row of rows) {
  try {
    const chunkBlocks = JSON.parse(row.data);
    for (const key of Object.keys(chunkBlocks)) {
      bakedBlocks[key] = chunkBlocks[key];
    }
  } catch (err) {
    console.error('Error parsing chunk:', row.chunk_id, err);
  }
}

const outPath = path.join(process.cwd(), 'data', 'skycastlesBakedBlocks.json');
fs.writeFileSync(outPath, JSON.stringify(bakedBlocks, null, 2));

console.log(`Saved ${Object.keys(bakedBlocks).length} baked blocks to ${outPath}`);

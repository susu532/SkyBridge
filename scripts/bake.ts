import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB structure: chunk_data(world, chunk_id, data)
const db = new Database('skybridge.db');

// Currently active skycastles server
const getChunks = db.prepare(`SELECT chunk_id, data FROM chunk_data WHERE world LIKE '%skycastles%'`);

const rows = getChunks.all() as any[];
console.log(`Found ${rows.length} chunk parts for skycastles.`);

let bakedBlocksData: Record<string, number> = {};

try {
  const existingBaked = fs.readFileSync(path.join(__dirname, '../data/bakedBlocks.json'), 'utf8');
  bakedBlocksData = JSON.parse(existingBaked);
} catch (e) {
  console.log('No existing bakedBlocks.json, creating new.');
}

for (const row of rows) {
  const chunkBlocks = JSON.parse(row.data) as Record<string, number>;
  for (const [key, blockType] of Object.entries(chunkBlocks)) {
    bakedBlocksData[key] = blockType;
  }
}

fs.writeFileSync(
  path.join(__dirname, '../data/bakedBlocks.json'), 
  JSON.stringify(bakedBlocksData, null, 2)
);

console.log('Saved skycastles modifications into bakedBlocks.json!');

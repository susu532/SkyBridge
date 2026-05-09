import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'skybridge.db');
const db = new Database(dbPath);

const getChunks = db.prepare(`SELECT world, chunk_id, data FROM chunk_data`);
const allData = getChunks.all() as any[];
console.log(`Found ${allData.length} total chunk rows.`);

const outPathRaw = path.join(process.cwd(), 'data', 'skycastlesBakedBlocks.json');
let existingBlocks: Record<string, number> = {};
if (fs.existsSync(outPathRaw)) {
  try {
    existingBlocks = JSON.parse(fs.readFileSync(outPathRaw, 'utf-8'));
    console.log(`Loaded ${Object.keys(existingBlocks).length} existing baked blocks.`);
  } catch (err) {}
}

const skycastlesBlocks: Record<string, number> = { ...existingBlocks };

for (const row of allData) {
  if (!row.world.includes('skycastles')) continue;
  try {
    const chunkBlocks = JSON.parse(row.data);
    for (const key of Object.keys(chunkBlocks)) {
      skycastlesBlocks[key] = chunkBlocks[key];
    }
  } catch (err) { }
}

fs.writeFileSync(outPathRaw, JSON.stringify(skycastlesBlocks, null, 2));

const numBlocks = Object.keys(skycastlesBlocks).length;
console.log(`Saved ${numBlocks} baked blocks to ${outPathRaw}`);

if (numBlocks > 0) {
  const tsContent = `export const skycastlesBakedBlocks = new Map<string, number>([\n` +
    Object.entries(skycastlesBlocks).map(([k, v]) => `  ["${k}", ${v}]`).join(',\n') +
    `\n]);\n`;
  fs.writeFileSync(path.join(process.cwd(), 'src', 'game', 'SkycastlesBakedBlocks.ts'), tsContent);
  console.log(`Saved ${numBlocks} baked blocks to src/game/SkycastlesBakedBlocks.ts`);
}

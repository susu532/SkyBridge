import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Constants
const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 256;
const WORLD_Y_OFFSET = -60;

const cwd = process.cwd();

async function bakeSkycastles() {
  const dbPath = path.join(cwd, 'db_skycastles_1.db');
  
  if (!fs.existsSync(dbPath)) {
    console.error("No skycastles database found at", dbPath);
    return;
  }

  const db = new Database(dbPath);
  
  // Read all existing baked blocks from JSON
  const mapPath = path.join(cwd, 'data', 'skycastlesBakedBlocks.json');
  let bakedBlocks: Record<string, number> = {};
  if (fs.existsSync(mapPath)) {
    try {
      bakedBlocks = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    } catch (e) {
      console.error('Error parsing skycastlesBakedBlocks.json:', e);
    }
  }

  const rows = db.prepare(`SELECT chunk_id, data FROM chunk_data WHERE world = 'skycastles_1'`).all() as any[];
  
  let newlyAdded = 0;
  
  for (const row of rows) {
    if (!row.data) continue;
    
    if (typeof row.data === 'string' && row.data.startsWith('{')) {
      const chunkBlocks = JSON.parse(row.data);
      for (const k of Object.keys(chunkBlocks)) {
        if (chunkBlocks[k] !== 0) {
          bakedBlocks[k] = chunkBlocks[k];
          newlyAdded++;
        }
      }
    } else {
      const arr = new Uint16Array(
        row.data.buffer,
        row.data.byteOffset,
        row.data.byteLength / 2
      );
      
      const [cx, cz] = row.chunk_id.split(',').map(Number);
      
      for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
             const idx = lx | (lz << 4) | (ly << 8);
             const type = arr[idx];
             if (type !== 0 && type !== 65535) {
               const wx = cx * CHUNK_SIZE + lx;
               const wz = cz * CHUNK_SIZE + lz;
               const wy = ly + WORLD_Y_OFFSET;
               const key = `${wx},${wy},${wz}`;
               bakedBlocks[key] = type;
               newlyAdded++;
             }
          }
        }
      }
    }
  }

  // Also remove air blocks if user manually deleted a baked block!
  // Actually, wait, if type === 0, it means the user deleted it.
  for (const row of rows) {
    if (!row.data) continue;
    if (typeof row.data === 'string' && row.data.startsWith('{')) {
      const chunkBlocks = JSON.parse(row.data);
      for (const k of Object.keys(chunkBlocks)) {
        if (chunkBlocks[k] === 0 && bakedBlocks[k]) {
          delete bakedBlocks[k];
        }
      }
    } else {
      const arr = new Uint16Array(
        row.data.buffer,
        row.data.byteOffset,
        row.data.byteLength / 2
      );
      const [cx, cz] = row.chunk_id.split(',').map(Number);
      for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
             const idx = lx | (lz << 4) | (ly << 8);
             const type = arr[idx];
             if (type === 0) {
               const wx = cx * CHUNK_SIZE + lx;
               const wz = cz * CHUNK_SIZE + lz;
               const wy = ly + WORLD_Y_OFFSET;
               const key = `${wx},${wy},${wz}`;
               if (bakedBlocks[key] !== undefined) {
                 delete bakedBlocks[key];
               }
             }
          }
        }
      }
    }
  }
  
  // Write updated blocks back to JSON
  fs.writeFileSync(mapPath, JSON.stringify(bakedBlocks, null, 2), 'utf8');

  // Next, we also need to write to `src/game/SkycastlesBakedBlocks.ts` so it gets bundled
  let tsContent = 'export const skycastlesBakedBlocks = new Map<string, number>([\n';
  const entries = Object.entries(bakedBlocks);
  for (let i = 0; i < entries.length; i++) {
    const [k, v] = entries[i];
    tsContent += `  ["${k}", ${v}]${i < entries.length - 1 ? ',' : ''}\n`;
  }
  tsContent += ']);\n';
  
  const tsPath = path.join(cwd, 'src', 'game', 'SkycastlesBakedBlocks.ts');
  fs.writeFileSync(tsPath, tsContent, 'utf8');
  
  // Finally, wipe the SQLite database chunk_data for skycastles so we don't double load
  db.prepare(`DELETE FROM chunk_data WHERE world = 'skycastles_1'`).run();
  
  console.log(`Baking complete! Added/Updated ${newlyAdded} blocks into SkycastlesBakedBlocks.ts! DB chunk_data cleared.`);
}

bakeSkycastles().catch(console.error);

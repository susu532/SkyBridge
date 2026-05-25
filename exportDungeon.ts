import Database from 'better-sqlite3';
import fs from 'fs';

const db = new Database('db_dungeondelver_1.db');
const rows = db.prepare('SELECT chunk_id, data FROM chunk_data WHERE world = ?').all('dungeondelver_1');

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 256;
const WORLD_Y_OFFSET = -60;
const bakedBlocks: Record<string, number> = {};

for (const row of rows) {
  const [cxStr, czStr] = (row as any).chunk_id.split(',');
  const cx = parseInt(cxStr);
  const cz = parseInt(czStr);
  
  const buffer = (row as any).data as Buffer;
  // Decode raw chunk data (Uint16Array)
  const changes = new Uint16Array(buffer.buffer, buffer.byteOffset, Math.floor(buffer.byteLength / 2));
  
  for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const type = changes[lx | (lz << 4) | (ly << 8)];
        if (type !== 65535) { // 65535 identifies 'unmodified'
          const wx = cx * CHUNK_SIZE + lx;
          const wy = ly + WORLD_Y_OFFSET;
          const wz = cz * CHUNK_SIZE + lz;
          bakedBlocks[`${wx},${wy},${wz}`] = type;
        }
      }
    }
  }
}

fs.writeFileSync('data/dungeonBakedBlocks.json', JSON.stringify(bakedBlocks));
console.log(`Exported ${Object.keys(bakedBlocks).length} blocks.`);

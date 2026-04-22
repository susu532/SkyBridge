import fs from 'fs';
import path from 'path';

const serverTs = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');

const match = serverTs.match(/\/\/ BAKED_BLOCKS_START\s*const bakedBlocks = new Map<string, number>\(\[\s*([\s\S]*?)\s*\]\);\s*\/\/ BAKED_BLOCKS_END/);
if (match) {
  const innerString = match[1];
  // extract pairs
  const mapData: Record<string, number> = {};
  const pairs = innerString.split('],').map(s => s.trim().replace(/^\[/, '').replace(/\]$/, ''));

  for (const pairStr of pairs) {
    if (!pairStr) continue;
    const parts = pairStr.split(',');
    if (parts.length >= 2) {
      const key = parts[0].replace(/"/g, '').trim();
      const valStr = parts.slice(1).join(',').replace(/"/g, '').trim();
      if (key && valStr !== '') {
          // The string was ["-1,4,-32", 4] => parts = '"-1', '4', '-32"', '4'
          // let's just eval
          const tuple = eval(`[${pairStr}]`);
          mapData[tuple[0]] = tuple[1];
      }
    }
  }

  fs.writeFileSync(path.join(process.cwd(), 'data', 'bakedBlocks.json'), JSON.stringify(mapData, null, 2));
  console.log("Extracted bakedBlocks successfully!");
} else {
  console.log("Could not find baked blocks in server.ts");
}

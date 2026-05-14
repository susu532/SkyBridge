import fs from 'fs';

const data = JSON.parse(fs.readFileSync('data/skycastlesBakedBlocks.json', 'utf8'));

let minX = 999, maxX = -999, minZ = 999, maxZ = -999, minY = 999, maxY = -999;
let count = 0;
for (const key in data) {
  const amount = data[key];
  if (amount === 0) continue; 
  const [x, y, z] = key.split(',').map(Number);
  minX = Math.min(minX, x);
  maxX = Math.max(maxX, x);
  minY = Math.min(minY, y);
  maxY = Math.max(maxY, y);
  minZ = Math.min(minZ, z);
  maxZ = Math.max(maxZ, z);
  count++;
}
console.log(`Baked blocks count: ${count}`);
console.log(`X: ${minX} to ${maxX}`);
console.log(`Y: ${minY} to ${maxY}`);
console.log(`Z: ${minZ} to ${maxZ}`);

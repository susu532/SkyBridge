const fs = require('fs');
const data = JSON.parse(fs.readFileSync('skycastles_world_data.json', 'utf8'));
let maxY = -100;
let keys = [];

for (const key in data.blockChanges || {}) {
  const [x, y, z] = key.split(',').map(Number);
  if (Math.abs(z) <= 15) {
    if (y > maxY) {
      maxY = y;
      keys = [key];
    } else if (y === maxY) {
      keys.push(key);
    }
  }
}
console.log(`Highest block in skycastles_world_data.json mid is Y=${maxY} at keys:`, keys.slice(0, 10));
















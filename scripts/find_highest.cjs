const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data/bakedBlocks.json', 'utf8'));

for (const key in data) {
  const [x, y, z] = key.split(',').map(Number);
  if (Math.abs(x) < 5 && Math.abs(z - 80) < 5) {
    console.log(key, data[key]);
  }
}






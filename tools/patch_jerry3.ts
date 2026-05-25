import fs from 'fs';
const data = fs.readFileSync('src/game/data/npcs.json', 'utf8');
const patched = data.replace(/"type": 443,\s*"price": 100,/g, '"type": 443,\n          "price": 1000,');
fs.writeFileSync('src/game/data/npcs.json', patched);

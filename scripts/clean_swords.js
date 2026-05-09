import fs from 'fs';

const data = JSON.parse(fs.readFileSync('src/game/data/npcs.json', 'utf8'));

const swordTypes = [441, 442, 443, 444, 445];

function processItems(items) {
  if (!items) return;
  for (const item of items) {
    if (swordTypes.includes(item.type)) {
      if (item.metadata) {
        delete item.metadata.durability;
        delete item.metadata.maxDurability;
      }
    }
  }
}

for (const mapName of Object.keys(data)) {
  const npcs = data[mapName];
  for (const npc of npcs) {
    if (npc.shopItems) {
      processItems(npc.shopItems);
    }
  }
}

fs.writeFileSync('src/game/data/npcs.json', JSON.stringify(data, null, 2));
console.log('Done cleaning npcs.json');

import fs from 'fs';

const data = JSON.parse(fs.readFileSync('src/game/data/npcs.json', 'utf8'));
data.skycastles.forEach((npc: any) => {
  if (npc.id === 'jerry_weapons_red' || npc.id === 'jerry_weapons_blue') {
    npc.shopItems = npc.shopItems.filter((item: any) => item.type !== 441 && item.type !== 462);
  }
});
fs.writeFileSync('src/game/data/npcs.json', JSON.stringify(data, null, 2) + '\n');

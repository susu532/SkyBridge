import fs from 'fs';

const data = JSON.parse(fs.readFileSync('src/game/data/npcs.json', 'utf8'));

for (let npc of data.skybridge) {
  if (npc.id.startsWith('merchant_blue_') && npc.position.z > 130) {
    npc.position.z -= 70;
  } else if (npc.id.startsWith('merchant_red_') && npc.position.z < -130) {
    npc.position.z += 70;
  }
}

fs.writeFileSync('src/game/data/npcs.json', JSON.stringify(data, null, 2));
console.log("Updated npcs.json");

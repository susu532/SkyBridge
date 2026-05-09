const fs = require('fs');
const npcs = JSON.parse(fs.readFileSync('src/game/data/npcs.json', 'utf8'));

const newShopItems = [
  {
    "type": 437,
    "price": 350,
    "currency": 501,
    "metadata": {
      "rarity": "Uncommon",
      "durability": 131,
      "maxDurability": 131,
      "stats": {
        "miningSpeed": 4,
        "miningStamina": 1,
        "miningTier": 2
      }
    }
  },
  {
    "type": 514,
    "price": 450,
    "currency": 501,
    "metadata": {
      "rarity": "Rare"
    }
  },
  {
    "type": 441,
    "price": 100,
    "currency": 501,
    "metadata": {
      "rarity": "Common",
      "durability": 59,
      "maxDurability": 59,
      "stats": {
        "damage": 10,
        "strength": 5
      }
    }
  },
  {
    "type": 443,
    "price": 700,
    "currency": 501,
    "metadata": {
      "rarity": "Rare",
      "durability": 250,
      "maxDurability": 250,
      "stats": {
        "damage": 30,
        "strength": 15
      }
    }
  },
  {
    "type": 445,
    "price": 1000,
    "currency": 501,
    "metadata": {
      "rarity": "Epic",
      "durability": 1561,
      "maxDurability": 1561,
      "stats": {
        "damage": 50,
        "strength": 30
      }
    }
  }
];

let found = 0;
for (const npc of npcs) {
  if (npc.id === "jerry_weapons_red" || npc.id === "jerry_weapons_blue") {
    npc.shopItems = newShopItems;
    found++;
  }
}

console.log(`Updated ${found} NPCs`);
fs.writeFileSync('src/game/data/npcs.json', JSON.stringify(npcs, null, 2));

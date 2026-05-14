import { writeFileSync } from "fs";

const urls = [
  "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/damage/hit2.ogg",
  "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/damage/hit3.ogg",
  "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/sounds/damage/hit1.ogg",
  "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/entity/player/hurt1.ogg",
  "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/game/player/hurt.ogg"
];

async function checkUrls() {
  const results = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      results.push(`${res.status}: ${url}`);
    } catch (e) {
      results.push(`Error: ${url} - ${e.message}`);
    }
  }
  writeFileSync("url_results2.txt", results.join("\n"));
}

checkUrls();

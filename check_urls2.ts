import { writeFileSync } from "fs";

const urls = [
  "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/splash1.ogg",
  "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/splash.ogg",
  "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/entity/player/hurt.ogg",
  "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/damage/hit1.ogg",
  "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/entity/generic/hurt.ogg",
  "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/successful_hit.ogg"
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
  writeFileSync("url_results.txt", results.join("\n"));
}

checkUrls();

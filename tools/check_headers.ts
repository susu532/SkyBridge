import { writeFileSync } from "fs";
fetch("https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/step/grass1.ogg").then(res => {
  writeFileSync("headers.txt", JSON.stringify(Object.fromEntries(res.headers.entries()), null, 2));
  process.exit(0);
}).catch(e => {
  writeFileSync("headers.txt", "Error: " + e.message);
  process.exit(1);
});

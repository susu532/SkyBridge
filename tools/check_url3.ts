import { writeFileSync } from "fs";
fetch("https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/step/grass1.ogg").then(res => {
  writeFileSync("status.txt", res.status.toString());
  process.exit(0);
}).catch(e => {
  writeFileSync("status.txt", "Error: " + e.message);
  process.exit(1);
});

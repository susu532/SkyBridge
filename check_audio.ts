import fs from "fs";
fetch("https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/step/grass1.ogg")
  .then(res => res.arrayBuffer())
  .then(buffer => {
    fs.writeFileSync("grass1.ogg", Buffer.from(buffer));
    console.log("Saved grass1.ogg", buffer.byteLength);
    process.exit(0);
  });

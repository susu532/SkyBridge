import https from "https";

const urls = [
  "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/splash.ogg",
  "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/liquid/splash.ogg",
  "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/entity/player/hurt.ogg",
  "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/damage/hit1.ogg",
  "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/entity/generic/hurt.ogg",
  "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/hit.ogg",
  "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/successful_hit.ogg"
];

urls.forEach(url => {
  https.get(url, (res) => {
    console.log(res.statusCode, url);
  });
});

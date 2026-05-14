import https from "https";
https.get("https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/step/grass1.ogg", (res) => {
  console.log("Status:", res.statusCode);
});

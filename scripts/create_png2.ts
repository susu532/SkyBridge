import fs from "fs";
const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const buffer = Buffer.from(b64, 'base64');
const dir = "public/models/Textures";
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(dir + "/texture-q.png", buffer);
fs.writeFileSync(dir + "/texture-r.png", buffer);
console.log("Created valid PNGs");

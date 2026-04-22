import fs from "fs";
const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6360000000020001e226059b0000000049454e44ae426082", "hex");
const dir = "public/models/Textures";
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(dir + "/texture-q.png", png);
fs.writeFileSync(dir + "/texture-r.png", png);
console.log("Created PNGs");

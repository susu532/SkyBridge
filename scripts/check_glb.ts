import * as fs from "fs";
const data = fs.readFileSync("public/models/character-q.glb");
const jsonChunkLength = data.readUInt32LE(12);
const jsonChunkStr = data.toString("utf8", 20, 20 + jsonChunkLength);
const gltf = JSON.parse(jsonChunkStr);
console.log(JSON.stringify(gltf.images, null, 2));

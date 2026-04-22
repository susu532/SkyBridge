import fs from "fs";

function patchGLB(filePath: string) {
  const data = fs.readFileSync(filePath);
  if (data.readUInt32LE(0) !== 0x46546C67) {
    console.error("Not a GLB file");
    return;
  }
  const jsonChunkLength = data.readUInt32LE(12);
  const jsonChunkStr = data.toString("utf8", 20, 20 + jsonChunkLength);
  let gltf = JSON.parse(jsonChunkStr);
  let changed = false;
  if (gltf.images) {
    for (const image of gltf.images) {
      if (image.uri && image.uri.startsWith("data:image")) {
        // Reset to external URI but with a cache buster
        if (filePath.includes("character-q")) {
           image.uri = "Textures/texture-q.png?v=3";
        } else {
           image.uri = "Textures/texture-r.png?v=3";
        }
        changed = true;
      }
    }
  }
  
  if (!changed) return;
  const newJsonStr = JSON.stringify(gltf);
  const padding = (4 - (Buffer.byteLength(newJsonStr) % 4)) % 4;
  const packedJsonStr = newJsonStr + " ".repeat(padding);
  
  const newJsonLength = Buffer.byteLength(packedJsonStr);
  const diff = newJsonLength - jsonChunkLength;
  
  const header = Buffer.alloc(12);
  data.copy(header, 0, 0, 12);
  header.writeUInt32LE(data.length + diff, 8); // Update total length
  
  const newJsonChunkHeader = Buffer.alloc(8);
  newJsonChunkHeader.writeUInt32LE(newJsonLength, 0);
  newJsonChunkHeader.writeUInt32LE(0x4E4F534A, 4);
  
  const newJsonChunkData = Buffer.from(packedJsonStr, "utf8");
  
  const remainder = data.slice(20 + jsonChunkLength);
  
  const newFile = Buffer.concat([header, newJsonChunkHeader, newJsonChunkData, remainder]);
  fs.writeFileSync(filePath, newFile);
  console.log(`Re-patched ${filePath} to use external URIs with a cache buster`);
}

patchGLB("public/models/character-q.glb");
patchGLB("public/models/character-r.glb");

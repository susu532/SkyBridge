import fs from "fs";

function patchGLB(filePath: string, newURI: string) {
  const data = fs.readFileSync(filePath);
  if (data.readUInt32LE(0) !== 0x46546C67) {
    console.error("Not a GLB file");
    return;
  }
  const jsonChunkLength = data.readUInt32LE(12);
  const jsonChunkType = data.readUInt32LE(16);
  if (jsonChunkType !== 0x4E4F534A) {
    console.error("No JSON chunk");
    return;
  }
  let jsonChunkStr = data.toString("utf8", 20, 20 + jsonChunkLength);
  let gltf = JSON.parse(jsonChunkStr);
  let changed = false;
  if (gltf.images) {
    for (const image of gltf.images) {
      if (image.uri && image.uri.startsWith("Textures/")) {
        image.uri = newURI;
        changed = true;
      }
    }
  }
  if (!changed) {
    console.log(`No relative Textures/ URI found in ${filePath}`);
    return;
  }
  
  const newJsonStr = JSON.stringify(gltf);
  // Pad with spaces to match 4-byte boundary
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
  console.log(`Patched ${filePath}`);
}

const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const dataUri = "data:image/png;base64," + b64;

patchGLB("public/models/character-q.glb", dataUri);
patchGLB("public/models/character-r.glb", dataUri);

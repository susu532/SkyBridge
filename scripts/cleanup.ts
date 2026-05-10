import fs from 'fs';

let gs = fs.readFileSync('src/server/GameServer.ts', 'utf8');

// Move playerBuffers, mobBuffers, hostileMobTypes before ctx.
// They are:
/*
  // Player Buffer Pool to prevent GC pauses
  const playerBuffers = new Map<string, Buffer>();
  const mobBuffers = new Map<string, Buffer>();

  // Server Tick Loop (20Hz)
  const hostileMobTypes = ["Zombie", "Creeper", "Skeleton", "Slime", "Morvane"];
*/

gs = gs.replace(/\/\/ Player Buffer Pool to prevent GC pauses\s*const playerBuffers = new Map<string, Buffer>\(\);\s*const mobBuffers = new Map<string, Buffer>\(\);\s*\/\/ Server Tick Loop \(20Hz\)\s*const hostileMobTypes \= \["Zombie", "Creeper", "Skeleton", "Slime", "Morvane"\];/, '');

const ctxPos = gs.indexOf('const ctx:');
gs = gs.substring(0, ctxPos) + `  // Player Buffer Pool to prevent GC pauses
  const playerBuffers = new Map<string, Buffer>();
  const mobBuffers = new Map<string, Buffer>();
  const hostileMobTypes = ["Zombie", "Creeper", "Skeleton", "Slime", "Morvane"];
` + gs.substring(ctxPos);

fs.writeFileSync('src/server/GameServer.ts', gs);

// Fix GameTick imports
let gt = fs.readFileSync('src/server/GameTick.ts', 'utf8');
gt = gt.replace(/from "\.\.\/GameContext"/g, 'from "./GameContext"');
gt = gt.replace(/from "\.\.\/constants"/g, 'from "./constants"');
fs.writeFileSync('src/server/GameTick.ts', gt);

// Fix SocketHandlers imports
let sh = fs.readFileSync('src/server/SocketHandlers.ts', 'utf8');
sh = sh.replace(/from "\.\.\/ChatModerator"/g, 'from "./ChatModerator"');
sh = sh.replace(/from "\.\.\/GameContext"/g, 'from "./GameContext"');
sh = sh.replace(/from "\.\.\/\.\.\/data/g, 'from "../../data');
if (!sh.includes('CHUNK_SIZE')) {
   // Wait, it is already failing on CHUNK_SIZE
}
sh = `import { CHUNK_SIZE, WORLD_Y_OFFSET } from "./constants";\n` + sh;
fs.writeFileSync('src/server/SocketHandlers.ts', sh);

console.log("Cleanup done!");

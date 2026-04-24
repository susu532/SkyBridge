import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

// The replacement logic:
const newLogic = `
    const CHUNK_SIZE = 16;
    const CHUNK_HEIGHT = 128; // -60 to 67 bounds
    const WORLD_Y_OFFSET = -60;
    
    // Memory efficient chunk storage (sparse)
    // A single Uint16Array per chunk. 0xFFFF means unchanged!
    let chunks: Map<string, Uint16Array> = new Map();

    function getChunkArray(cx: number, cz: number, createIfMissing: boolean = true) {
      const key = \`\${cx},\${cz}\`;
      let arr = chunks.get(key);
      if (!arr && createIfMissing) {
        arr = new Uint16Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
        arr.fill(0xFFFF); // 0xFFFF means unchanged from PCG
        chunks.set(key, arr);
      }
      return arr;
    }
    
    function setBlockInChunk(cx: number, cz: number, lx: number, ly: number, lz: number, type: number) {
      if (ly >= 0 && ly < CHUNK_HEIGHT) {
        const arr = getChunkArray(cx, cz, true)!;
        const idx = lx | (lz << 4) | (ly << 8);
        arr[idx] = type;
      }
    }

    function getBlockFromChunk(cx: number, cz: number, lx: number, ly: number, lz: number) {
      if (ly >= 0 && ly < CHUNK_HEIGHT) {
        const key = \`\${cx},\${cz}\`;
        const arr = chunks.get(key);
        if (arr) {
           const idx = lx | (lz << 4) | (ly << 8);
           const type = arr[idx];
           if (type !== 0xFFFF) return type;
        }
      }
      return undefined;
    }
    
    // Load saved world data from SQLite
    try {
      const chunkRows = getAllChunks.all(worldName) as any[];
      if (chunkRows.length > 0) {
        let loadedBlocks = 0;
        for (const row of chunkRows) {
          const chunkBlocks = JSON.parse(row.data);
          const [cxStr, czStr] = row.chunk_id.split(',');
          const cx = parseInt(cxStr, 10);
          const cz = parseInt(czStr, 10);
          
          for (const key of Object.keys(chunkBlocks)) {
             const parts = key.split(',');
             const xx = parseInt(parts[0], 10);
             const yy = parseInt(parts[1], 10);
             const zz = parseInt(parts[2], 10);
             
             const lx = ((xx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
             const lz = ((zz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
             const ly = yy - WORLD_Y_OFFSET;
             
             setBlockInChunk(cx, cz, lx, ly, lz, chunkBlocks[key]);
             loadedBlocks++;
          }
        }
        console.log(\`Loaded \${loadedBlocks} blocks for \${worldName} from DB into \${chunks.size} chunks\`);
`;

content = content.replace(
  /    let blockChanges: Record<string, number> = {};\n    let npcs: any\[\] = \[\];\n    const players: Record<string, any> = {};\n    const dirtyChunks = new Set<string>\(\);\n\n    function markChunkDirty\(x: number, z: number\) {\n      const cx = Math.floor\(x \/ 16\);\n      const cz = Math.floor\(z \/ 16\);\n      dirtyChunks.add\(`\$\{cx\},\$\{cz\}`\);\n    }\n    \n    \/\/ Load saved world data from SQLite\n    try {\n      const chunkRows = getAllChunks.all\(worldName\) as any\[\];\n      if \(chunkRows.length > 0\) {\n        for \(const row of chunkRows\) {\n          const chunkBlocks = JSON.parse\(row.data\);\n          Object.assign\(blockChanges, chunkBlocks\);\n        }\n        console.log\(`Loaded \$\{Object.keys\(blockChanges\).length\} blocks for \$\{worldName\} from DB`\);/g,
  `    let npcs: any[] = [];
    const players: Record<string, any> = {};
    const dirtyChunks = new Set<string>();

    function markChunkDirty(x: number, z: number) {
      const cx = Math.floor(x / 16);
      const cz = Math.floor(z / 16);
      dirtyChunks.add(\`\${cx},\${cz}\`);
    }

${newLogic}`
);

// We still need to send blockChanges dictionary to the client over websocket in init!
// And saving chunks back to DB!

const fallbackLogic = `
      } else {
        // Fallback: migrate from JSON File if DB is empty
        if (fs.existsSync(WORLD_DATA_FILE)) {
          const data = fs.readFileSync(WORLD_DATA_FILE, 'utf-8');
          const parsed = JSON.parse(data);
          let legacyBlocks: Record<string, number> = {};
          if (parsed.blockChanges) {
            legacyBlocks = parsed.blockChanges;
            const defaultNpcs = (npcsData as any)[worldName] || [];
            npcs = parsed.npcs && parsed.npcs.length > 0 ? parsed.npcs : defaultNpcs;
          } else {
            legacyBlocks = parsed;
            const defaultNpcs = (npcsData as any)[worldName] || [];
            npcs = defaultNpcs;
          }
          let loadedLegacy = 0;
          for (const key of Object.keys(legacyBlocks)) {
            const [xx, yy, zz] = key.split(',').map(Number);
            const cx = Math.floor(xx / 16);
            const cz = Math.floor(zz / 16);
            const lx = ((xx % 16) + 16) % 16;
            const lz = ((zz % 16) + 16) % 16;
            const ly = yy - WORLD_Y_OFFSET;
            setBlockInChunk(cx, cz, lx, ly, lz, legacyBlocks[key]);
            markChunkDirty(xx, zz);
            loadedLegacy++;
          }
          console.log(\`Migrated \${loadedLegacy} blocks for \${worldName} from JSON to DB\`);
`;

content = content.replace(
  /      \} else \{\n        \/\/ Fallback: migrate from JSON File if DB is empty\n        if \(fs.existsSync\(WORLD_DATA_FILE\)\) \{\n          const data = fs.readFileSync\(WORLD_DATA_FILE, 'utf-8'\);\n          const parsed = JSON.parse\(data\);\n          if \(parsed.blockChanges\) \{\n            blockChanges = parsed.blockChanges;\n            const defaultNpcs = \(npcsData as any\)\[worldName\] \|\| \[\];\n            npcs = parsed.npcs && parsed.npcs.length > 0 \? parsed.npcs : defaultNpcs;\n          \} else \{\n            blockChanges = parsed;\n            const defaultNpcs = \(npcsData as any\)\[worldName\] \|\| \[\];\n            npcs = defaultNpcs;\n          \}\n          console.log\(`Migrated \$\{Object.keys\(blockChanges\).length\} blocks for \$\{worldName\} from JSON to DB`\);\n          for \(const key of Object.keys\(blockChanges\)\) \{\n            const \[xx, yy, zz\] = key.split\(','\).map\(Number\);\n            markChunkDirty\(xx, zz\);\n          \}\n/g,
  fallbackLogic
);


const saveLogic = `    // Periodic save function
    const saveWorldData = () => {
      try {
        if (dirtyChunks.size > 0 || npcs.length > 0) {
           const saveTransaction = db.transaction((wName: string, chunksToSave: string[], currentNpcs: any[]) => {
             for (const chunkId of chunksToSave) {
               const arr = chunks.get(chunkId);
               if (arr) {
                 const [cxStr, czStr] = chunkId.split(',');
                 const cx = parseInt(cxStr, 10);
                 const cz = parseInt(czStr, 10);
                 
                 const chunkBlocks: Record<string, number> = {};
                 for (let i = 0; i < arr.length; i++) {
                   if (arr[i] !== 0xFFFF) {
                     const ly = Math.floor(i / 256);
                     const lz = Math.floor((i % 256) / 16);
                     const lx = i % 16;
                     const wx = cx * CHUNK_SIZE + lx;
                     const wz = cz * CHUNK_SIZE + lz;
                     const wy = ly + WORLD_Y_OFFSET;
                     chunkBlocks[\`\${wx},\${wy},\${wz}\`] = arr[i];
                   }
                 }
                 insertChunk.run(wName, chunkId, JSON.stringify(chunkBlocks));
               }
             }
             if (currentNpcs.length > 0) {
               insertNPCs.run(wName, JSON.stringify(currentNpcs));
             }
           });
           
           saveTransaction(worldName, Array.from(dirtyChunks), npcs);
           dirtyChunks.clear();
        }
      } catch (err) {
        console.error('Error triggering world save:', err);
      }
    };`;

content = content.replace(
  /    \/\/ Periodic save function\n    const saveWorldData = \(\) => \{\n      try \{\n        if \(dirtyChunks.size > 0 \|\| npcs.length > 0\) \{\n           const saveTransaction = db.transaction\(\(wName: string, chunksToSave: string\[\], blocks: Record<string, number>, currentNpcs: any\[\]\) => \{\n             for \(const chunkId of chunksToSave\) \{\n               const \[cxStr, czStr\] = chunkId.split\(','\);\n               const cx = parseInt\(cxStr\);\n               const cz = parseInt\(czStr\);\n               \n               const chunkBlocks: Record<string, number> = \{\};\n               for \(const key of Object.keys\(blocks\)\) \{\n                 const parts = key.split\(','\);\n                 const xx = parseInt\(parts\[0\]\);\n                 const zz = parseInt\(parts\[2\]\);\n                 if \(Math.floor\(xx \/ 16\) === cx && Math.floor\(zz \/ 16\) === cz\) \{\n                   chunkBlocks\[key\] = blocks\[key\];\n                 \}\n               \}\n               insertChunk.run\(wName, chunkId, JSON.stringify\(chunkBlocks\)\);\n             \}\n             if \(currentNpcs.length > 0\) \{\n               insertNPCs.run\(wName, JSON.stringify\(currentNpcs\)\);\n             \}\n           \}\);\n           \n           saveTransaction\(worldName, Array.from\(dirtyChunks\), blockChanges, npcs\);\n           dirtyChunks.clear\(\);\n        \}\n      \} catch \(err\) \{\n        console.error\('Error triggering world save:', err\);\n      \}\n    \};\n/g,
  saveLogic + "\n"
);

// We need to alter \`getBlockAt\` where it checks \`blockChanges[key]\`
content = content.replace(
  /        if \(blockChanges\[key\] !== undefined\) return blockChanges\[key\];\n/g,
  `        const cx = Math.floor(x / CHUNK_SIZE);\n        const cz = Math.floor(z / CHUNK_SIZE);\n        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;\n        const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;\n        const chunkType = getBlockFromChunk(cx, cz, lx, Math.floor(y) - WORLD_Y_OFFSET, lz);\n        if (chunkType !== undefined) return chunkType;\n`
);

// Also need to refactor \`init\` payload building!
const getBlockChangesDict = `
    function getBlockChangesDict() {
      const dict: Record<string, number> = {};
      for (const [chunkId, arr] of chunks.entries()) {
        const [cxStr, czStr] = chunkId.split(',');
        const cx = parseInt(cxStr, 10);
        const cz = parseInt(czStr, 10);
        for (let i = 0; i < arr.length; i++) {
          if (arr[i] !== 0xFFFF) {
            const ly = Math.floor(i / 256);
            const lz = Math.floor((i % 256) / 16);
            const lx = i % 16;
            const wx = cx * CHUNK_SIZE + lx;
            const wz = cz * CHUNK_SIZE + lz;
            const wy = ly + WORLD_Y_OFFSET;
            dict[\`\${wx},\${wy},\${wz}\`] = arr[i];
          }
        }
      }
      return dict;
    }
`;

content = content.replace(
  /    ioNamespace.on\('connection', \(socket\) => \{\n      console.log\(`Player \$\{socket.id\} connected to \$\{worldName\}`\);\n/g,
  getBlockChangesDict + `\n    ioNamespace.on('connection', (socket) => {\n      console.log(\`Player \${socket.id} connected to \${worldName}\`);\n`
);

content = content.replace(
  /      socket.emit\('init', \{ \n        players, \n        blockChanges, \n        mobs, \n        npcs, \n        minions,\n        dayTime: dayTime, \n        timeScale: timeScale \n      \}\);/g,
  `      socket.emit('init', { \n        players, \n        blockChanges: getBlockChangesDict(), \n        mobs, \n        npcs, \n        minions,\n        dayTime: dayTime, \n        timeScale: timeScale \n      });`
);

// finally: setBlock implementation
content = content.replace(
  /    socket.on\('setBlock', \(data\) => \{\n      const \{ x, y, z, type \} = data;\n      const key = `\$\{x\},\$\{y\},\$\{z\}`;\n      blockChanges\[key\] = type;\n      markChunkDirty\(x, z\);\n      ioNamespace.emit\('blockChanged', \{ x, y, z, type \}\);\n    \}\);/g,
  `    socket.on('setBlock', (data) => {\n      const { x, y, z, type } = data;\n      const cx = Math.floor(x / CHUNK_SIZE);\n      const cz = Math.floor(z / CHUNK_SIZE);\n      const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;\n      const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;\n      const ly = y - WORLD_Y_OFFSET;\n      setBlockInChunk(cx, cz, lx, ly, lz, type);\n      markChunkDirty(x, z);\n      ioNamespace.emit('blockChanged', { x, y, z, type });\n    });`
);


fs.writeFileSync('server.ts', content);


import fs from 'fs';

let content = fs.readFileSync('src/server/GameServer.ts', 'utf-8');

// Add imports
content = "import { GameModeInfo } from './modes/GameMode';\n" + content;

// Replace signature
content = content.replace(
  "export function createGameServer(io: Server, db: any, namespacePrefix: string, worldDataFileName: string, isHubMode: boolean) {",
  "export function createGameServer(io: Server, db: any, mode: GameModeInfo) {"
);

// Replace isSkyCastlesMode and isHubMode with mode checks
content = content.replace(
  "    const worldName = namespacePrefix.replace('/', '');\n    const isSkyCastlesMode = namespacePrefix === '/skycastles' || namespacePrefix === '/voidtrail';\n    const ioNamespace = io.of(namespacePrefix);\n    const WORLD_DATA_FILE = path.join(process.cwd(), worldDataFileName);",
  "    const isHubMode = mode.name === '/hub';\n    const namespacePrefix = mode.name;\n    const worldName = namespacePrefix.replace('/', '');\n    const isSkyCastlesMode = mode.name === '/skycastles' || mode.name === '/voidtrail';\n    const ioNamespace = io.of(mode.name);\n"
);

content = content.replace(
  "function isIndestructible(x: number, y: number, z: number): boolean {",
  "function isIndestructible(x: number, y: number, z: number): boolean {\n      return mode.isIndestructible(x, y, z, bakedBlocks);\n    }\n    function DEPRECATED_isIndestructible(x: number, y: number, z: number): boolean {"
);

content = content.replace(
  "function getBlockAt(x: number, y: number, z: number) {",
  "function getBlockAt(x: number, y: number, z: number) {\n      return mode.getBlockAt(x, y, z, chunkManager, bakedBlocks);\n    }\n    function DEPRECATED_getBlockAt(x: number, y: number, z: number) {"
);

// Spawn logic checks replace (there are several places)
content = content.replace(
  "if (isHubMode) return; // Prevent PvP in Hub",
  "if (!mode.allowPvP && !isMob) return; // Prevent PvP in Hub"
);

content = content.replace("if (isHubMode || (isSkyCastlesMode && data?.type !== 'Morvane')) return;", "if (!mode.allowPlayerMobSpawns && data?.type !== 'Morvane') return;");

content = content.replace("if (isHubMode || isSkyCastlesMode) return;", "if (!mode.allowMobSpawns) return;");

fs.writeFileSync('src/server/GameServer.ts', content);

// server.ts patch
let serverContent = fs.readFileSync('server.ts', 'utf-8');
serverContent = "import { HubMode } from './src/server/modes/HubMode';\nimport { SkyBridgeMode } from './src/server/modes/SkyBridgeMode';\nimport { SkyCastlesMode } from './src/server/modes/SkyCastlesMode';\n" + serverContent;

serverContent = serverContent.replace(
  "  createGameServer(io, db, '/hub', 'hub_world_data.json', true);\n  createGameServer(io, db, '/skybridge', 'world_data.json', false);\n  createGameServer(io, db, '/skycastles', 'skycastles_world_data.json', false);\n  createGameServer(io, db, '/voidtrail', 'voidtrail_world_data.json', false);",
  "  createGameServer(io, db, new HubMode());\n  createGameServer(io, db, new SkyBridgeMode());\n  createGameServer(io, db, new SkyCastlesMode('/skycastles'));\n  createGameServer(io, db, new SkyCastlesMode('/voidtrail'));"
);

fs.writeFileSync('server.ts', serverContent);
console.log("Refactoring applied");

import fs from 'fs';

let text = fs.readFileSync('src/server/GameServer.ts', 'utf8');

// The ioNamespace connection block handles all the sockets.
const socketStartId = 'ioNamespace.on("connection", (socket) => {';
const socketStart = text.indexOf(socketStartId);
const socketEndMatches = '  // Player Buffer Pool';
const socketEnd = text.indexOf(socketEndMatches);

const socketCode = text.substring(socketStart, socketEnd);

const tickStartId = '  const tick = (delta: number) => {';
const tickStart = text.indexOf(tickStartId);
const tickEndMatches = '  // Internal ticking logic managed by Node event loop';
const tickEnd = text.indexOf(tickEndMatches);

const tickCode = text.substring(tickStart, tickEnd);

// Generate GameServerContext
const contextInterface = `
export interface GameContext {
  ioNamespace: import("socket.io").Namespace;
  chunkManager: any;
  worldName: string;
  isSkyCastlesMode: boolean;
  isHubMode: boolean;
  db: any;
  mode: any;
  
  bakedBlocks: Map<string, number>;
  npcs: any[];
  players: Record<string, any>;
  morvaneDead: Record<string, boolean>;
  droppedItems: Record<string, any>;
  mobs: Record<string, any>;
  minions: Record<string, any>;
  
  pendingPlayerUpdates: Set<string>;
  pendingHits: any[];
  pendingMobHits: any[];
  pendingRespawns: any[];
  
  playerBuffers: Map<string, Buffer>;
  mobBuffers: Map<string, Buffer>;
  
  spatialHash: Map<number, any[]>;
  playerHash: Map<number, any[]>;

  state: {
    dayTime: number;
    gameState: string;
    gameStartTime: number;
    resetCountdown: number | null;
    emptyRoomSince: number | null;
    hasSetEndgameMessage: boolean;
    hasBeenReset: boolean;
    lastOvertimeDamageTick: number;
    lastSkyCastlesSyncJSON: string;
    tick10sCount: number;
    spawnInterval: number;
    spawnTimeout: NodeJS.Timeout | null;
    isDestroyed: boolean;
  };

  CELL_SIZE: number;
  PLAYER_CELL_SIZE: number;
  dayCycleSpeed: number;
  hostileMobTypes: string[];

  // Functions
  getCellKey: (cx: number, cz: number) => number;
  broadcastToNearby: (eventName: string, data: any, x: number, z: number, rangeSq: number, excludeId?: string | null) => void;
  spawnMob: (type: string, x: number, y: number, z: number, level?: number, team?: string) => void;
  isIndestructible: (x: number, y: number, z: number) => boolean;
  getBlockAt: (x: number, y: number, z: number) => number | undefined;
  resetRoom: () => void;
  handleMorvaneDeath: (deadTeam: string) => void;
}
`;

fs.writeFileSync('src/server/GameContext.ts', contextInterface);

const setupSocketHandlersExtracted = `
import { chatModerator } from "../ChatModerator";
import { GameContext } from "../GameContext";
// Also need itemsData for combat damage calculation? Let's just require it here.
import itemsData from "../../../data/items.json";

export function setupSocketHandlers(ctx: GameContext) {
  const {
      ioNamespace, chunkManager, worldName, isSkyCastlesMode, isHubMode,
      bakedBlocks, npcs, players, mobs, minions, droppedItems, morvaneDead,
      pendingPlayerUpdates, pendingHits, pendingMobHits, pendingRespawns,
      state, dayCycleSpeed, CELL_SIZE, PLAYER_CELL_SIZE, hostileMobTypes,
      mode, db, getCellKey, broadcastToNearby, spawnMob, 
      isIndestructible, getBlockAt, resetRoom, handleMorvaneDeath,
      playerBuffers, mobBuffers, spatialHash, playerHash
  } = ctx;

` + socketCode.replace(/ioNamespace\.on\("connection",/g, 'ctx.ioNamespace.on("connection",') + `
}
`;

fs.writeFileSync('src/server/SocketHandlers.ts', setupSocketHandlersExtracted);

// Tick logic has fastGetBlock declared inside it. We just need to extract everything inside 'const tick = (delta: number) => {'
const tickInner = tickCode.substring(tickCode.indexOf('{') + 1, tickCode.lastIndexOf('};'));

const tickExtracted = `
import { GameContext } from "../GameContext";
import { BLOCK, isSolidBlock } from "../constants";

export function tick(ctx: GameContext, delta: number) {
  const {
      ioNamespace, chunkManager, worldName, isSkyCastlesMode, isHubMode,
      bakedBlocks, npcs, players, mobs, minions, droppedItems, morvaneDead,
      pendingPlayerUpdates, pendingHits, pendingMobHits, pendingRespawns,
      state, dayCycleSpeed, CELL_SIZE, PLAYER_CELL_SIZE, hostileMobTypes,
      mode, db, getCellKey, broadcastToNearby, spawnMob, 
      isIndestructible, getBlockAt, resetRoom, handleMorvaneDeath,
      playerBuffers, mobBuffers, spatialHash, playerHash
  } = ctx;

` + tickInner + `
}
`;
fs.writeFileSync('src/server/GameTick.ts', tickExtracted);

// Now update GameServer.ts
let newText = `import { setupSocketHandlers } from "./SocketHandlers";
import { tick as runTick } from "./GameTick";
` + text.substring(0, socketStart) + 
  `  const ctx: import("./GameContext").GameContext = {
    ioNamespace, chunkManager, worldName, isSkyCastlesMode, isHubMode, db, mode,
    bakedBlocks, npcs, players, morvaneDead, droppedItems, mobs, minions,
    pendingPlayerUpdates, pendingHits, pendingMobHits, pendingRespawns,
    playerBuffers, mobBuffers, spatialHash, playerHash, state,
    CELL_SIZE, PLAYER_CELL_SIZE, dayCycleSpeed, hostileMobTypes,
    getCellKey, broadcastToNearby, spawnMob, isIndestructible, getBlockAt, resetRoom, handleMorvaneDeath
  };
  
  setupSocketHandlers(ctx);
  
` + text.substring(socketEnd, tickStart) + 
  `  const tick = (delta: number) => {
    runTick(ctx, delta);
  };
` + text.substring(tickEnd);

// Need to remove chatModerator import, maybe keep it.
fs.writeFileSync('src/server/GameServer.ts', newText);
console.log("Extraction complete!");


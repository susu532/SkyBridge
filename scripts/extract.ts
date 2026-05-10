const fs = require('fs');

let code = fs.readFileSync('src/server/GameServer.ts', 'utf8');

// 1. Extract Socket Handlers
const socketStart = code.indexOf('ioNamespace.on("connection", (socket) => {');
const socketEndMatches = code.indexOf('  // Player Buffer Pool');
let socketCode = code.substring(socketStart, socketEndMatches);

fs.writeFileSync('src/server/game/SocketHandlers.ts', `export function setupSocketHandlers(ctx: any) {
  const {
      ioNamespace, chunkManager, worldName, isSkyCastlesMode, isHubMode,
      bakedBlocks, npcs, players, mobs, minions, droppedItems, morvaneDead,
      pendingPlayerUpdates, pendingHits, pendingMobHits, pendingRespawns,
      dayTime, dayCycleSpeed, gameState, resetCountdown, emptyRoomSince, 
      hasSetEndgameMessage, hasBeenReset, gameStartTime, lastOvertimeDamageTick,
      lastSkyCastlesSyncJSON, intervals, spawnInterval, spawnTimeout, isDestroyed,
      mode, db, io, getCellKey, broadcastToNearby, spawnMob, 
      isIndestructible, getBlockAt, fastGetBlock, resetRoom, handleMorvaneDeath,
      playerBuffers, mobBuffers, spatialHash, playerHash, state
  } = ctx;

  ` + socketCode.replace(/ioNamespace\.on\("connection",/g, 'ctx.ioNamespace.on("connection",') + `
}
`);

// 2. Extract Tick
const tickStart = code.indexOf('  const tick = (delta: number) => {');
const tickEndMatches = code.indexOf('  // Internal ticking logic managed by Node event loop');
let tickCode = code.substring(tickStart, tickEndMatches);

fs.writeFileSync('src/server/game/GameTick.ts', `export function runTick(ctx: any, delta: number) {
  const {
      ioNamespace, chunkManager, worldName, isSkyCastlesMode, isHubMode,
      bakedBlocks, npcs, players, mobs, minions, droppedItems, morvaneDead,
      pendingPlayerUpdates, pendingHits, pendingMobHits, pendingRespawns,
      dayTime, dayCycleSpeed, gameState, resetCountdown, emptyRoomSince, 
      hasSetEndgameMessage, hasBeenReset, gameStartTime, lastOvertimeDamageTick,
      lastSkyCastlesSyncJSON, intervals, spawnInterval, spawnTimeout, isDestroyed,
      mode, db, io, getCellKey, broadcastToNearby, spawnMob, 
      isIndestructible, getBlockAt, fastGetBlock, resetRoom, handleMorvaneDeath,
      playerBuffers, mobBuffers, spatialHash, playerHash, state,
      CELL_SIZE, PLAYER_CELL_SIZE, hostileMobTypes
  } = ctx;

  ` + tickCode.substring(tickCode.indexOf('{') + 1, tickCode.lastIndexOf('};')) + `
}
`);

console.log("Extracted!");

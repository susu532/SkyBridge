const fs = require('fs');

let content = fs.readFileSync('src/server/GameServer.ts', 'utf8');

// The strategy is to turn "createGameServer" into a class
// 1. find `export function createGameServer(io: Server, db: any, mode: GameModeInfo) {`
//    replace with:
//    `export class GameServerInstance {`
//    And then put the constructor:
//    `constructor(public io: Server, public db: any, public mode: GameModeInfo) {`
content = content.replace(
  /export function createGameServer\(io: Server, db: any, mode: GameModeInfo\) \{/,
  `export class GameServerInstance {
  worldName: string;
  isSkyCastlesMode: boolean;
  isHubMode: boolean;
  ioNamespace: import("socket.io").Namespace;
  chunkManager: any;
  npcs: any[] = [];
  players: Record<string, any> = {};
  morvaneDead: Record<string, boolean> = { red: false, blue: false };
  droppedItems: Record<string, any> = {};
  mobs: Record<string, any> = {};
  minions: Record<string, any> = {};
  pendingPlayerUpdates: Set<string> = new Set();
  pendingHits: any[] = [];
  pendingMobHits: any[] = [];
  pendingRespawns: any[] = [];
  tick10sCount: number = 0;
  dayTime: number = 0;
  dayCycleSpeed: number = 0.0008;
  gameState: string = "playing";
  resetCountdown: number | null = null;
  emptyRoomSince: number | null = null;
  hasSetEndgameMessage: boolean = false;
  hasBeenReset: boolean = false;
  gameStartTime: number = Date.now();
  lastOvertimeDamageTick: number = 0;
  lastSkyCastlesSyncJSON: string = "";
  intervals: NodeJS.Timeout[] = [];
  spawnInterval: number = 1000;
  spawnTimeout: NodeJS.Timeout | null = null;
  isDestroyed: boolean = false;
  CELL_SIZE = 16;
  PLAYER_CELL_SIZE = 25;
  spatialHash = new Map<number, any[]>();
  playerHash = new Map<number, any[]>();
  playerBuffers = new Map<string, Buffer>();
  mobBuffers = new Map<string, Buffer>();

  constructor(public io: import("socket.io").Server, public db: any, public mode: import("./modes/GameMode").GameModeInfo) {
    const namespacePrefix = mode.name;
    this.worldName = namespacePrefix.replace("/", "");
    this.isSkyCastlesMode = mode.name.startsWith("/skycastles") || mode.name.startsWith("/voidtrail");
    this.isHubMode = mode.name.startsWith("/hub");
    this.ioNamespace = io.of(mode.name);
    // ... we don't put all the logic here.
`
);

fs.writeFileSync('scripts/out.txt', "DONE");

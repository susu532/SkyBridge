import fs from 'fs';
import { Project } from "ts-morph";

async function run() {
    let source = fs.readFileSync('src/server/GameServer.ts', 'utf8');

    const primitives = [
        'dayTime', 'gameState', 'gameStartTime', 'resetCountdown',
        'emptyRoomSince', 'hasSetEndgameMessage', 'hasBeenReset',
        'lastOvertimeDamageTick', 'lastSkyCastlesSyncJSON',
        'tick10sCount', 'spawnInterval', 'spawnTimeout', 'isDestroyed'
    ];

    // Remove declarations:
    source = source.replace(/let dayTime = 0;/, '');
    source = source.replace(/let gameState = "playing"; \/\/ "playing" \| "endgame"/, '');
    source = source.replace(/let resetCountdown: number \| null = null;/, '');
    source = source.replace(/let emptyRoomSince: number \| null = null;/, '');
    source = source.replace(/let hasSetEndgameMessage = false;/, '');
    source = source.replace(/let hasBeenReset = false;/, '');
    source = source.replace(/let gameStartTime = Date\.now\(\);/, '');
    source = source.replace(/let lastOvertimeDamageTick = 0;/, '');
    source = source.replace(/let lastSkyCastlesSyncJSON = "";/, '');
    source = source.replace(/let tick10sCount = 0;/, '');
    source = source.replace(/let spawnInterval = 1000;/, '');
    source = source.replace(/let spawnTimeout: NodeJS\.Timeout \| null = null;/, '');
    source = source.replace(/let isDestroyed = false;/, '');

    // Fix usages, but handle object shorthand notation like { dayTime }
    primitives.forEach(p => {
        const regex = new RegExp(`(?<!\\.)\\b${p}\\b`, 'g');
        source = source.replace(regex, `state.${p}`);
    });
    
    // Specifically fix the properties that Regex broke:
    source = source.replace(/state\.isDestroyed: \(\) =>/g, "isDestroyed: () =>");
    source = source.replace(/\{ state\.dayTime \}/g, "{ dayTime: state.dayTime }");
    source = source.replace(/mobs, droppedItems, state\.gameStartTime/g, "mobs, droppedItems, gameStartTime: state.gameStartTime");
    source = source.replace(/state\.dayTime,/g, "dayTime: state.dayTime,");
    source = source.replace(/state\.gameState,/g, "gameState: state.gameState,");
    source = source.replace(/state\.gameStartTime,/g, "gameStartTime: state.gameStartTime,");

    // Create the state object declaration right after `const ioNamespace = io.of(mode.name);`
    const stateDecl = `
  const state = {
    dayTime: 0,
    gameState: "playing",
    gameStartTime: Date.now(),
    resetCountdown: null as number | null,
    emptyRoomSince: null as number | null,
    hasSetEndgameMessage: false,
    hasBeenReset: false,
    lastOvertimeDamageTick: 0,
    lastSkyCastlesSyncJSON: "",
    tick10sCount: 0,
    spawnInterval: 1000,
    spawnTimeout: null as NodeJS.Timeout | null,
    isDestroyed: false
  };
`;
    source = source.replace(/const ioNamespace = io\\.of\\(mode\\.name\\);/, 'const ioNamespace = io.of(mode.name);\\n' + stateDecl);

    fs.writeFileSync('src/server/GameServer.modified.ts', source);
    console.log("Saved temporary modifications to GameServer.modified.ts");
}

run();

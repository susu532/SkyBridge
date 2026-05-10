import fs from 'fs';
import { Project } from "ts-morph";

const primitives = [
    'dayTime', 'gameState', 'gameStartTime', 'resetCountdown',
    'emptyRoomSince', 'hasSetEndgameMessage', 'hasBeenReset',
    'lastOvertimeDamageTick', 'lastSkyCastlesSyncJSON',
    'tick10sCount', 'spawnInterval', 'spawnTimeout', 'isDestroyed'
];

async function run() {
    const project = new Project();
    const sf = project.addSourceFileAtPath('src/server/GameServer.ts');
    
    // Find createGameServer
    const func = sf.getFunction("createGameServer");
    if (!func) return;

    // Rename variables to `state_XXX`
    for (const p of primitives) {
        const varDecls = func.getVariableDeclarations().filter(v => v.getName() === p);
        for (const varDecl of varDecls) {
            console.log("Renaming", p);
            varDecl.rename("state_" + p);
        }
    }

    project.saveSync();
    
    // Now perform text replacement
    let text = fs.readFileSync('src/server/GameServer.ts', 'utf8');
    
    // 1. Remove the local let state_XX declarations
    primitives.forEach(p => {
        text = text.replace(new RegExp("let state_" + p + "(: [^=]+)? = [^;]+;", 'g'), '');
        text = text.replace(new RegExp("let state_" + p + ";", 'g'), '');
    });

    // 2. Add state declaration
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
    text = text.replace(/const ioNamespace = io\.of\(mode\.name\);/, "const ioNamespace = io.of(mode.name);\n" + stateDecl);

    // 3. Fix short hands and regular usage
    primitives.forEach(p => {
        // Fix { state_dayTime }
        text = text.replace(new RegExp("\\{\\s*state_" + p + "\\s*\\}", 'g'), "{ " + p + ": state." + p + " }");
        // Fix { xxx, state_dayTime }
        text = text.replace(new RegExp("([\\{,]\\s*)state_" + p + "(\\s*[,\\}])", 'g'), "$1" + p + ": state." + p + "$2");
        
        // Fix any remaining state_dayTime to state.dayTime
        text = text.replace(new RegExp("\\bstate_" + p + "\\b", 'g'), "state." + p);
    });

    fs.writeFileSync('src/server/GameServer.ts', text);
    console.log("Renamed primitives successfully.");
}

run();

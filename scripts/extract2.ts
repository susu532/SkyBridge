const fs = require('fs');
let code = fs.readFileSync('src/server/GameServer.ts', 'utf8');

const primitives = [
    'dayTime', 'gameState', 'gameStartTime', 'resetCountdown',
    'emptyRoomSince', 'hasSetEndgameMessage', 'hasBeenReset',
    'lastOvertimeDamageTick', 'lastSkyCastlesSyncJSON',
    'tick10sCount', 'spawnInterval', 'spawnTimeout', 'isDestroyed'
];

primitives.forEach(p => {
    // We want to replace `dayTime` with `state.dayTime`, EXCEPT:
    // - when it's a field in an object literal shorthand: `{ dayTime }` -> `{ dayTime: state.dayTime }`
    // - when it's already a property: `something.dayTime`
    // - when it's an object property assignment key: `dayTime:`
    
    // 1. remove let declarations for these variables
    code = code.replace(new RegExp(\`let \${p}(: [^=]+)? = [^;]+;\`, 'g'), '');
    code = code.replace(new RegExp(\`let \${p};\`, 'g'), '');
    
    // 2. fix object shorthand like { dayTime }
    // We match "{ spaces dayTime spaces }" or "{..., dayTime, ...}"
    // This is tricky with Regex.
});

// Actually, maybe I don't need to replace all uses. I can just mutate the ctx object!
// In JS:
// ctx.gameState = "endgame" instead of gameState = "endgame"

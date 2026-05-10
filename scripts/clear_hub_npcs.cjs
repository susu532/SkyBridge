const Database = require('better-sqlite3');
const fs = require('fs');
const npcsData = JSON.parse(fs.readFileSync('./src/game/data/npcs.json', 'utf-8'));

const db = new Database('skybridge.db');
db.exec("DELETE FROM world_npcs WHERE world = 'hub'");
db.close();

console.log('Hub NPCs cleared from DB, server will load from npcs.json on restart.');

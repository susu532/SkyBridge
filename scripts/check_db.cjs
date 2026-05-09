const Database = require('better-sqlite3');
const db = new Database('skybridge.db', { readonly: true });
const chunkRows = db.prepare("SELECT world, count(*) as count FROM chunk_data").all();
console.log("Chunks:", chunkRows);


const npcRows = db.prepare("SELECT world FROM world_npcs").all();
console.log("NPCs:");
console.log(npcRows);


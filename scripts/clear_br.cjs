const Database = require('better-sqlite3');
const db = new Database('skybridge.db');
db.exec("DELETE FROM chunk_data WHERE world LIKE 'battleroyale%';");
db.close();
console.log('Battle Royale chunks cleared from DB.');

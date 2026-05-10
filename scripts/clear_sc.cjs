const Database = require('better-sqlite3');
const db = new Database('skybridge.db');
db.exec("DELETE FROM chunk_data WHERE world LIKE 'skycastles%';");
db.close();
console.log('Sky Castles chunks cleared from DB.');

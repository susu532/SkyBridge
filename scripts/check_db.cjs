const Database = require('better-sqlite3');
const db = new Database('skybridge.db', { readonly: true });
const rows = db.prepare("SELECT chunk_id, data FROM chunk_data WHERE world='skybridge' AND chunk_id IN ('0,5', '0,-5') LIMIT 10").all();
console.log("Found rows:", rows.length);
for (const row of rows) {
  const data = JSON.parse(row.data);
  let highest = -100;
  for (const k in data) {
    const [,y] = k.split(',').map(Number);
    if (y > highest) highest = y;
  }
  console.log("Chunk", row.chunk_id, "Highest Y:", highest);
}

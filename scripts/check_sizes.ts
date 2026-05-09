import fs from 'fs';
['skybridge.db', 'skybridge.db-wal', 'skybridge.db-shm'].forEach(f => {
  if (fs.existsSync(f)) {
    console.log(f, fs.statSync(f).size);
  } else {
    console.log(f, 'missing');
  }
});

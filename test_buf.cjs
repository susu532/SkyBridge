const buf = Buffer.alloc(20);
try {
  new DataView(buf);
  console.log('Works');
} catch(e) {
  console.error('Fails:', e.message);
}

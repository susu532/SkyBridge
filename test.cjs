const http = require('http');
http.get('http://localhost:3000/socket.io/?EIO=4&transport=polling', (res) => {
  res.on('data', (d) => process.stdout.write(d));
});

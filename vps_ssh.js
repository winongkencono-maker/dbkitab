const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(`
    echo "--- Installing dependencies on VPS ---"
    cd /www/wwwroot/github/dbkitab || cd /www/wwwroot/dbkitab
    git pull
    npm install uuid midtrans-client
    npm install
    
    echo "--- Done ---"
  `, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '43.134.134.169',
  port: 22,
  username: 'root',
  password: 'river-46$-river'
});

const db = require('./config/db');
db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'highlights'").then(res => { console.log(res.rows); process.exit(); });

const { Pool } = require('pg');
const fs = require('node:fs/promises');
const path = require('node:path');
const pool = new Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {});
fs.readFile(path.join(__dirname, 'db/init.sql'), 'utf8')
  .then(sql => pool.query(sql))
  .then(() => console.log('Gacha base tables exist.'))
  .catch(error => { console.error('Schema initialization failed:', error.code || error.name); process.exitCode = 1; })
  .finally(() => pool.end());

const { Pool } = require('pg');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createApp } = require('./app');
const options = { max: 10, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10000 };
if (process.env.DATABASE_URL) options.connectionString = process.env.DATABASE_URL;
const pool = new Pool(options);
pool.on('error', () => console.warn('Idle DB connection interrupted; later requests can reconnect.'));
let server;
async function start() {
  const schema = await fs.readFile(path.join(__dirname, 'db/init.sql'), 'utf8');
  for (let attempt = 1; attempt <= 20; attempt++) {
    try { await pool.query(schema); break; }
    catch (error) { if (attempt === 20) throw error; await new Promise(resolve => setTimeout(resolve, 1500)); }
  }
  server = createApp(pool).listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {
    console.log('Gacha API ready; open /test.');
    console.log('CORS_ORIGINS = ' + (process.env.CORS_ORIGINS || '(empty: only same-origin pages such as /test and /visual/)'));
  });
}
async function stop() { if (server) await new Promise(resolve => server.close(resolve)); await pool.end(); }
process.on('SIGTERM', () => stop().then(() => process.exit(0)));
process.on('SIGINT', () => stop().then(() => process.exit(0)));
start().catch(error => { console.error('Startup failed:', error.code || error.name); pool.end().finally(() => process.exit(1)); });

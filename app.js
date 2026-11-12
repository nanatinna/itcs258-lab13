const express = require('express');
const path = require('node:path');
const { LEGENDARY, COMMON, RULES, drawOutcome, validStudent, positiveInteger } = require('./domain');

// CORS_ORIGINS is opt-in: unset = same-origin pages only (/test, /visual).
// Use exact origins such as http://localhost:5500,https://my-tester.example.
// '*' allows every origin; acceptable only for this authless classroom API.
function corsMiddleware(setting, log = console.warn) {
  const allowed = String(setting || '').split(',').map(value => value.trim().replace(/\/$/, '')).filter(Boolean);
  const any = allowed.includes('*');
  const reported = new Set();
  return (req, res, next) => {
    if (allowed.length && !any) res.vary('Origin');
    const origin = req.get('origin');
    if (!origin) return next();
    if (any || allowed.includes(origin)) {
      res.set('Access-Control-Allow-Origin', any ? '*' : origin);
      if (req.method !== 'OPTIONS') return next();
      res.set({ 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' });
      return res.sendStatus(204);
    }
    // Not allowed: answer normally but without CORS headers, so the browser hides the
    // response from that page. Log each blocked page origin once to help diagnosis.
    let sameOrigin = false;
    try { sameOrigin = new URL(origin).host === req.get('host'); } catch { /* origin "null" */ }
    if (!sameOrigin && !reported.has(origin) && reported.size < 20) {
      reported.add(origin);
      log(`CORS: page origin ${origin} is not in CORS_ORIGINS (${allowed.join(',') || 'empty'}). The browser will hide responses from that page.`);
    }
    return next();
  };
}

// Short commit SHA of the running build (Lab 14): GIT_SHA from the CI image, or the platform's own variable.
const buildVersion = () => String(process.env.GIT_SHA || process.env.RENDER_GIT_COMMIT || process.env.RAILWAY_GIT_COMMIT_SHA || 'dev').slice(0, 7);

function createApp(pool, { corsOrigins = process.env.CORS_ORIGINS, log = console.warn, version = buildVersion() } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(corsMiddleware(corsOrigins, log));
  app.use(express.json({ limit: '8kb' }));
  app.get('/', (_req, res) => res.json({ app: 'Gacha Workshop', test: './test', visual: './visual/', currency: 'virtual demo only' }));
  app.get(['/test', '/test/'], (_req, res) => res.sendFile(path.join(__dirname, 'public/test.html')));
  app.get(['/api-spec', '/api-spec/'], (_req, res) => res.sendFile(path.join(__dirname, 'public/api-spec.html')));
  // Built-in p5.js visual tester. The relative redirect keeps a proxy prefix such as /backend/.
  app.get('/visual', (req, res, next) => req.path.endsWith('/') ? next() : res.redirect(302, 'visual/'));
  app.use('/visual', express.static(path.join(__dirname, 'visual-tester'), { redirect: false, index: 'index.html' }));
  app.get('/openapi.json', (_req, res) => res.sendFile(path.join(__dirname, 'openapi.json')));
  app.get('/health', async (_req, res) => {
    try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'connected', app: 'gacha', version }); }
    catch { res.status(503).json({ status: 'error', database: 'unavailable', app: 'gacha', version }); }
  });
  app.get('/api/catalog', (_req, res) => res.json({ rules: RULES, legendary: LEGENDARY, common: COMMON, note: '2% SSR per independent draw; each of five SSR results has 0.4% overall probability. No guaranteed SSR after 50 draws.' }));
  app.get('/api/accounts/:studentId', async (req, res, next) => {
    const id = req.params.studentId;
    if (!validStudent(id)) return res.status(400).json({ error: 'student_id must contain 1–30 letters, digits, underscores or hyphens.' });
    try {
      await pool.query('INSERT INTO wallets(student_id) VALUES($1) ON CONFLICT DO NOTHING', [id]);
      const { rows } = await pool.query('SELECT * FROM wallets WHERE student_id=$1', [id]);
      res.json({ wallet: rows[0] });
    } catch (error) { next(error); }
  });
  app.get('/api/accounts/:studentId/history', async (req, res, next) => {
    const id = req.params.studentId;
    if (!validStudent(id)) return res.status(400).json({ error: 'Invalid student_id.' });
    try {
      const tx = await pool.query('SELECT * FROM transactions WHERE student_id=$1 ORDER BY id DESC LIMIT 50', [id]);
      const results = await pool.query('SELECT * FROM draws WHERE student_id=$1 ORDER BY id DESC LIMIT 50', [id]);
      res.json({ transactions: tx.rows, draws: results.rows });
    } catch (error) { next(error); }
  });
  for (const kind of ['recharge', 'exchange', 'draw']) {
    app.post('/api/' + kind, async (req, res, next) => {
      const id = req.body?.student_id;
      const amount = req.body?.coins;
      if (!validStudent(id)) return res.status(400).json({ error: 'Use a student_id of 1–30 letters, digits, underscores or hyphens.' });
      if (kind !== 'draw' && !positiveInteger(amount)) return res.status(400).json({ error: 'coins must be an integer from 1 to 100000.' });
      if (kind === 'exchange' && amount % RULES.coinsPerGem !== 0) return res.status(400).json({ error: 'Exchange coins must be a multiple of 100.' });
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        await client.query('INSERT INTO wallets(student_id) VALUES($1) ON CONFLICT DO NOTHING', [id]);
        // The row lock serializes changes to one wallet, including concurrent requests.
        const { rows: locked } = await client.query('SELECT * FROM wallets WHERE student_id=$1 FOR UPDATE', [id]);
        const wallet = locked[0];
        let coinDelta = 0, gemDelta = 0;
        if (kind === 'recharge') coinDelta = amount;
        if (kind === 'exchange') { coinDelta = -amount; gemDelta = amount / RULES.coinsPerGem; }
        if (kind === 'draw') gemDelta = -RULES.gemsPerDraw;
        if (wallet.coins + coinDelta < 0 || wallet.gems + gemDelta < 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Not enough virtual currency.', wallet });
        }
        if (wallet.coins + coinDelta > RULES.maxBalance || wallet.gems + gemDelta > RULES.maxBalance) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Wallet balance limit reached.', wallet });
        }
        const updated = await client.query('UPDATE wallets SET coins=coins+$2,gems=gems+$3,updated_at=NOW() WHERE student_id=$1 RETURNING *', [id, coinDelta, gemDelta]);
        const tx = await client.query('INSERT INTO transactions(student_id,kind,coin_delta,gem_delta) VALUES($1,$2,$3,$4) RETURNING *', [id, kind, coinDelta, gemDelta]);
        let draw;
        if (kind === 'draw') {
          const result = drawOutcome();
          const inserted = await client.query('INSERT INTO draws(student_id,result_id,result_name,rarity,transaction_id) VALUES($1,$2,$3,$4,$5) RETURNING *', [id, result.id, result.name, result.rarity, tx.rows[0].id]);
          draw = inserted.rows[0];
        }
        await client.query('COMMIT');
        res.status(201).json({ wallet: updated.rows[0], transaction: tx.rows[0], ...(draw ? { draw } : {}) });
      } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        next(error);
      } finally { if (client) client.release(); }
    });
  }
  app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must be valid JSON.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body exceeds 8 KB.' });
    console.warn('Database request failed:', error.code || error.name);
    res.status(503).json({ error: 'Database unavailable. Check /health and retry after recovery.' });
  });
  return app;
}
module.exports = { createApp, corsMiddleware };

// Lab 14 smoke test: real HTTP requests against a running gacha API (local Compose, CI or a platform URL).
// Usage: node test/smoke.js http://localhost:8085      (optional: SMOKE_ORIGIN=http://localhost:5500 to check CORS)
const base = String(process.argv[2] || process.env.SMOKE_URL || 'http://localhost:8085').replace(/\/$/, '');
const origin = process.env.SMOKE_ORIGIN;
const student = 'smoke-' + Date.now().toString(36); // a fresh wallet every run, so results never depend on old data
let failed = 0;

async function call(method, route, body, headers = {}) {
  const response = await fetch(base + route, {
    method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: response.status, json, headers: response.headers };
}

function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
  if (!ok) failed++;
}

(async () => {
  console.log(`Smoke test ${base}  student ${student}`);
  const health = await call('GET', '/health');
  check('GET /health → 200 and database connected', health.status === 200 && health.json?.database === 'connected', 'version ' + (health.json?.version ?? '?'));
  const recharge = await call('POST', '/api/recharge', { student_id: student, coins: 1000 });
  check('POST /api/recharge 1000 → 201', recharge.status === 201, 'coins ' + recharge.json?.wallet?.coins);
  const exchange = await call('POST', '/api/exchange', { student_id: student, coins: 1000 });
  check('POST /api/exchange 1000 → 201 and 10 gems', exchange.status === 201 && exchange.json?.wallet?.gems === 10);
  const draw = await call('POST', '/api/draw', { student_id: student });
  check('POST /api/draw → 201 with a saved draw', draw.status === 201 && Boolean(draw.json?.draw?.id), draw.json?.draw?.result_name);
  const empty = await call('POST', '/api/draw', { student_id: student });
  check('POST /api/draw without gems → 409', empty.status === 409);
  const history = await call('GET', '/api/accounts/' + student + '/history');
  check('GET history shows the draw', history.status === 200 && history.json?.draws?.some(d => d.id === draw.json?.draw?.id));
  if (origin) {
    const preflight = await call('OPTIONS', '/api/draw', null, { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' });
    check(`CORS preflight from ${origin} → 204`, preflight.status === 204 && preflight.headers.get('access-control-allow-origin') === origin);
  }
  console.log(failed ? `${failed} check(s) failed` : 'All smoke checks passed');
  process.exitCode = failed ? 1 : 0; // exitCode (not process.exit) avoids a Windows crash while fetch sockets close
})().catch(error => { console.error('FAIL  cannot reach ' + base + ': ' + error.message); process.exitCode = 1; });

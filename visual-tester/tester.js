// Request logic for the gacha visual tester. Works without p5.js; sketch.js only draws GT.state.
(() => {
  'use strict';
  const config = window.GACHA_TESTER_CONFIG || { defaultApi: 'http://localhost:8085', presets: [] };
  const $ = id => document.getElementById(id);
  const TIMEOUT_MS = 90000;      // free Render services can take about a minute to wake up
  const SLOW_MS = 6000;

  const state = {
    lang: 'en',
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    base: '',
    target: { kind: 'unknown', entry: '', crossOrigin: false },
    corsOk: false,
    pageOrigin: location.origin,
    wallet: { coins: 0, gems: 0, known: false },
    lastDraw: null,
    nodes: { entry: 'idle', app: 'idle', db: 'idle' },
    packets: [],
    busy: false
  };

  const text = {
    en: {
      sending: 'Sending', slow: 'Still waiting… check that the backend is running; a sleeping free hosted service (Lab 14 platforms) can take about a minute to wake up.',
      ok: 'Response', invalidId: 'Enter a student ID of 1–30 letters, digits, _ or -.', invalidBase: 'Enter an http:// or https:// API base URL.',
      sameOrigin: 'Same origin: this page and the API share {o}. No CORS setting is needed.',
      cross: 'Cross-origin: this page is {p} and the API is {o}. The API must list this page: put CORS_ORIGINS={p} in .env, then recreate the app container (up -d, not restart).',
      crossAllowed: 'Cross-origin and allowed ✓ This page is {p}; the API {o} sent Access-Control-Allow-Origin for it, so the browser shows the responses.',
      loopbackAlias: 'Careful: {p} and http://localhost{n} are different origins. List exactly the origin in your address bar.',
      publicToLocal: 'This page is served from {p}. To call a backend on your own computer, CORS_ORIGINS must contain {p} and the browser may ask for local-network permission. Easier: open your backend’s own /visual/ page (same origin).',
      fileOrigin: 'Opened as a file:// page (origin "null"). Prefer the compose.cors.yml tester, Node’s npm start or python3 -m http.server 5500 so the origin is http://localhost:5500.',
      mixed: 'Blocked as mixed content: an HTTPS page cannot call an HTTP API. Use the HTTPS backend URL, or run this tester locally over http.',
      cors: 'CORS: the server answered, but the browser hid the response because the API did not list {p}. Put CORS_ORIGINS={p} in .env, run docker compose … up -d app (restart does not reload .env), then check docker compose logs app.',
      unreachable: 'No connection: check the URL, that the backend is running, the port/prefix, firewall or DNS.',
      timeout: 'Timed out after 90 s. Check platform logs; the service may be crashing or still deploying.',
      notJson: 'Response was not JSON — usually a wrong base URL or prefix, a proxy error page (502/504) or a static-host 404.',
      copied: 'Share link copied.', placeholder: 'Edit the domain in the URL field first.'
    },
    th: {
      sending: 'กำลังส่ง', slow: 'ยังรออยู่… ตรวจว่าแบ็กเอนด์รันอยู่ บริการ hosting ฟรีที่หลับอยู่ (แพลตฟอร์มใน Lab 14) อาจใช้เวลาราวหนึ่งนาทีในการตื่น',
      ok: 'คำตอบ', invalidId: 'กรุณาใส่รหัส 1–30 ตัวอักษร ตัวเลข _ หรือ -', invalidBase: 'กรุณาใส่ URL ของ API ที่ขึ้นต้นด้วย http:// หรือ https://',
      sameOrigin: 'Same origin: หน้านี้และ API ใช้ {o} เดียวกัน ไม่ต้องตั้งค่า CORS',
      cross: 'Cross-origin: หน้านี้คือ {p} ส่วน API คือ {o} API ต้องระบุหน้านี้: ใส่ CORS_ORIGINS={p} ใน .env แล้วสร้าง container แอปใหม่ (up -d ไม่ใช่ restart)',
      crossAllowed: 'Cross-origin และได้รับอนุญาต ✓ หน้านี้คือ {p} และ API {o} ตอบพร้อม Access-Control-Allow-Origin ของหน้านี้ เบราว์เซอร์จึงแสดงคำตอบได้',
      loopbackAlias: 'ระวัง: {p} กับ http://localhost{n} เป็นคนละ origin ให้ใส่ origin ตามที่เห็นในแถบที่อยู่แบบตรงตัว',
      publicToLocal: 'หน้านี้มาจาก {p} หากจะเรียกแบ็กเอนด์บนเครื่องตนเอง CORS_ORIGINS ต้องมี {p} และเบราว์เซอร์อาจถามสิทธิ์ local network วิธีที่ง่ายกว่าคือเปิดหน้า /visual/ ของแบ็กเอนด์เอง (origin เดียวกัน)',
      fileOrigin: 'เปิดแบบไฟล์ file:// (origin เป็น "null") แนะนำใช้ tester จาก compose.cors.yml, npm start ของ Node หรือ python3 -m http.server 5500 เพื่อให้ origin เป็น http://localhost:5500',
      mixed: 'ถูกบล็อกเพราะ mixed content: หน้า HTTPS เรียก API แบบ HTTP ไม่ได้ ใช้ URL แบ็กเอนด์ที่เป็น HTTPS หรือรัน tester นี้ในเครื่องผ่าน http',
      cors: 'CORS: เซิร์ฟเวอร์ตอบแล้ว แต่เบราว์เซอร์ซ่อนคำตอบเพราะ API ไม่ได้ระบุ {p} ให้ใส่ CORS_ORIGINS={p} ใน .env แล้วรัน docker compose … up -d app (restart ไม่อ่าน .env ใหม่) จากนั้นดู docker compose logs app',
      unreachable: 'เชื่อมต่อไม่ได้: ตรวจ URL ว่าแบ็กเอนด์รันอยู่ พอร์ต/prefix ไฟร์วอลล์ หรือ DNS',
      timeout: 'หมดเวลา 90 วินาที ตรวจ log ของแพลตฟอร์ม บริการอาจ crash หรือยัง deploy ไม่เสร็จ',
      notJson: 'คำตอบไม่ใช่ JSON — มักเกิดจาก base URL หรือ prefix ผิด หน้า error ของ proxy (502/504) หรือ 404 ของ static host',
      copied: 'คัดลอกลิงก์แชร์แล้ว', placeholder: 'แก้ domain ในช่อง URL ก่อน'
    }
  };
  const say = (key, vars = {}) => text[state.lang][key].replace(/\{(\w)\}/g, (_, k) => vars[k] ?? '');

  // ---------- backend target ----------
  function builtInBase() {
    // When app.js serves this page at <prefix>/visual/, the API lives at <prefix>.
    if (!/^https?:$/.test(location.protocol)) return '';
    const match = location.pathname.match(/^(.*)\/visual\/(index\.html)?$/);
    return match ? location.origin + match[1] : '';
  }
  function normalize(value) {
    let v = String(value || '').trim();
    if (!v) return '';
    if (!/^https?:\/\//i.test(v)) v = (/^(localhost|127\.|\[::1\]|\d+\.\d+\.\d+\.\d+)/.test(v) ? 'http://' : 'https://') + v;
    try { const u = new URL(v); return (u.origin + u.pathname).replace(/\/(test|visual)?\/?$/, '').replace(/\/$/, ''); } catch { return ''; }
  }
  function classify(base) {
    const u = new URL(base), host = u.hostname, kind =
      host.endsWith('.onrender.com') ? 'render' :
      host.endsWith('.up.railway.app') || host.endsWith('.railway.app') ? 'railway' :
      /^(localhost|127\.0\.0\.1|\[::1\])$/.test(host) ? (u.pathname.startsWith('/backend') ? 'npm' : 'direct') :
      u.pathname.startsWith('/backend') ? 'proxy' :
      u.protocol === 'https:' ? 'https' : 'vm';
    const entry = {
      direct: { en: 'Published port :' + (u.port || '80'), th: 'พอร์ตที่ publish :' + (u.port || '80') },
      npm: { en: 'NPM strips /backend/', th: 'NPM ตัด /backend/' },
      proxy: { en: 'Proxy strips /backend/', th: 'Proxy ตัด /backend/' },
      railway: { en: 'Railway HTTPS edge', th: 'Railway HTTPS edge' },
      render: { en: 'Render HTTPS edge', th: 'Render HTTPS edge' },
      https: { en: 'HTTPS entry', th: 'ทางเข้า HTTPS' },
      vm: { en: 'VM / VPS entry', th: 'ทางเข้า VM / VPS' }
    }[kind];
    return { kind, entry, host: u.host, origin: u.origin, crossOrigin: u.origin !== location.origin };
  }
  function setBase(value, remember = true) {
    const base = normalize(value);
    if (!base) { $('status').textContent = say('invalidBase'); return false; }
    state.base = base;
    state.target = classify(base);
    $('base').value = base;
    if (remember) try { localStorage.setItem('gacha-tester-api', base); } catch { /* private mode */ }
    state.nodes = { entry: 'idle', app: 'idle', db: 'idle' };
    state.corsOk = false;
    renderOriginNote();
    return true;
  }
  function renderOriginNote() {
    const note = $('origin-note');
    const pageOrigin = location.origin === 'null' || location.protocol === 'file:' ? 'null' : location.origin;
    note.innerHTML = '';
    const line = !state.target.crossOrigin ? say('sameOrigin', { o: state.target.origin }) : say(state.corsOk ? 'crossAllowed' : 'cross', { p: pageOrigin, o: state.target.origin });
    // Render CORS_ORIGINS=... as <code> so students can copy it exactly.
    line.split(/(CORS_ORIGINS=\S+?)(?=\s|$)/).forEach(part => {
      if (part.startsWith('CORS_ORIGINS=')) { const c = document.createElement('code'); c.textContent = part; note.append(c); }
      else note.append(part);
    });
    if (pageOrigin === 'null') { note.append(document.createElement('br'), say('fileOrigin')); return; }
    if (!state.target.crossOrigin || state.corsOk) return;
    const localName = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/;
    if (localName.test(location.hostname) && location.hostname !== 'localhost') {
      note.append(document.createElement('br'), say('loopbackAlias', { p: pageOrigin, n: location.port ? ':' + location.port : '' }));
    }
    let targetHost = '';
    try { targetHost = new URL(state.base).hostname; } catch { /* invalid base */ }
    if (!localName.test(location.hostname) && (localName.test(targetHost) || targetHost.endsWith('.test'))) {
      note.append(document.createElement('br'), say('publicToLocal', { p: pageOrigin }));
    }
  }

  // ---------- requests ----------
  const ROUTES = {
    health: { method: 'GET', path: () => '/health', db: true },
    catalog: { method: 'GET', path: () => '/api/catalog', db: false },
    wallet: { method: 'GET', path: s => '/api/accounts/' + encodeURIComponent(s), db: true },
    history: { method: 'GET', path: s => '/api/accounts/' + encodeURIComponent(s) + '/history', db: true },
    recharge: { method: 'POST', path: () => '/api/recharge', db: true },
    exchange: { method: 'POST', path: () => '/api/exchange', db: true },
    draw: { method: 'POST', path: () => '/api/draw', db: true }
  };
  let packetId = 0;

  async function diagnose(url) {
    if (location.protocol === 'https:' && url.startsWith('http:') && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(url)) return 'mixed';
    try { await fetch(url, { mode: 'no-cors', cache: 'no-store' }); return 'cors'; } // opaque success = server reachable
    catch { return 'unreachable'; }
  }

  async function send(action) {
    if (!state.base && !setBase($('base').value)) return null;
    if (/YOUR-APP/.test(state.base)) { $('status').textContent = say('placeholder'); return null; }
    const route = ROUTES[action];
    const student = $('student').value.trim();
    if (!['health', 'catalog'].includes(action) && !/^[A-Za-z0-9_-]{1,30}$/.test(student)) { $('status').textContent = say('invalidId'); return null; }
    const url = state.base + route.path(student);
    const body = route.method === 'POST' ? { student_id: student } : undefined;
    if (action === 'recharge' || action === 'exchange') body.coins = Number($(action).value);

    const packet = { id: ++packetId, action, method: route.method, usesDb: route.db, start: performance.now(), phase: 'out', status: null, outcome: null, ms: null };
    state.packets.push(packet);
    if (state.packets.length > 12) state.packets.shift();
    state.busy = true;
    if (action === 'draw') state.lastDraw = { pending: true, at: performance.now() };
    $('status').textContent = say('sending') + ' ' + route.method + ' ' + url;
    const slowTimer = setTimeout(() => { $('status').textContent = say('slow'); packet.slow = true; }, SLOW_MS);
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const entry = { method: route.method, url, body };
    try {
      const response = await fetch(url, {
        method: route.method, signal: controller.signal, cache: 'no-store',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      packet.ms = Math.round(performance.now() - packet.start);
      packet.status = response.status;
      const raw = await response.text();
      let data;
      try { data = JSON.parse(raw); } catch { data = null; }
      if (data === null) {
        packet.outcome = 'notjson';
        state.nodes.entry = 'bad';
        finish(packet, entry, { status: response.status, why: say('notJson'), preview: raw.slice(0, 400) });
        return null;
      }
      packet.outcome = response.ok ? 'ok' : response.status >= 500 ? 'error' : 'warn';
      if (state.target.crossOrigin && !state.corsOk) { state.corsOk = true; renderOriginNote(); }
      state.nodes.entry = 'ok';
      state.nodes.app = 'ok';
      if (action === 'health' || response.status === 503) state.nodes.db = response.ok ? 'ok' : 'bad';
      else if (response.ok && route.db) state.nodes.db = 'ok';
      if (data.wallet) state.wallet = { coins: data.wallet.coins, gems: data.wallet.gems, known: true };
      if (action === 'draw') state.lastDraw = data.draw ? { ...data.draw, at: performance.now() } : { failed: true, at: performance.now(), error: data.error };
      finish(packet, entry, { status: response.status, data });
      return data;
    } catch (error) {
      packet.ms = Math.round(performance.now() - packet.start);
      const kind = error.name === 'AbortError' ? 'timeout' : await diagnose(url);
      packet.outcome = kind; // 'cors' | 'mixed' | 'unreachable' | 'timeout'
      if (state.corsOk) { state.corsOk = false; renderOriginNote(); }
      state.nodes.entry = kind === 'cors' ? 'ok' : 'bad';
      if (action === 'draw') state.lastDraw = { failed: true, at: performance.now(), error: kind };
      const why = say(kind, { p: location.origin });
      finish(packet, entry, { status: kind.toUpperCase(), why });
      return null;
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(abortTimer);
      if (action === 'draw' && state.lastDraw?.pending) state.lastDraw = { failed: true, at: performance.now(), error: String(packet.status ?? packet.outcome) };
      state.busy = state.packets.some(p => p.phase === 'out' && p.outcome === null);
    }
  }

  function finish(packet, entry, result) {
    packet.resolvedAt = performance.now();
    const cls = packet.outcome === 'ok' ? 'ok' : packet.outcome === 'warn' ? 'warn' : 'bad';
    const li = document.createElement('li');
    const cells = [entry.method, entry.url.replace(state.base, '') || '/', String(result.status), packet.ms + ' ms'];
    cells.forEach((value, i) => { const span = document.createElement('span'); span.textContent = value; if (i === 2) span.className = cls; li.append(span); });
    if (result.why) { const why = document.createElement('span'); why.className = 'why'; why.textContent = result.why; li.append(why); }
    $('log').prepend(li);
    while ($('log').children.length > 40) $('log').lastChild.remove();
    $('response').textContent = JSON.stringify({
      request: { method: entry.method, url: entry.url, body: entry.body ?? '(no body)' },
      response: { status: result.status, ms: packet.ms, json: result.data ?? null, ...(result.preview ? { textPreview: result.preview } : {}) }
    }, null, 2);
    $('status').textContent = result.why || (say('ok') + ': ' + entry.method + ' ' + entry.url + ' → ' + result.status + ' · ' + packet.ms + ' ms');
  }

  async function connect() {
    if (!setBase($('base').value)) return;
    await send('health');
    await send('catalog');
  }

  // ---------- page wiring ----------
  function translate(lang) {
    state.lang = lang;
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-en]').forEach(el => { el.textContent = el.dataset[lang]; });
    $('lang-en').setAttribute('aria-pressed', String(lang === 'en'));
    $('lang-th').setAttribute('aria-pressed', String(lang === 'th'));
    fillPresets();
    if (state.base) renderOriginNote();
  }
  function fillPresets() {
    const select = $('preset'), current = select.value;
    select.innerHTML = '';
    const options = [];
    if (builtInBase()) options.push({ id: 'same', en: 'Same origin · this backend', th: 'Origin เดียวกัน · แบ็กเอนด์นี้', url: builtInBase() });
    options.push(...config.presets, { id: 'custom', en: 'Custom URL…', th: 'URL อื่น…', url: '' });
    for (const p of options) { const o = document.createElement('option'); o.value = p.id; o.textContent = p[state.lang] || p.en; o.dataset.url = p.url; select.append(o); }
    select.value = current && options.some(p => p.id === current) ? current : 'custom';
  }
  $('preset').addEventListener('change', e => {
    const url = e.target.selectedOptions[0].dataset.url;
    if (url) { setBase(url); if (!/YOUR-APP/.test(url)) connect(); else $('base').focus(); }
    else $('base').focus();
  });
  $('base').addEventListener('change', () => { $('preset').value = 'custom'; setBase($('base').value); });
  $('connect').addEventListener('click', connect);
  $('share').addEventListener('click', async () => {
    const link = new URL(location.href); link.search = ''; link.hash = '';
    if (state.base) link.searchParams.set('api', state.base);
    try { await navigator.clipboard.writeText(link.href); $('status').textContent = say('copied'); } catch { $('status').textContent = link.href; }
  });
  document.querySelectorAll('[data-action]').forEach(b => b.addEventListener('click', () => send(b.dataset.action)));
  $('lang-en').addEventListener('click', () => translate('en'));
  $('lang-th').addEventListener('click', () => translate('th'));
  $('motion').setAttribute('aria-pressed', String(state.reducedMotion));
  $('motion').addEventListener('click', e => { state.reducedMotion = !state.reducedMotion; e.currentTarget.setAttribute('aria-pressed', String(state.reducedMotion)); });

  fillPresets();
  let stored = '';
  try { stored = localStorage.getItem('gacha-tester-api') || ''; } catch { /* ignore */ }
  const fromQuery = new URLSearchParams(location.search).get('api');
  const initial = fromQuery || builtInBase() || stored || config.defaultApi;
  setBase(initial, Boolean(fromQuery));
  const match = [...$('preset').options].find(o => o.dataset.url && normalize(o.dataset.url) === state.base);
  if (match) $('preset').value = match.value;

  window.GachaTester = { state, send, connect, setBase, say };
})();

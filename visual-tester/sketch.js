// p5.js drawing for the gacha visual tester (global mode, works with p5 1.x and 2.x).
// It only reads window.GachaTester.state; every click calls GachaTester.send(action).
/* global createCanvas, resizeCanvas, background, fill, noFill, stroke, noStroke, strokeWeight, rect, ellipse,
   circle, line, triangle, quad, text, textSize, textAlign, textStyle, textWrap, push, pop, translate, rotate, scale,
   lerp, constrain, millis, sin, cos, PI, TWO_PI, LEFT, CENTER, RIGHT, TOP, BOTTOM, BOLD, NORMAL, WORD, cursor,
   mouseX, mouseY, width, height, deltaTime, drawingContext */

const GT = window.GachaTester;
const C = {
  bg: '#0f2025', panel: '#1b343b', line: '#3d5c5f', text: '#eaf2ed', muted: '#9fb6ae', accent: '#ddf397',
  get: '#7cc4ff', post: '#f0b54a', ok: '#7fe08a', warn: '#f0c060', bad: '#ff7b6b', gold: '#ffd54a', common: '#5fd0c0'
};
let regions = [];
let hover = null;
const shown = { coins: 0, gems: 0 };
const sparks = [];

function setup() {
  const stage = document.getElementById('stage');
  const canvas = createCanvas(stage.clientWidth, layout(stage.clientWidth).height);
  canvas.parent('stage');
  canvas.elt.setAttribute('role', 'img');
  canvas.elt.setAttribute('aria-label', 'Animated request path: tester page, entry point, Express app, PostgreSQL, plus wallet and gacha machine widgets. Use the buttons above for keyboard access.');
  textWrap(WORD);
}

function windowResized() {
  const w = document.getElementById('stage').clientWidth;
  resizeCanvas(w, layout(w).height);
}

// ---------- layout ----------
function layout(w) {
  const wide = w >= 760, pad = 18;
  if (wide) {
    const nodeW = (w - pad * 2 - 3 * 70) / 4, nodeH = 112, y = 46;
    const nodes = [0, 1, 2, 3].map(i => ({ x: pad + i * (nodeW + 70), y, w: nodeW, h: nodeH }));
    const wy = y + nodeH + 70, wh = 300, ww = (w - pad * 2 - 40) / 3;
    return { wide, height: wy + wh + 24, nodes,
      wallet: { x: pad, y: wy, w: ww, h: wh },
      exchange: { x: pad + ww + 20, y: wy, w: ww, h: wh },
      machine: { x: pad + (ww + 20) * 2, y: wy, w: ww, h: wh } };
  }
  const nodeW = w - pad * 2, nodeH = 70, gap = 46, y = 40;
  const nodes = [0, 1, 2, 3].map(i => ({ x: pad, y: y + i * (nodeH + gap), w: nodeW, h: nodeH }));
  const wy = y + 4 * nodeH + 3 * gap + 40;
  return { wide, height: wy + 170 + 14 + 160 + 14 + 300 + 20, nodes,
    wallet: { x: pad, y: wy, w: nodeW, h: 170 },
    exchange: { x: pad, y: wy + 184, w: nodeW, h: 160 },
    machine: { x: pad, y: wy + 358, w: nodeW, h: 300 } };
}
const centre = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
// Where packets travel: under the node text (wide) or at the right edge (narrow).
const anchor = (r, wide) => wide ? { x: r.x + r.w / 2, y: r.y + r.h * 0.66 } : { x: r.x + r.w - 46, y: r.y + r.h / 2 };
const L = (en, th) => (GT.state.lang === 'th' && th) ? th : en;
const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// ---------- main loop ----------
function draw() {
  const s = GT.state, lay = layout(width);
  background(C.bg);
  regions = [];
  hover = null;
  for (const r of collectRegions(lay)) if (inside(r, mouseX, mouseY)) hover = r;
  cursor(hover ? 'pointer' : 'default');

  drawTitle(lay);
  drawEdges(lay, s);
  drawNodes(lay, s);
  updateAndDrawPackets(lay, s);
  drawWallet(lay.wallet, s);
  drawExchange(lay.exchange, s);
  drawMachine(lay.machine, s);
  drawSparks();
}

function collectRegions(lay) {
  const n = lay.nodes;
  regions = [
    { ...n[2], action: 'health' }, { ...n[3], action: 'history' },
    { x: lay.wallet.x, y: lay.wallet.y, w: lay.wallet.w, h: lay.wallet.h * 0.45, action: 'wallet' },
    { x: lay.wallet.x, y: lay.wallet.y + lay.wallet.h * 0.45, w: lay.wallet.w, h: lay.wallet.h * 0.55, action: 'recharge' },
    { ...lay.exchange, action: 'exchange' }, { ...lay.machine, action: 'draw' }
  ];
  return regions;
}

function mousePressed() {
  const r = regions.find(region => inside(region, mouseX, mouseY));
  if (r && mouseY >= 0 && mouseY <= height) GT.send(r.action);
}

// ---------- diagram ----------
function drawTitle(lay) {
  noStroke(); fill(C.muted); textSize(13); textAlign(LEFT, TOP); textStyle(NORMAL);
  text(L('REQUEST PATH · click App or Database', 'เส้นทางคำขอ · คลิก App หรือ Database'), 18, 14);
  text(L('GACHA WIDGETS · click to send real requests', 'วิดเจ็ต GACHA · คลิกเพื่อส่งคำขอจริง'), 18, lay.wallet.y - 26);
}

function nodeInfo(s) {
  const origin = location.protocol === 'file:' ? 'file:// (origin null)' : location.host;
  const t = s.target;
  const platform = t.kind === 'railway' || t.kind === 'render';
  return [
    { title: L('This tester page', 'หน้า tester นี้'), sub: origin, state: 'idle' },
    { title: t.entry ? L(t.entry.en, t.entry.th) : '—', sub: t.host || '', state: s.nodes.entry },
    { title: 'Express app', sub: platform ? 'listens on $PORT' : 'app:3000', state: s.nodes.app, hint: 'GET /health' },
    { title: 'PostgreSQL', sub: platform ? L('platform DB service', 'DB service ของแพลตฟอร์ม') : 'db:5432 + volume', state: s.nodes.db, hint: 'GET …/history' }
  ];
}

function drawNodes(lay, s) {
  nodeInfo(s).forEach((info, i) => {
    const r = lay.nodes[i], isHover = hover && hover.x === r.x && hover.y === r.y;
    const border = info.state === 'ok' ? C.ok : info.state === 'bad' ? C.bad : C.line;
    stroke(border); strokeWeight(isHover ? 3 : 2); fill(isHover ? '#24444a' : C.panel);
    rect(r.x, r.y, r.w, r.h, 10);
    noStroke(); fill(C.accent); textStyle(BOLD); textSize(lay.wide ? 15 : 14); textAlign(LEFT, TOP);
    text((i + 1) + '  ' + info.title, r.x + 12, r.y + 10, r.w - 24);
    textStyle(NORMAL); fill(C.text); textSize(12.5);
    text(info.sub + (info.hint && lay.wide ? '\n' + L('click → ', 'คลิก → ') + info.hint : ''), r.x + 12, r.y + (lay.wide ? 36 : 34), r.w - (lay.wide ? 24 : 90));
    if (info.state !== 'idle') { fill(border); circle(r.x + r.w - 14, r.y + 14, 10); }
  });
}

function drawEdges(lay, s) {
  const n = lay.nodes;
  for (let i = 0; i < 3; i++) {
    const a = edgePoint(n[i], n[i + 1], lay.wide, true), b = edgePoint(n[i], n[i + 1], lay.wide, false);
    stroke(C.line); strokeWeight(2); line(a.x, a.y, b.x, b.y);
    noStroke(); fill(C.line); arrowHead(a, b);
  }
  // Boundary label between page and entry: same origin vs cross-origin (needs CORS).
  const a = edgePoint(n[0], n[1], lay.wide, true), b = edgePoint(n[0], n[1], lay.wide, false);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const cross = s.target.crossOrigin;
  const label = cross ? 'CORS' : L('same origin', 'origin เดียว');
  noStroke(); textSize(11); textAlign(CENTER, CENTER); textStyle(BOLD);
  fill(cross ? C.warn : C.ok);
  if (lay.wide) text(label, mid.x, mid.y - 16); else { textAlign(LEFT, CENTER); text(label, mid.x + 12, mid.y); }
  textStyle(NORMAL);
}

function edgePoint(r1, r2, wide, start) {
  if (wide) return start ? { x: r1.x + r1.w + 6, y: r1.y + r1.h / 2 } : { x: r2.x - 6, y: r2.y + r2.h / 2 };
  return start ? { x: r1.x + 40, y: r1.y + r1.h + 6 } : { x: r2.x + 40, y: r2.y - 6 };
}

function arrowHead(a, b) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  push(); translate(b.x, b.y); rotate(ang); triangle(0, 0, -9, -5, -9, 5); pop();
}

// Distance d runs 0 → 3 along tester → entry → app → db (hop centres).
function pointAt(lay, d) {
  const pts = lay.nodes.map(r => anchor(r, lay.wide));
  const i = constrain(Math.floor(d), 0, 2), f = constrain(d - i, 0, 1);
  return { x: lerp(pts[i].x, pts[i + 1].x, f), y: lerp(pts[i].y, pts[i + 1].y, f) };
}

const REACH = { ok: null, warn: null, error: null, cors: 2, notjson: 1, unreachable: 0.5, mixed: 0.35, timeout: 0.5 };
function updateAndDrawPackets(lay, s) {
  const now = performance.now();
  const speed = s.reducedMotion ? 1000 : 1 / 330; // hops per ms
  for (const p of s.packets) {
    if (p.d === undefined) { p.d = 0; p.phase = 'out'; }
    const full = p.usesDb ? 3 : 2;
    const reach = p.outcome && REACH[p.outcome] != null ? REACH[p.outcome] : full;
    const step = (s.reducedMotion ? 1000 : deltaTime) * speed;
    if (p.phase === 'out') {
      p.d = Math.min(p.d + step, p.outcome ? reach : full);
      if (p.outcome && p.d >= reach - 1e-6) {
        p.phase = ['unreachable', 'mixed', 'timeout'].includes(p.outcome) ? 'blocked' : 'back';
        p.turnAt = now;
      }
    } else if (p.phase === 'back') {
      const stopAt = p.outcome === 'cors' ? 0.3 : 0;
      p.d = Math.max(p.d - step, stopAt);
      if (p.d <= stopAt) { p.phase = p.outcome === 'cors' ? 'blocked' : 'done'; p.turnAt = now; }
    }
    drawPacket(lay, s, p, now, full);
  }
}

function drawPacket(lay, s, p, now, full) {
  const age = p.turnAt ? now - p.turnAt : 0;
  const finished = p.phase === 'done' || p.phase === 'blocked';
  const latest = s.packets[s.packets.length - 1] === p;
  if (finished && (age > (p.phase === 'blocked' ? 4000 : 1200) || !latest)) return;
  const pos = pointAt(lay, p.d);
  const resultColour = { ok: C.ok, warn: C.warn, error: C.bad }[p.outcome] || C.bad;
  const colour = p.phase === 'out' ? (p.method === 'GET' ? C.get : C.post) : resultColour;
  const waiting = p.phase === 'out' && !p.outcome && p.d >= full - 1e-6;
  push();
  if (waiting) { noFill(); stroke(colour); strokeWeight(2); const r = 18 + 8 * sin(millis() / 180); circle(pos.x, pos.y, r); }
  noStroke(); fill(colour);
  circle(pos.x, pos.y, 14);
  if (p.phase === 'blocked') {
    stroke(C.bad); strokeWeight(4);
    line(pos.x - 11, pos.y - 11, pos.x + 11, pos.y + 11); line(pos.x - 11, pos.y + 11, pos.x + 11, pos.y - 11);
  }
  // Only the newest packet (or a blocked one) gets a text label, so fast clicks stay readable.
  if (!latest && p.phase !== 'blocked') { pop(); return; }
  noStroke(); fill(C.text); textSize(11.5);
  const label = p.phase === 'out' ? (p.method + ' ' + p.action + (waiting && p.slow ? L(' · waking up?', ' · กำลังตื่น?') : ''))
    : (String(p.status ?? p.outcome).toUpperCase() + (p.ms != null ? ' · ' + p.ms + ' ms' : ''));
  if (lay.wide) { textAlign(CENTER, TOP); text(label, pos.x, pos.y + 12); }
  else { textAlign(RIGHT, CENTER); text(label, pos.x - 14, pos.y + 22); }
  pop();
}

// ---------- widgets ----------
function panel(r, action, title) {
  const isHover = hover && hover.action === action;
  stroke(isHover ? C.accent : C.line); strokeWeight(isHover ? 2.5 : 1.5); fill(C.panel);
  rect(r.x, r.y, r.w, r.h, 12);
  noStroke(); fill(C.accent); textStyle(BOLD); textSize(14); textAlign(LEFT, TOP);
  text(title, r.x + 14, r.y + 12, r.w - 28); textStyle(NORMAL);
}

function drawWallet(r, s) {
  const wHover = hover && (hover.action === 'wallet' || hover.action === 'recharge');
  stroke(wHover ? C.accent : C.line); strokeWeight(wHover ? 2.5 : 1.5); fill(C.panel); rect(r.x, r.y, r.w, r.h, 12);
  noStroke(); fill(C.accent); textStyle(BOLD); textSize(14); textAlign(LEFT, TOP);
  text(L('Wallet · click to read', 'กระเป๋า · คลิกเพื่ออ่าน'), r.x + 14, r.y + 12, r.w - 28); textStyle(NORMAL);
  const ease = s.reducedMotion ? 1 : 0.12;
  shown.coins = lerp(shown.coins, s.wallet.coins, ease); shown.gems = lerp(shown.gems, s.wallet.gems, ease);
  if (Math.abs(shown.coins - s.wallet.coins) < 0.5) shown.coins = s.wallet.coins;
  if (Math.abs(shown.gems - s.wallet.gems) < 0.05) shown.gems = s.wallet.gems;
  fill(C.text); textSize(r.w < 260 ? 18 : 22); textStyle(BOLD);
  const known = s.wallet.known;
  text((known ? Math.round(shown.coins).toLocaleString() : '?') + ' coins', r.x + 14, r.y + 40);
  fill('#c9b8ff'); text((known ? Math.round(shown.gems).toLocaleString() : '?') + ' gems', r.x + 14, r.y + 68);
  textStyle(NORMAL);
  // Coin pile: one coin per 1,000 coins (max 12). Clicking the pile recharges.
  const coins = Math.min(12, Math.ceil(shown.coins / 1000));
  const baseY = r.y + r.h - 26, cx = r.x + 40;
  for (let i = 0; i < coins; i++) { stroke('#8a6a10'); strokeWeight(1.5); fill(C.gold); ellipse(cx + (i % 2) * 6, baseY - i * 7, 44, 14); }
  if (coins === 0) { noFill(); stroke(C.muted); ellipse(cx, baseY, 44, 14); }
  // Gems: one diamond per gem (max 12)
  const gems = Math.min(12, Math.floor(shown.gems));
  for (let i = 0; i < gems; i++) {
    const gx = r.x + 95 + (i % 6) * 22, gy = baseY - 30 + Math.floor(i / 6) * 26;
    noStroke(); fill('#b49cff'); quad(gx, gy - 9, gx + 8, gy, gx, gy + 9, gx - 8, gy);
  }
  noStroke(); fill(C.muted); textSize(11.5); textAlign(LEFT, BOTTOM);
  text(L('click the coins → POST recharge', 'คลิกเหรียญ → POST recharge'), r.x + 14, r.y + r.h - 4);
}

function drawExchange(r, s) {
  panel(r, 'exchange', L('Exchange · 100 coins → 1 gem', 'แลก · 100 coin → 1 gem'));
  const cy = r.y + r.h / 2 + 6, left = r.x + r.w * 0.22, right = r.x + r.w * 0.78;
  stroke('#8a6a10'); strokeWeight(1.5); fill(C.gold); ellipse(left, cy, 46, 46);
  noStroke(); fill('#5a4300'); textAlign(CENTER, CENTER); textStyle(BOLD); textSize(13); text('100', left, cy);
  const t = s.reducedMotion ? 0.5 : (millis() % 1600) / 1600;
  stroke(C.accent); strokeWeight(3); line(left + 30, cy, right - 30, cy);
  noStroke(); fill(C.accent); arrowHead({ x: left, y: cy }, { x: right - 24, y: cy });
  fill(C.accent); circle(lerp(left + 30, right - 30, t), cy, 7);
  fill('#b49cff'); quad(right, cy - 22, right + 18, cy, right, cy + 22, right - 18, cy);
  fill(C.text); textSize(13); text('1', right, cy);
  textStyle(NORMAL); fill(C.muted); textSize(12); textAlign(CENTER, TOP);
  const amount = Number(document.getElementById('exchange').value) || 0;
  text(L('click → POST exchange ' + amount + ' coins', 'คลิก → POST แลก ' + amount + ' coin'), r.x + 10, r.y + r.h - 40, r.w - 20);
  if (s.wallet.known && s.wallet.coins < 100) { fill(C.warn); text(L('need ≥ 100 coins (else 409)', 'ต้องมี ≥ 100 coin (ไม่งั้นได้ 409)'), r.x + 10, r.y + 40, r.w - 20); }
}

function drawMachine(r, s) {
  panel(r, 'draw', L('Gacha machine · 10 gems per draw', 'ตู้กาชา · สุ่มครั้งละ 10 gem'));
  const sideBySide = r.w >= 240, dome = Math.min(100, r.w * (sideBySide ? 0.3 : 0.42));
  const cx = r.x + r.w * (sideBySide ? 0.28 : 0.5), domeY = r.y + 50 + dome / 2;
  const result = s.lastDraw, now = performance.now();
  const shaking = result && result.pending && !s.reducedMotion;
  const jx = shaking ? sin(millis() / 30) * 3 : 0;
  // body and dome
  noStroke(); fill('#c14a4a'); rect(cx - dome * 0.55 + jx, domeY + dome * 0.42, dome * 1.1, dome * 0.9, 10);
  fill('#2a1214'); rect(cx - 16 + jx, domeY + dome * 0.95, 32, 22, 4);
  stroke('#eaf2ed'); strokeWeight(2); fill('#ffffff22'); circle(cx + jx, domeY, dome);
  const palette = ['#7cc4ff', '#f0b54a', '#7fe08a', '#ff7b6b', '#c9b8ff', '#5fd0c0'];
  noStroke();
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4 + (shaking ? millis() / 120 : 0), rr = dome * 0.28 * ((i % 3) + 1) / 3;
    fill(palette[i % palette.length]); circle(cx + jx + cos(a) * rr, domeY + 8 + sin(a) * rr * 0.7, dome * 0.17);
  }
  // knob
  push(); translate(cx + dome * 0.32 + jx, domeY + dome * 0.72); rotate(shaking ? millis() / 150 : 0);
  fill('#eaf2ed'); circle(0, 0, 26); fill('#c14a4a'); rect(-3, -12, 6, 24, 2); pop();

  // result capsule
  const rx = sideBySide ? r.x + r.w * 0.74 : cx, ry = sideBySide ? domeY + 30 : domeY + dome * 1.45 + 70;
  const boxW = sideBySide ? r.w * 0.44 : r.w - 30;
  textAlign(CENTER, CENTER);
  if (!result) {
    fill(C.muted); textSize(12.5);
    text(L('click the machine → POST draw', 'คลิกตู้ → POST draw'), rx - boxW / 2, ry - 10, boxW);
  } else if (result.pending) {
    fill(C.text); textSize(14); text(L('drawing…', 'กำลังสุ่ม…'), rx, ry);
  } else if (result.failed) {
    fill(C.bad); textSize(13);
    text(L('No draw: ', 'ไม่ได้สุ่ม: ') + (result.error || 'error'), rx - boxW / 2, ry - 20, boxW);
  } else {
    const ssr = result.rarity === 'SSR', grow = s.reducedMotion ? 1 : constrain((now - result.at) / 500, 0, 1);
    if (ssr && !result.burst) { result.burst = true; burst(rx, ry); }
    if (ssr) { push(); translate(rx, ry); rotate(millis() / 2000); stroke(C.gold); strokeWeight(2);
      for (let i = 0; i < 12; i++) { rotate(TWO_PI / 12); line(0, 34 * grow, 0, 56 * grow); } pop(); }
    noStroke(); fill(ssr ? C.gold : C.common); circle(rx, ry, 60 * grow);
    fill('#14282f'); textStyle(BOLD); textSize(13); text(result.rarity || '', rx, ry);
    fill(ssr ? C.gold : C.text); textSize(15); text(result.result_name || '', rx, ry + 52);
    textStyle(NORMAL); fill(C.muted); textSize(11.5); text('draw #' + result.id, rx, ry + 72);
  }
  noStroke(); fill(C.muted); textSize(11.5); textAlign(LEFT, BOTTOM);
  text(L('SSR 2% per draw · each SSR 0.4% · no guarantee', 'SSR 2% ต่อครั้ง · SSR แต่ละตัว 0.4% · ไม่รับประกัน'), r.x + 14, r.y + r.h - 8, r.w - 28);
  if (s.wallet.known && s.wallet.gems < 10) { fill(C.warn); textAlign(LEFT, TOP); text(L('need 10 gems (else 409)', 'ต้องมี 10 gem (ไม่งั้นได้ 409)'), r.x + 14, r.y + 34); }
}

function burst(x, y) {
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * TWO_PI, v = 1 + Math.random() * 3;
    sparks.push({ x, y, vx: cos(a) * v, vy: sin(a) * v - 1, life: 60 + Math.random() * 40 });
  }
}
function drawSparks() {
  if (GT.state.reducedMotion) { sparks.length = 0; return; }
  noStroke();
  for (let i = sparks.length - 1; i >= 0; i--) {
    const p = sparks[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= 1;
    fill(255, 213, 74, Math.max(0, p.life * 3)); circle(p.x, p.y, 5);
    if (p.life <= 0) sparks.splice(i, 1);
  }
}

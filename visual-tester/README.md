# Gacha visual tester (p5.js)

**Dr. Pisit Praiwattana, your mentor in 2026**

A static page that sends real requests to the ITCS258 gacha API and draws each
one travelling **page → entry → app → database** and back, coloured by its HTTP
status. Click the App or Database node, the coins, the exchange arrow or the gacha
machine; every action also has a normal button for keyboard users.

หน้า static ที่ส่งคำขอจริงไปยัง gacha API แล้ววาดเส้นทาง หน้าเว็บ → ทางเข้า → แอป
→ ฐานข้อมูล พร้อมสถานะ HTTP คลิกแผนภาพหรือปุ่มก็ได้

## Run it

| Option | Command | Page origin |
| --- | --- | --- |
| Built into the app | open `http://localhost:8085/visual/` | same as the API (no CORS) |
| Docker Compose (Lab 13 · 03) | in the `gacha-workshop` folder: `docker compose --env-file .env -f compose.yml -f compose.local.yml -f compose.cors.yml up -d --build --wait`, then open `http://localhost:5500` | `http://localhost:5500` |
| With npm (Node's npm) | in this folder: `npm start` | `http://localhost:5500` |
| Without npm | `python3 -m http.server 5500` or `node serve.js` | `http://localhost:5500` (open that address, not the one Python prints) |
| Vercel (Lab 14 · CI/CD, not part of Lab 13) | Root Directory `workshop/gacha/visual-tester`, preset **Other**, no build | `https://….vercel.app` |

The Compose way uses `compose.cors.yml`: it adds a `tester` service that serves this
folder on `127.0.0.1:5500`, a second origin next to the API on `:8085`. Follow the
step-by-step CORS experiment in section 03 of the gacha README.

ใช้ `compose.cors.yml` เพื่อเปิด tester เป็น origin ที่สอง (`http://localhost:5500`)
แล้วทำการทดลอง CORS ตามหัวข้อ 03 ใน README ของ gacha

For any origin other than the API's own, set the backend's `CORS_ORIGINS` to the
exact page origin (scheme + host + port, no path) and **recreate** the backend
(`... up -d --wait app`) or redeploy it. Opening `index.html` by double-click gives
origin `null`; use a server instead.

### Still CORS? / ยังติด CORS?

1. **Exact origin.** Compare the address bar with `CORS_ORIGINS`.
   `http://127.0.0.1:5500` and `http://localhost:5500` are **different** origins
   (VS Code Live Server opens `127.0.0.1` by default). List the one you use, or both.
2. **Recreate, do not restart.** `.env` is read when Compose creates the container.
   After editing it run `docker compose --env-file .env -f compose.yml -f compose.local.yml -f compose.cors.yml up -d --wait app`,
   not `restart`. Check with `... exec app printenv CORS_ORIGINS`; an empty line
   means the old container is still running.
3. **Read the app log.** `docker compose --env-file .env -f compose.yml -f compose.local.yml -f compose.cors.yml logs app`
   prints, once per blocked page origin:
   `CORS: page origin http://localhost:5500 is not in CORS_ORIGINS (empty). The browser will hide responses from that page.`
   The origin in that line is the exact value to add.

ตรวจ origin ให้ตรงทุกตัวอักษร (`127.0.0.1` ≠ `localhost`) ใช้ `up -d` ไม่ใช่ `restart`
หลังแก้ `.env` และดูบรรทัด `CORS: page origin …` ใน `logs app` ว่าต้องเพิ่ม origin ใด

## Choose the backend

1. `?api=https://YOUR-APP.onrender.com` in the page URL (share link)
2. the last URL used in this browser
3. same origin when served by the app at `/visual/`
4. `defaultApi` in `config.js` — edit this before deploying to Vercel

In Lab 14, point the tester at your deployed HTTPS app (`http://localhost:5500/?api=https://YOUR-APP.onrender.com`); `CORS_ORIGINS` on the platform must include `http://localhost:5500`.

## What the diagram tells you

| You see | Meaning |
| --- | --- |
| Blue / amber packet going out | GET / POST in flight |
| Pulsing ring, “waking up?” | no answer yet; check the backend is running (a sleeping free Lab 14 platform service may take ≈1 min) |
| Green / amber / red packet returning | 2xx / 4xx (e.g. 409 not enough gems) / 5xx |
| Red ✕ at the page | server reached, browser blocked the response: **CORS** |
| Red ✕ before the entry | **UNREACHABLE** or **mixed content** (HTTPS page → HTTP API) |
| Red database node after Health | app up, database check failed (503) |

p5.js 2.3.4 loads from jsDelivr with an integrity hash. Without it, the buttons,
log and JSON evidence still work.

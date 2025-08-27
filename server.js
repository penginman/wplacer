import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import { CookieJar } from "tough-cookie";
import { Impit } from "impit";
import { Image, createCanvas } from "canvas";

// --- Setup Data Directory ---
const dataDir = "./data";
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// --- Logging & utils ---
const log = async (id, name, data, error) => {
  const timestamp = new Date().toLocaleString();
  const identifier = `(${name}#${id})`;
  if (error) {
    console.error(`[${timestamp}] ${identifier} ${data}:`, error);
    appendFileSync(path.join(dataDir, `errors.log`), `[${timestamp}] ${identifier} ${data}: ${error.stack || error.message}\n`);
  } else {
    console.log(`[${timestamp}] ${identifier} ${data}`);
    appendFileSync(path.join(dataDir, `logs.log`), `[${timestamp}] ${identifier} ${data}\n`);
  }
};

const duration = (durationMs) => {
  if (durationMs <= 0) return "0s";
  const totalSeconds = Math.floor(durationMs / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Colors / Palette (same as both versions) ---
const basic_colors = { "0,0,0": 1, "60,60,60": 2, "120,120,120": 3, "210,210,210": 4, "255,255,255": 5, "96,0,24": 6, "237,28,36": 7, "255,127,39": 8, "246,170,9": 9, "249,221,59": 10, "255,250,188": 11, "14,185,104": 12, "19,230,123": 13, "135,255,94": 14, "12,129,110": 15, "16,174,166": 16, "19,225,190": 17, "40,80,158": 18, "64,147,228": 19, "96,247,242": 20, "107,80,246": 21, "153,177,251": 22, "120,12,153": 23, "170,56,185": 24, "224,159,249": 25, "203,0,122": 26, "236,31,128": 27, "243,141,169": 28, "104,70,52": 29, "149,104,42": 30, "248,178,119": 31 };
const premium_colors = { "170,170,170": 32, "165,14,30": 33, "250,128,114": 34, "228,92,26": 35, "214,181,148": 36, "156,132,49": 37, "197,173,49": 38, "232,212,95": 39, "74,107,58": 40, "90,148,74": 41, "132,197,115": 42, "15,121,159": 43, "187,250,242": 44, "125,199,255": 45, "77,49,184": 46, "74,66,132": 47, "122,113,196": 48, "181,174,241": 49, "219,164,99": 50, "209,128,81": 51, "255,197,165": 52, "155,82,73": 53, "209,128,120": 54, "250,182,164": 55, "123,99,82": 56, "156,132,107": 57, "51,57,65": 58, "109,117,141": 59, "179,185,209": 60, "109,100,63": 61, "148,140,107": 62, "205,197,158": 63 };
const pallete = { ...basic_colors, ...premium_colors };
const colorBitmapShift = Object.keys(basic_colors).length + 1;

let loadedProxies = [];
const loadProxies = () => {
  const proxyPath = path.join(dataDir, "proxies.txt");
  if (!existsSync(proxyPath)) {
    writeFileSync(proxyPath, "");
    console.log("[SYSTEM] `data/proxies.txt` not found, created an empty one.");
    loadedProxies = [];
    return;
  }
  const lines = readFileSync(proxyPath, "utf8").split("\n").filter(line => line.trim() !== "");
  const proxies = [];
  const proxyRegex = /^(http|https|socks4|socks5):\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/;
  for (const line of lines) {
    const match = line.trim().match(proxyRegex);
    if (match) {
      proxies.push({
        protocol: match[1],
        username: match[2] || "",
        password: match[3] || "",
        host: match[4],
        port: parseInt(match[5], 10)
      });
    } else {
      console.log(`[SYSTEM] WARNING: Invalid proxy format skipped: "${line}"`);
    }
  }
  loadedProxies = proxies;
};

let nextProxyIndex = 0;
const getNextProxy = () => {
  const { proxyEnabled, proxyRotationMode } = currentSettings || {};
  if (!proxyEnabled || loadedProxies.length === 0) return null;
  let proxy;
  if (proxyRotationMode === "random") {
    const randomIndex = Math.floor(Math.random() * loadedProxies.length);
    proxy = loadedProxies[randomIndex];
  } else {
    proxy = loadedProxies[nextProxyIndex];
    nextProxyIndex = (nextProxyIndex + 1) % loadedProxies.length;
  }
  let proxyUrl = `${proxy.protocol}://`;
  if (proxy.username && proxy.password) {
    proxyUrl += `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@`;
  }
  proxyUrl += `${proxy.host}:${proxy.port}`;
  return proxyUrl;
};


// --- Suspension error (kept from new version) ---
class SuspensionError extends Error {
  constructor(message, durationMs) {
    super(message);
    this.name = "SuspensionError";
    this.durationMs = durationMs;
    this.suspendedUntil = Date.now() + durationMs;
  }
}

// --- WPlacer with old painting modes ported over ---
class WPlacer {
  constructor(template, coords, settings, templateName, paintTransparentPixels = false, initialBurstSeeds = null) {
    this.template = template;
    this.templateName = templateName;
    this.coords = coords;
    this.settings = settings;
    this.paintTransparentPixels = !!paintTransparentPixels;

    this.cookies = null;
    this.browser = null;
    this.userInfo = null;
    this.tiles = new Map();
    this.token = null;

    // burst seeds persistence
    this._burstSeeds = Array.isArray(initialBurstSeeds) ? initialBurstSeeds.map(s => ({ gx: s.gx, gy: s.gy })) : null;
    this._activeBurstSeedIdx = null;
  }

  async login(cookies) {
    this.cookies = cookies;
    const jar = new CookieJar();
    for (const cookie of Object.keys(this.cookies)) {
      const value = `${cookie}=${this.cookies[cookie]}; Path=/`;
      jar.setCookieSync(value, "https://backend.wplace.live");
      jar.setCookieSync(value, "https://wplace.live");
    }
    const impitOptions = { cookieJar: jar, browser: "chrome", ignoreTlsErrors: true };
    const proxyUrl = getNextProxy();
    if (proxyUrl) {
      impitOptions.proxyUrl = proxyUrl;
      if (currentSettings.logProxyUsage) {
        log("SYSTEM", "wplacer", `Using proxy: ${proxyUrl.split("@").pop()}`);
      }
    }
    this.browser = new Impit(impitOptions);
    await this.loadUserInfo();
    return this.userInfo;
  }

  async loadUserInfo() {
    const url = "https://backend.wplace.live/me";
    const me = await this.browser.fetch(url, {
      headers: {
        "Accept": "application/json, text/plain, */*",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://wplace.live/"
      },
      redirect: "manual"
    });
    const status = me.status;
    const contentType = (me.headers.get("content-type") || "").toLowerCase();
    const bodyText = await me.text();
    if (status === 401 || status === 403) {
      throw new Error(`(401/403) Unauthorized: cookies are invalid or expired.`);
    }
    if (status === 429) {
      throw new Error("(1015) You are being rate-limited. Please wait a moment and try again.");
    }
    if (status === 502) {
      throw new Error(`(502) Bad Gateway: The server is temporarily unavailable. Please try again later.`);
    }
    if (status >= 300 && status < 400) {
      throw new Error(`(3xx) Redirected (likely to login). Cookies are invalid or expired.`);
    }
    if (contentType.includes("application/json")) {
      let userInfo;
      try {
        userInfo = JSON.parse(bodyText);
      } catch {
        throw new Error(`Failed to parse JSON from /me (status ${status}).`);
      }
      if (userInfo?.error) {
        throw new Error(`(500) Failed to authenticate: "${userInfo.error}". The cookie is likely invalid or expired.`);
      }
      if (userInfo?.id && userInfo?.name) {
        this.userInfo = userInfo;
        return true;
      }
      throw new Error(`Unexpected JSON from /me (status ${status}): ${JSON.stringify(userInfo).slice(0, 200)}...`);
    }
    const short = bodyText.substring(0, 200);
    if (/error\s*1015/i.test(bodyText) || /rate.?limit/i.test(bodyText)) {
      throw new Error("(1015) You are being rate-limited by the server. Please wait a moment and try again.");
    }
    if (/cloudflare|attention required|access denied/i.test(bodyText)) {
      throw new Error(`Cloudflare blocked the request (status ${status}). Consider proxy/rotate IP.`);
    }
    if (/<!doctype html>/i.test(bodyText) || /<html/i.test(bodyText)) {
      throw new Error(`Failed to parse server response (HTML, status ${status}). Likely a login page → cookies invalid or expired. Snippet: "${short}..."`);
    }
    throw new Error(`Failed to parse server response (status ${status}). Response: "${short}..."`);
  }

  async post(url, body) {
    const request = await this.browser.fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "text/plain;charset=UTF-8",
        Referer: "https://wplace.live/"
      },
      body: JSON.stringify(body),
      redirect: "manual"
    });
    const status = request.status;
    const contentType = (request.headers.get("content-type") || "").toLowerCase();
    const text = await request.text();
    if (!contentType.includes("application/json")) {
      const short = text.substring(0, 200);
      if (/error\s*1015/i.test(text) || /rate.?limit/i.test(text) || status === 429) {
        throw new Error("(1015) You are being rate-limited. Please wait a moment and try again.");
      }
      if (status === 502) {
        throw new Error(`(502) Bad Gateway: The server is temporarily unavailable. Please try again later.`);
      }
      if (status === 401 || status === 403) {
        return { status, data: { error: "Unauthorized" } };
      }
      return { status, data: { error: `Non-JSON response (status ${status}): ${short}...` } };
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { status, data: { error: `Invalid JSON (status ${status}).` } };
    }
    return { status, data };
  }

  async loadTiles() {
    this.tiles.clear();
    const [tx, ty, px, py] = this.coords;
    const endPx = px + this.template.width;
    const endPy = py + this.template.height;
    const endTx = tx + Math.floor(endPx / 1000);
    const endTy = ty + Math.floor(endPy / 1000);

    const promises = [];
    for (let currentTx = tx; currentTx <= endTx; currentTx++) {
      for (let currentTy = ty; currentTy <= endTy; currentTy++) {
        const promise = new Promise((resolve) => {
          const image = new Image();
          image.crossOrigin = "Anonymous";
          image.onload = () => {
            const canvas = createCanvas(image.width, image.height);
            const ctx = canvas.getContext("2d");
            ctx.drawImage(image, 0, 0);
            const tileData = { width: canvas.width, height: canvas.height, data: Array.from({ length: canvas.width }, () => []) };
            const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
            for (let x = 0; x < canvas.width; x++) {
              for (let y = 0; y < canvas.height; y++) {
                const i = (y * canvas.width + x) * 4;
                const [r, g, b, a] = [d.data[i], d.data[i + 1], d.data[i + 2], d.data[i + 3]];
                tileData.data[x][y] = a === 255 ? (pallete[`${r},${g},${b}`] || 0) : 0;
              }
            }
            resolve(tileData);
          };
          image.onerror = () => resolve(null);
          image.src = `https://backend.wplace.live/files/s0/tiles/${currentTx}/${currentTy}.png?t=${Date.now()}`;
        }).then((tileData) => {
          if (tileData) this.tiles.set(`${currentTx}_${currentTy}`, tileData);
        });
        promises.push(promise);
      }
    }
    await Promise.all(promises);
    return true;
  }

  hasColor(id) {
    if (id < colorBitmapShift) return true; // transparent + basic colors
    return !!(this.userInfo.extraColorsBitmap & (1 << (id - colorBitmapShift)));
  }

  async _executePaint(tx, ty, body) {
    if (body.colors.length === 0) return { painted: 0, success: true };
    const response = await this.post(`https://backend.wplace.live/s0/pixel/${tx}/${ty}`, body);

    if (response.data.painted && response.data.painted === body.colors.length) {
      log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] 🎨 Painted ${body.colors.length} pixels on tile ${tx}, ${ty}.`);
      return { painted: body.colors.length, success: true };
    } else if (response.status === 403 && (response.data.error === "refresh" || response.data.error === "Unauthorized")) {
      // token needs refresh; let TemplateManager handle it
      return { painted: 0, success: false, reason: "refresh" };
    } else if (response.status === 451 && response.data.suspension) {
      throw new SuspensionError(`Account is suspended.`, response.data.durationMs || 0);
    } else if (response.status === 500) {
      log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] ⏱️ Server error (500). Waiting 40s before retrying...`);
      await sleep(40000);
      return { painted: 0, success: false, reason: "ratelimit" };
    } else if (response.status === 429 || (response.data.error && response.data.error.includes("Error 1015"))) {
      throw new Error("(1015) You are being rate-limited. Please wait a moment and try again.");
    }
    throw new Error(`Unexpected response for tile ${tx},${ty}: ${JSON.stringify(response)}`);
  }

  // ----- Helpers for "old" painting logic -----
  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  _globalXY(p) {
    const [sx, sy] = this.coords;
    return { gx: (p.tx - sx) * 1000 + p.px, gy: (p.ty - sy) * 1000 + p.py };
  }
  _templateRelXY(p) {
    const [sx, sy, spx, spy] = this.coords;
    const gx = (p.tx - sx) * 1000 + p.px;
    const gy = (p.ty - sy) * 1000 + p.py;
    return { x: gx - spx, y: gy - spy };
  }

  _pickBurstSeeds(pixels, k = 2, topFuzz = 5) {
    if (!pixels?.length) return [];
    const pts = pixels.map((p) => this._globalXY(p));

    const seeds = [];
    const i0 = Math.floor(Math.random() * pts.length);
    seeds.push(pts[i0]);
    if (pts.length === 1) return seeds.map((s) => ({ gx: s.gx, gy: s.gy }));

    let far = 0, best = -1;
    for (let i = 0; i < pts.length; i++) {
      const dx = pts[i].gx - pts[i0].gx,
        dy = pts[i].gy - pts[i0].gy;
      const d2 = dx * dx + dy * dy;
      if (d2 > best) {
        best = d2;
        far = i;
      }
    }
    seeds.push(pts[far]);

    while (seeds.length < Math.min(k, pts.length)) {
      const ranked = pts
        .map((p, i) => ({
          i,
          d2: Math.min(...seeds.map((s) => (s.gx - p.gx) ** 2 + (s.gy - p.gy) ** 2))
        }))
        .sort((a, b) => b.d2 - a.d2);
      const pickFrom = Math.min(topFuzz, ranked.length);
      const chosen = ranked[Math.floor(Math.random() * pickFrom)].i;
      const cand = pts[chosen];
      if (!seeds.some((s) => s.gx === cand.gx && s.gy === cand.gy)) seeds.push(cand);
      else break;
    }

    return seeds.map((s) => ({ gx: s.gx, gy: s.gy }));
  }

  /**
   * Multi-source BFS ordering like in the old version.
   * seeds can be number (count) or array of {gx,gy}.
   */
  _orderByBurst(mismatchedPixels, seeds = 2) {
    if (mismatchedPixels.length <= 2) return mismatchedPixels;

    const [startX, startY] = this.coords;
    const byKey = new Map();
    for (const p of mismatchedPixels) {
      const gx = (p.tx - startX) * 1000 + p.px;
      const gy = (p.ty - startY) * 1000 + p.py;
      p._gx = gx;
      p._gy = gy;
      byKey.set(`${gx},${gy}`, p);
    }

    const useSeeds = Array.isArray(seeds) ? seeds.slice() : this._pickBurstSeeds(mismatchedPixels, seeds);

    // mark used for nearest search
    const used = new Set();
    const nearest = (gx, gy) => {
      let best = null,
        bestD = Infinity,
        key = null;
      for (const p of mismatchedPixels) {
        const k = `${p._gx},${p._gy}`;
        if (used.has(k)) continue;
        const dx = p._gx - gx,
          dy = p._gy - gy;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD) {
          bestD = d2;
          best = p;
          key = k;
        }
      }
      if (best) used.add(key);
      return best;
    };

    const starts = useSeeds.map((s) => nearest(s.gx, s.gy)).filter(Boolean);

    const visited = new Set();
    const queues = [];
    const speeds = [];
    const prefs = [];

    const randDir = () => [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];

    for (const sp of starts) {
      const k = `${sp._gx},${sp._gy}`;
      if (!visited.has(k)) {
        visited.add(k);
        queues.push([sp]);
        speeds.push(0.7 + Math.random() * 1.1);
        prefs.push(randDir());
      }
    }

    const pickQueue = () => {
      const weights = speeds.map((s, i) => (queues[i].length ? s : 0));
      const sum = weights.reduce((a, b) => a + b, 0);
      if (!sum) return -1;
      let r = Math.random() * sum;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) return i;
      }
      return weights.findIndex((w) => w > 0);
    };

    const orderNeighbors = (dir) => {
      const base = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      base.sort(
        (a, b) =>
          b[0] * dir[0] +
          b[1] * dir[1] +
          (Math.random() - 0.5) * 0.2 -
          (a[0] * dir[0] + a[1] * dir[1] + (Math.random() - 0.5) * 0.2)
      );
      return base;
    };

    const dash = (from, qi, dir) => {
      const dashChance = 0.45;
      const maxDash = 1 + Math.floor(Math.random() * 3);
      if (Math.random() > dashChance) return;
      let cx = from._gx,
        cy = from._gy;
      for (let step = 0; step < maxDash; step++) {
        const nx = cx + dir[0],
          ny = cy + dir[1];
        const key = `${nx},${ny}`;
        if (!byKey.has(key) || visited.has(key)) break;
        visited.add(key);
        queues[qi].push(byKey.get(key));
        cx = nx;
        cy = ny;
      }
    };

    const out = [];

    while (true) {
      const qi = pickQueue();
      if (qi === -1) break;
      const cur = queues[qi].shift();
      out.push(cur);

      const neigh = orderNeighbors(prefs[qi]);
      let firstDir = null;
      let firstPt = null;

      for (const [dx, dy] of neigh) {
        const nx = cur._gx + dx,
          ny = cur._gy + dy;
        const k = `${nx},${ny}`;
        if (byKey.has(k) && !visited.has(k)) {
          visited.add(k);
          const p = byKey.get(k);
          queues[qi].push(p);
          if (!firstDir) {
            firstDir = [dx, dy];
            firstPt = p;
          }
        }
      }

      if (firstDir) {
        if (Math.random() < 0.85) prefs[qi] = firstDir;
        dash(firstPt, qi, prefs[qi]);
      }
    }

    // pick up isolated areas
    if (out.length < mismatchedPixels.length) {
      for (const p of mismatchedPixels) {
        const k = `${p._gx},${p._gy}`;
        if (!visited.has(k)) {
          visited.add(k);
          const q = [p];
          while (q.length) {
            const c = q.shift();
            out.push(c);
            for (const [dx, dy] of orderNeighbors(randDir())) {
              const nx = c._gx + dx,
                ny = c._gy + dy;
              const kk = `${nx},${ny}`;
              if (byKey.has(kk) && !visited.has(kk)) {
                visited.add(kk);
                q.push(byKey.get(kk));
              }
            }
          }
        }
      }
    }

    // cleanup temp props
    for (const p of out) {
      delete p._gx;
      delete p._gy;
    }
    return out;
  }

  _getMismatchedPixels() {
    const [startX, startY, startPx, startPy] = this.coords;
    const mismatched = [];
    for (let y = 0; y < this.template.height; y++) {
      for (let x = 0; x < this.template.width; x++) {
        const templateColor = this.template.data[x][y];

        // old behavior: 0 means "transparent pixel" in the template.
        // If paintTransparentPixels is false — we skip those; if true — we try to paint them too.
        if (templateColor === 0 && !this.paintTransparentPixels) continue;
        if (templateColor == null) continue;

        const globalPx = startPx + x;
        const globalPy = startPy + y;
        const targetTx = startX + Math.floor(globalPx / 1000);
        const targetTy = startY + Math.floor(globalPy / 1000);
        const localPx = globalPx % 1000;
        const localPy = globalPy % 1000;

        const tile = this.tiles.get(`${targetTx}_${targetTy}`);
        if (!tile || !tile.data[localPx]) continue;

        const tileColor = tile.data[localPx][localPy];

        if (templateColor !== tileColor && this.hasColor(templateColor)) {
          mismatched.push({ tx: targetTx, ty: targetTy, px: localPx, py: localPy, color: templateColor });
        }
      }
    }
    return mismatched;
  }

  /**
   * Paint using "old" modes.
   * method is read from settings.drawingMethod in TemplateManager.
   */
  async paint(method = "linear") {
    await this.loadUserInfo();

    switch (method) {
      case "linear":
        log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] 🎨 Painting (Top to Bottom)...`);
        break;
      case "linear-reversed":
        log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] 🎨 Painting (Bottom to Top)...`);
        break;
      case "linear-ltr":
        log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] 🎨 Painting (Left to Right)...`);
        break;
      case "linear-rtl":
        log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] 🎨 Painting (Right to Left)...`);
        break;
      case "radial-inward":
        log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] 🎯 Painting (Radial inward)...`);
        break;
      case "singleColorRandom":
        log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] 🎨 Painting (Random Color)...`);
        break;
      case "colorByColor":
        log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] 🎨 Painting (Color by Color)...`);
        break;
      case "colors-burst-rare":
        log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] 💥 Painting (Colors burst, rare first)...`);
        break;
      case "random":
        log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] 🎲 Painting (Random Scatter)...`);
        break;
      case "burst":
        log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] 💥 Painting (Burst / Multi-source)...`);
        break;
      case "outline-then-burst":
        log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] 🧱 Painting (Outline then Burst)...`);
        break;
      case "burst-mixed":
        log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] 🔀 Painting (Burst Mixed: burst/outline/rare)...`);
        break;
      default:
        throw new Error(`Unknown paint method: ${method}`);
    }

    while (true) {
      await this.loadTiles();
      if (!this.token) throw new Error("REFRESH_TOKEN"); // TokenManager must provide before calling

      let mismatchedPixels = this._getMismatchedPixels();
      if (mismatchedPixels.length === 0) return 0;

      log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] Found ${mismatchedPixels.length} mismatched pixels.`);

      let activeMethod = method;
      if (method === "burst-mixed") {
        const pool = ["outline-then-burst", "burst", "colors-burst-rare"];
        activeMethod = pool[Math.floor(Math.random() * pool.length)];
        log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] 🎲 Mixed mode picked this turn: ${activeMethod}`);
      }

      switch (activeMethod) {
        case "linear-reversed":
          mismatchedPixels.reverse();
          break;

        case "linear-ltr": {
          const [startX, startY] = this.coords;
          mismatchedPixels.sort((a, b) => {
            const aGlobalX = (a.tx - startX) * 1000 + a.px;
            const bGlobalX = (b.tx - startX) * 1000 + b.px;
            if (aGlobalX !== bGlobalX) return aGlobalX - bGlobalX;
            return (a.ty - startY) * 1000 + a.py - ((b.ty - startY) * 1000 + b.py);
          });
          break;
        }

        case "linear-rtl": {
          const [startX, startY] = this.coords;
          mismatchedPixels.sort((a, b) => {
            const aGlobalX = (a.tx - startX) * 1000 + a.px;
            const bGlobalX = (b.tx - startX) * 1000 + b.px;
            if (aGlobalX !== bGlobalX) return bGlobalX - aGlobalX;
            return (a.ty - startY) * 1000 + a.py - ((b.ty - startY) * 1000 + b.py);
          });
          break;
        }

        case "radial-inward": {
          const [sx, sy, spx, spy] = this.coords;
          const cx = spx + (this.template.width - 1) / 2;
          const cy = spy + (this.template.height - 1) / 2;
          const r2 = (p) => {
            const gx = (p.tx - sx) * 1000 + p.px;
            const gy = (p.ty - sy) * 1000 + p.py;
            const dx = gx - cx, dy = gy - cy;
            return dx * dx + dy * dy;
          };
          const ang = (p) => {
            const gx = (p.tx - sx) * 1000 + p.px;
            const gy = (p.ty - sy) * 1000 + p.py;
            return Math.atan2(gy - cy, gx - cx);
          };
          mismatchedPixels.sort((a, b) => {
            const d = r2(b) - r2(a);
            return d !== 0 ? d : (ang(a) - ang(b));
          });
          break;
        }

        case "singleColorRandom":
        case "colorByColor": {
          const pixelsByColor = mismatchedPixels.reduce((acc, p) => {
            if (!acc[p.color]) acc[p.color] = [];
            acc[p.color].push(p);
            return acc;
          }, {});
          const colors = Object.keys(pixelsByColor);
          if (method === "singleColorRandom") {
            for (let i = colors.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [colors[i], colors[j]] = [colors[j], colors[i]];
            }
          }
          mismatchedPixels = colors.flatMap((color) => pixelsByColor[color]);
          break;
        }

        case "colors-burst-rare": {
          const byColor = mismatchedPixels.reduce((m, p) => {
            (m[p.color] ||= []).push(p);
            return m;
          }, {});
          const colorsAsc = Object.keys(byColor).sort((a, b) => byColor[a].length - byColor[b].length);
          const desired = Math.max(1, Math.min(this.settings?.seedCount ?? 2, 16));
          const out = [];
          for (const c of colorsAsc) {
            out.push(...this._orderByBurst(byColor[c], desired));
          }
          mismatchedPixels = out;
          break;
        }

        case "random":
          this._shuffle(mismatchedPixels);
          break;

        case "burst": {
          const desired = Math.max(1, Math.min(this.settings?.seedCount ?? 2, 16));
          if (!this._burstSeeds || this._burstSeeds.length !== desired) {
            this._burstSeeds = this._pickBurstSeeds(mismatchedPixels, desired);
            log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] 💥 Burst seeds (${desired}): ${JSON.stringify(this._burstSeeds)}`);
          }
          if (this._activeBurstSeedIdx == null || this._activeBurstSeedIdx >= this._burstSeeds.length) {
            this._activeBurstSeedIdx = Math.floor(Math.random() * this._burstSeeds.length);
            const s = this._burstSeeds[this._activeBurstSeedIdx];
            log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] 🎯 Using single seed this turn: ${JSON.stringify(s)} (#${this._activeBurstSeedIdx + 1}/${this._burstSeeds.length})`);
          }
          const seedForThisTurn = [this._burstSeeds[this._activeBurstSeedIdx]];
          mismatchedPixels = this._orderByBurst(mismatchedPixels, seedForThisTurn);
          break;
        }

        case "outline-then-burst": {
          const desired = Math.max(1, Math.min(this.settings?.seedCount ?? 2, 16));
          const outline = [];
          const inside = [];

          for (const p of mismatchedPixels) {
            if (p.color === 0) { inside.push(p); continue; }
            const { x, y } = this._templateRelXY(p);
            const w = this.template.width, h = this.template.height;
            const tcol = this.template.data[x][y];

            let isOutline = (x === 0 || y === 0 || x === w - 1 || y === h - 1);
            if (!isOutline) {
              const neigh = [[1, 0], [-1, 0], [0, 1], [0, -1]];
              for (const [dx, dy] of neigh) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) { isOutline = true; break; }
                if (this.template.data[nx][ny] !== tcol) { isOutline = true; break; }
              }
            }
            (isOutline ? outline : inside).push(p);
          }

          const pickRandomSeed = (arr) => {
            const p = arr[Math.floor(Math.random() * arr.length)];
            const { gx, gy } = this._globalXY(p);
            return [{ gx, gy }];
          };

          const orderedOutline = outline.length ? this._orderByBurst(outline, desired) : [];
          const orderedInside = inside.length ? this._orderByBurst(inside, pickRandomSeed(inside)) : [];

          mismatchedPixels = orderedOutline.concat(orderedInside);
          break;
        }
      }

      const pixelsToPaint = mismatchedPixels.slice(0, Math.floor(this.userInfo.charges.count));
      const bodiesByTile = pixelsToPaint.reduce((acc, p) => {
        const key = `${p.tx},${p.ty}`;
        if (!acc[key]) acc[key] = { colors: [], coords: [] };
        acc[key].colors.push(p.color);
        acc[key].coords.push(p.px, p.py);
        return acc;
      }, {});

      let totalPainted = 0;
      let needsRetry = false;

      for (const tileKey in bodiesByTile) {
        const [tx, ty] = tileKey.split(",").map(Number);
        const body = { ...bodiesByTile[tileKey], t: this.token };
        const result = await this._executePaint(tx, ty, body);
        if (result.success) {
          totalPainted += result.painted;
        } else {
          // token refresh or temp error — let caller handle
          needsRetry = true;
          break;
        }
      }

      if (!needsRetry) {
        this._activeBurstSeedIdx = null; // next turn: pick a new seed
        return totalPainted;
      } else {
        // break and let manager refresh token
        throw new Error("REFRESH_TOKEN");
      }
    }
  }

  async buyProduct(productId, amount) {
    const response = await this.post(`https://backend.wplace.live/purchase`, { product: { id: productId, amount } });
    if (response.data.success) {
      let msg = `🛒 Purchase successful for product #${productId} (amount: ${amount})`;
      if (productId === 80) msg = `🛒 Bought ${amount * 30} pixels for ${amount * 500} droplets`;
      else if (productId === 70) msg = `🛒 Bought ${amount} Max Charge Upgrade(s) for ${amount * 500} droplets`;
      log(this.userInfo.id, this.userInfo.name, `[${this.templateName}] ${msg}`);
      return true;
    }
    if (response.status === 429 || (response.data.error && response.data.error.includes("Error 1015"))) {
      throw new Error("(1015) You are being rate-limited while trying to make a purchase. Please wait.");
    }
    throw new Error(`Unexpected response during purchase: ${JSON.stringify(response)}`);
  }

  async pixelsLeft() {
    await this.loadTiles();
    return this._getMismatchedPixels().length;
  }
}

// --- Data persistence ---
const loadJSON = (filename) =>
  existsSync(path.join(dataDir, filename)) ? JSON.parse(readFileSync(path.join(dataDir, filename), "utf8")) : {};
const saveJSON = (filename, data) => writeFileSync(path.join(dataDir, filename), JSON.stringify(data, null, 4));

const users = loadJSON("users.json");
const saveUsers = () => saveJSON("users.json", users);

// Active TemplateManagers (in-memory)
const templates = {};
const saveTemplates = () => {
  const templatesToSave = {};
  for (const id in templates) {
    const t = templates[id];
    templatesToSave[id] = {
      name: t.name,
      template: t.template,
      coords: t.coords,
      canBuyCharges: t.canBuyCharges,
      canBuyMaxCharges: t.canBuyMaxCharges,
      antiGriefMode: t.antiGriefMode,
      userIds: t.userIds,
      paintTransparentPixels: t.paintTransparentPixels,
      burstSeeds: t.burstSeeds || null
    };
  }
  saveJSON("templates.json", templatesToSave);
};

// --- Settings ---
// IMPORTANT: removed drawingDirection / drawingOrder / outlineMode / interleavedMode / skipPaintedPixels
// Only keep drawingMethod and seedCount (like old version), plus other timings.
let currentSettings = {
  turnstileNotifications: false,
  accountCooldown: 20000,
  purchaseCooldown: 5000,
  keepAliveCooldown: 5000,
  dropletReserve: 0,
  antiGriefStandby: 600000,
  drawingMethod: "linear", // ← single switch for paint modes
  chargeThreshold: 0.5,
  seedCount: 2,
  proxyEnabled: false,
  proxyRotationMode: "sequential",
  logProxyUsage: false
};
if (existsSync(path.join(dataDir, "settings.json"))) {
  currentSettings = { ...currentSettings, ...loadJSON("settings.json") };
}
const saveSettings = () => saveJSON("settings.json", currentSettings);

// --- Server state ---
const activeBrowserUsers = new Set();

const longWaiters = new Set();
const notifyTokenNeeded = () => {
  for (const fn of Array.from(longWaiters)) {
    try { fn(); } catch { }
  }
  longWaiters.clear();
};

const TokenManager = {
  tokenQueue: [],
  tokenPromise: null,
  resolvePromise: null,
  isTokenNeeded: false,

  getToken() {
    if (this.tokenQueue.length > 0) {
      return Promise.resolve(this.tokenQueue[0]);
    }
    if (!this.tokenPromise) {
      log("SYSTEM", "wplacer", "TOKEN_MANAGER: A task is waiting for a token. Flagging for clients.");
      this.isTokenNeeded = true;
      notifyTokenNeeded();
      this.tokenPromise = new Promise((resolve) => {
        this.resolvePromise = resolve;
      });
    }
    return this.tokenPromise;
  },
  setToken(t) {
    log("SYSTEM", "wplacer", `✅ TOKEN_MANAGER: Token received. Queue size: ${this.tokenQueue.length + 1}`);
    this.isTokenNeeded = false;
    this.tokenQueue.push(t);
    if (this.resolvePromise) {
      this.resolvePromise(this.tokenQueue[0]);
      this.tokenPromise = null;
      this.resolvePromise = null;
    }
  },
  invalidateToken() {
    this.tokenQueue.shift();
    log("SYSTEM", "wplacer", `🔄 TOKEN_MANAGER: Invalidating token. ${this.tokenQueue.length} tokens remaining.`);
  }
};

// --- Error logging wrapper ---
function logUserError(error, id, name, context) {
  const message = error?.message || "An unknown error occurred.";
  if (message.includes("(500)") || message.includes("(1015)") || message.includes("(502)") || error?.name === "SuspensionError") {
    log(id, name, `❌ Failed to ${context}: ${message}`);
  } else {
    log(id, name, `❌ Failed to ${context}`, error);
  }
}

// --- Template Manager ---
class TemplateManager {
  constructor(name, templateData, coords, canBuyCharges, canBuyMaxCharges, antiGriefMode, userIds, paintTransparentPixels = false) {
    this.name = name;
    this.template = templateData;
    this.coords = coords;
    this.canBuyCharges = !!canBuyCharges;
    this.canBuyMaxCharges = !!canBuyMaxCharges;
    this.antiGriefMode = !!antiGriefMode;
    this.userIds = userIds;

    this.paintTransparentPixels = !!paintTransparentPixels; // NEW: per-template flag like old version
    this.burstSeeds = null; // persist across runs

    this.running = false;
    this.status = "Waiting to be started.";
    this.masterId = this.userIds[0];
    this.masterName = users[this.masterId]?.name || "Unknown";

    // visible counters (optional)
    this.totalPixels = this.template?.data ? this.template.data.flat().filter((p) => (this.paintTransparentPixels ? p >= 0 : p > 0)).length : 0;
    this.pixelsRemaining = this.totalPixels;
  }

  async handleUpgrades(wplacer) {
    if (!this.canBuyMaxCharges) return;
    await wplacer.loadUserInfo();
    const affordableDroplets = wplacer.userInfo.droplets - currentSettings.dropletReserve;
    const amountToBuy = Math.floor(affordableDroplets / 500);
    if (amountToBuy > 0) {
      log(wplacer.userInfo.id, wplacer.userInfo.name, `💰 Attempting to buy ${amountToBuy} max charge upgrade(s).`);
      try {
        await wplacer.buyProduct(70, amountToBuy);
        await sleep(currentSettings.purchaseCooldown);
        await wplacer.loadUserInfo();
      } catch (error) {
        logUserError(error, wplacer.userInfo.id, wplacer.userInfo.name, "purchase max charge upgrades");
      }
    }
  }

  async _performPaintTurn(wplacer) {
    while (this.running) {
      try {
        wplacer.token = await TokenManager.getToken();
        const painted = await wplacer.paint(currentSettings.drawingMethod);
        // save back burst seeds if used
        this.burstSeeds = wplacer._burstSeeds ? wplacer._burstSeeds.map((s) => ({ gx: s.gx, gy: s.gy })) : null;
        saveTemplates();
        return painted;
      } catch (error) {
        if (error.name === "SuspensionError") {
          const suspendedUntilDate = new Date(error.suspendedUntil).toLocaleString();
          log(wplacer.userInfo.id, wplacer.userInfo.name, `[${this.name}] 🛑 Account suspended until ${suspendedUntilDate}.`);
          users[wplacer.userInfo.id].suspendedUntil = error.suspendedUntil;
          saveUsers();
          return; // end this user's turn
        }
        if (error.message === "REFRESH_TOKEN") {
          log(wplacer.userInfo.id, wplacer.userInfo.name, `[${this.name}] 🔄 Token expired/invalid. Trying next token...`);
          TokenManager.invalidateToken();
          await sleep(1000);
          continue;
        }
        throw error;
      }
    }
  }

  async start() {
    this.running = true;
    this.status = "Started.";
    log("SYSTEM", "wplacer", `▶️ Starting template "${this.name}"...`);

    try {
      while (this.running) {
        // Check remaining pixels using the master account
        const checkWplacer = new WPlacer(this.template, this.coords, currentSettings, this.name, this.paintTransparentPixels, this.burstSeeds);
        try {
          await checkWplacer.login(users[this.masterId].cookies);
          this.pixelsRemaining = await checkWplacer.pixelsLeft();
        } catch (error) {
          logUserError(error, this.masterId, this.masterName, "check pixels left");
          await sleep(60000);
          continue;
        }

        if (this.pixelsRemaining === 0) {
          if (this.antiGriefMode) {
            this.status = "Monitoring for changes.";
            log("SYSTEM", "wplacer", `[${this.name}] 🖼 Template complete. Monitoring... Next check in ${currentSettings.antiGriefStandby / 60000} min.`);
            await sleep(currentSettings.antiGriefStandby);
            continue;
          } else {
            log("SYSTEM", "wplacer", `[${this.name}] 🖼 Template finished!`);
            this.status = "Finished.";
            this.running = false;
            break;
          }
        }

        // Collect user states
        const userStates = [];
        for (const userId of this.userIds) {
          const user = users[userId];
          if (!user) continue;
          if (user.suspendedUntil && Date.now() < user.suspendedUntil) continue;
          if (activeBrowserUsers.has(userId)) continue;

          activeBrowserUsers.add(userId);
          const wplacer = new WPlacer(this.template, this.coords, currentSettings, this.name, this.paintTransparentPixels, this.burstSeeds);
          try {
            await wplacer.login(user.cookies);
            userStates.push({ userId, charges: wplacer.userInfo.charges, cooldownMs: wplacer.userInfo.charges.cooldownMs });
          } catch (error) {
            logUserError(error, userId, users[userId].name, "check user status");
          } finally {
            activeBrowserUsers.delete(userId);
          }
        }

        // Choose a user to run: ready by threshold or with >0 charges
        const readyUsers = userStates.filter((u) => u.charges.count >= Math.max(1, u.charges.max * currentSettings.chargeThreshold));
        let userToRun = readyUsers.length > 0 ? readyUsers.sort((a, b) => b.charges.count - a.charges.count)[0] : null;
        if (!userToRun && userStates.length > 0) {
          const nonZero = userStates.filter((u) => u.charges.count > 0).sort((a, b) => b.charges.count - a.charges.count);
          if (nonZero.length) userToRun = nonZero[0];
        }

        if (userToRun) {
          const user = users[userToRun.userId];
          if (user?.suspendedUntil && Date.now() < user.suspendedUntil) {
            log("SYSTEM", "wplacer", `[${this.name}] Safeguard: skipped suspended user ${user.name}#${userToRun.userId}.`);
            await sleep(1000);
            continue;
          }

          if (activeBrowserUsers.has(userToRun.userId)) continue;
          activeBrowserUsers.add(userToRun.userId);
          const wplacer = new WPlacer(this.template, this.coords, currentSettings, this.name, this.paintTransparentPixels, this.burstSeeds);
          try {
            const { id, name } = await wplacer.login(users[userToRun.userId].cookies);
            this.status = `Running user ${name}#${id}`;
            log(id, name, `[${this.name}] 🔋 User has ${Math.floor(wplacer.userInfo.charges.count)} charges. Starting turn...`);
            await this._performPaintTurn(wplacer);
            // after successful turn, cache any new seeds
            this.burstSeeds = wplacer._burstSeeds ? wplacer._burstSeeds.map((s) => ({ gx: s.gx, gy: s.gy })) : this.burstSeeds;
            saveTemplates();
            await this.handleUpgrades(wplacer);
          } catch (error) {
            logUserError(error, userToRun.userId, users[userToRun.userId].name, "perform paint turn");
          } finally {
            activeBrowserUsers.delete(userToRun.userId);
          }

          if (this.running && this.userIds.length > 1) {
            await sleep(currentSettings.accountCooldown);
          }
        } else {
          // Buy charges if allowed
          if (this.canBuyCharges && !activeBrowserUsers.has(this.masterId)) {
            activeBrowserUsers.add(this.masterId);
            const chargeBuyer = new WPlacer(this.template, this.coords, currentSettings, this.name, this.paintTransparentPixels, this.burstSeeds);
            try {
              await chargeBuyer.login(users[this.masterId].cookies);
              const affordableDroplets = chargeBuyer.userInfo.droplets - currentSettings.dropletReserve;
              if (affordableDroplets >= 500) {
                const amountToBuy = Math.min(Math.ceil(this.pixelsRemaining / 30), Math.floor(affordableDroplets / 500));
                if (amountToBuy > 0) {
                  log(this.masterId, this.masterName, `[${this.name}] 💰 Attempting to buy pixel charges...`);
                  await chargeBuyer.buyProduct(80, amountToBuy);
                  await sleep(currentSettings.purchaseCooldown);
                  continue;
                }
              }
            } catch (error) {
              logUserError(error, this.masterId, this.masterName, "attempt to buy pixel charges");
            } finally {
              activeBrowserUsers.delete(this.masterId);
            }
          }

          const times = userStates.map((u) => Math.max(0, (Math.max(1, u.charges.max * currentSettings.chargeThreshold) - u.charges.count) * u.cooldownMs));
          const waitTime = (times.length ? Math.min(...times) : 60000) + 2000;
          this.status = `Waiting for charges.`;
          log("SYSTEM", "wplacer", `[${this.name}] ⏳ No users ready. Waiting for ${duration(waitTime)}.`);
          await sleep(waitTime);
        }
      }
    } finally {
      if (this.status !== "Finished.") {
        this.status = "Stopped.";
      }
    }
  }
}

// --- Express App ---
const app = express();
app.use(cors());
app.use(express.static("public"));
app.use(express.json({ limit: Infinity }));

// --- API: tokens ---
app.get("/token-needed/long", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  let done = false;
  const finish = (needed) => { if (done) return; done = true; res.end(JSON.stringify({ needed })); };
  const timer = setTimeout(() => finish(false), 60000);
  const fn = () => { clearTimeout(timer); finish(true); };
  longWaiters.add(fn);
  req.on("close", () => { longWaiters.delete(fn); clearTimeout(timer); });
  if (TokenManager.isTokenNeeded) fn();
});
app.get("/token-needed", (req, res) => {
  res.json({ needed: TokenManager.isTokenNeeded });
});
app.post("/t", (req, res) => {
  const { t } = req.body;
  if (!t) return res.sendStatus(400);
  TokenManager.setToken(t);
  res.sendStatus(200);
});

// --- API: users ---
const getJwtExp = (j) => {
  try {
    const p = j.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
    return typeof json.exp === 'number' ? json.exp : null;
  } catch {
    return null;
  }
};


app.get("/users", (_, res) => {
  const out = JSON.parse(JSON.stringify(users));
  for (const id of Object.keys(out)) {
    if (!out[id].expirationDate && out[id].cookies?.j) {
      const exp = getJwtExp(out[id].cookies.j);
      if (exp) out[id].expirationDate = exp;
    }
  }
  res.json(out);
});


app.post("/user", async (req, res) => {
  if (!req.body.cookies || !req.body.cookies.j) return res.sendStatus(400);
  const wplacer = new WPlacer();
  try {
    const userInfo = await wplacer.login(req.body.cookies);
    const exp = getJwtExp(req.body.cookies.j);
    users[userInfo.id] = {
      name: userInfo.name,
      cookies: req.body.cookies,
      expirationDate: exp || users[userInfo.id]?.expirationDate || null
    };
    saveUsers();
    res.json(userInfo);
  } catch (error) {
    logUserError(error, "NEW_USER", "N/A", "add new user");
    res.status(500).json({ error: error.message });
  }
});

app.delete("/user/:id", async (req, res) => {
  const userIdToDelete = req.params.id;
  if (!userIdToDelete || !users[userIdToDelete]) return res.sendStatus(400);

  const deletedUserName = users[userIdToDelete].name;
  delete users[userIdToDelete];
  saveUsers();
  log("SYSTEM", "Users", `Deleted user ${deletedUserName}#${userIdToDelete}.`);

  let templatesModified = false;
  for (const templateId in templates) {
    const template = templates[templateId];
    const initialUserCount = template.userIds.length;
    template.userIds = template.userIds.filter((id) => id !== userIdToDelete);

    if (template.userIds.length < initialUserCount) {
      templatesModified = true;
      log("SYSTEM", "Templates", `Removed user ${deletedUserName}#${userIdToDelete} from template "${template.name}".`);
      if (template.masterId === userIdToDelete) {
        template.masterId = template.userIds[0] || null;
        template.masterName = template.masterId ? users[template.masterId].name : null;
      }
      if (template.userIds.length === 0 && template.running) {
        template.running = false;
        log("SYSTEM", "wplacer", `[${template.name}] 🛑 Template stopped because it has no users left.`);
      }
    }
  }
  if (templatesModified) saveTemplates();
  res.sendStatus(200);
});

app.get("/user/status/:id", async (req, res) => {
  const { id } = req.params;
  if (!users[id] || activeBrowserUsers.has(id)) return res.sendStatus(409);
  activeBrowserUsers.add(id);
  const wplacer = new WPlacer();
  try {
    const userInfo = await wplacer.login(users[id].cookies);
    res.status(200).json(userInfo);
  } catch (error) {
    logUserError(error, id, users[id].name, "validate cookie");
    res.status(500).json({ error: error.message });
  } finally {
    activeBrowserUsers.delete(id);
  }
});

app.post("/users/buy-max-upgrades", async (req, res) => {
  const report = [];
  const cooldown = currentSettings.purchaseCooldown || 5000;

  const dummyTemplate = { width: 0, height: 0, data: [] };
  const dummyCoords = [0, 0, 0, 0];

  const userIds = Object.keys(users);

  for (const userId of userIds) {
    const urec = users[userId];
    if (!urec) continue;

    if (activeBrowserUsers.has(userId)) {
      report.push({ userId, name: urec.name, skipped: true, reason: "busy" });
      continue;
    }

    activeBrowserUsers.add(userId);
    const wplacer = new WPlacer(dummyTemplate, dummyCoords, currentSettings, "AdminPurchase");

    try {
      await wplacer.login(urec.cookies);
      await wplacer.loadUserInfo();

      const beforeDroplets = wplacer.userInfo.droplets;
      const reserve = currentSettings.dropletReserve || 0;
      const affordable = Math.max(0, beforeDroplets - reserve);
      const amountToBuy = Math.floor(affordable / 500); // #70 = 500 droplets

      if (amountToBuy > 0) {
        await wplacer.buyProduct(70, amountToBuy);
        await sleep(cooldown);
        report.push({
          userId,
          name: wplacer.userInfo.name,
          amount: amountToBuy,
          beforeDroplets,
          afterDroplets: beforeDroplets - amountToBuy * 500
        });
      } else {
        report.push({
          userId,
          name: wplacer.userInfo.name,
          amount: 0,
          skipped: true,
          reason: "insufficient_droplets_or_reserve"
        });
      }
    } catch (error) {
      logUserError(error, userId, urec.name, "bulk buy max charge upgrades");
      report.push({ userId, name: urec.name, error: error?.message || String(error) });
    } finally {
      activeBrowserUsers.delete(userId);
    }
  }

  res.json({ ok: true, cooldownMs: cooldown, reserve: currentSettings.dropletReserve || 0, report });
});

// --- API: templates ---
app.get("/templates", (_, res) => {
  const sanitized = {};
  for (const id in templates) {
    const t = templates[id];
    sanitized[id] = {
      name: t.name,
      template: t.template,
      coords: t.coords,
      canBuyCharges: t.canBuyCharges,
      canBuyMaxCharges: t.canBuyMaxCharges,
      antiGriefMode: t.antiGriefMode,
      paintTransparentPixels: t.paintTransparentPixels,
      userIds: t.userIds,
      running: t.running,
      status: t.status,
      pixelsRemaining: t.pixelsRemaining,
      totalPixels: t.totalPixels
    };
  }
  res.json(sanitized);
});

app.post("/template", async (req, res) => {
  const { templateName, template, coords, userIds, canBuyCharges, canBuyMaxCharges, antiGriefMode, paintTransparentPixels } = req.body;
  if (!templateName || !template || !coords || !userIds || !userIds.length) return res.sendStatus(400);
  if (Object.values(templates).some((t) => t.name === templateName)) {
    return res.status(409).json({ error: "A template with this name already exists." });
  }
  const templateId = Date.now().toString();
  templates[templateId] = new TemplateManager(
    templateName,
    template,
    coords,
    canBuyCharges,
    canBuyMaxCharges,
    antiGriefMode,
    userIds,
    !!paintTransparentPixels
  );
  saveTemplates();
  res.status(200).json({ id: templateId });
});

app.delete("/template/:id", async (req, res) => {
  const { id } = req.params;
  if (!id || !templates[id] || templates[id].running) return res.sendStatus(400);
  delete templates[id];
  saveTemplates();
  res.sendStatus(200);
});

app.put("/template/edit/:id", async (req, res) => {
  const { id } = req.params;
  if (!templates[id]) return res.sendStatus(404);
  const manager = templates[id];

  const { templateName, coords, userIds, canBuyCharges, canBuyMaxCharges, antiGriefMode, template, paintTransparentPixels } = req.body;

  const prevCoords = manager.coords;
  const prevTemplateStr = JSON.stringify(manager.template);

  manager.name = templateName;
  manager.coords = coords;
  manager.userIds = userIds;
  manager.canBuyCharges = canBuyCharges;
  manager.canBuyMaxCharges = canBuyMaxCharges;
  manager.antiGriefMode = antiGriefMode;

  if (typeof paintTransparentPixels !== "undefined") {
    manager.paintTransparentPixels = !!paintTransparentPixels;
  }

  if (template) {
    manager.template = template;
  }

  manager.masterId = manager.userIds[0];
  manager.masterName = users[manager.masterId]?.name || "Unknown";

  // reset seeds if image or coords changed
  if (template || JSON.stringify(prevCoords) !== JSON.stringify(manager.coords)) {
    manager.burstSeeds = null;
  }

  // recompute totals
  manager.totalPixels = manager.template?.data
    ? manager.template.data.flat().filter((p) => (manager.paintTransparentPixels ? p >= 0 : p > 0)).length
    : 0;

  saveTemplates();
  res.sendStatus(200);
});

app.put("/template/:id", async (req, res) => {
  const { id } = req.params;
  if (!id || !templates[id]) return res.sendStatus(400);
  const manager = templates[id];
  if (req.body.running && !manager.running) {
    manager.start().catch((error) => log(id, manager.masterName, "Error starting template", error));
  } else {
    manager.running = false;
  }
  res.sendStatus(200);
});

// --- API: settings (now only drawingMethod + seedCount relevant from paint side) ---
app.get("/settings", (_, res) => res.json({ ...currentSettings, proxyCount: loadedProxies.length }));
app.post("/reload-proxies", (req, res) => {
  loadProxies();
  res.status(200).json({ success: true, count: loadedProxies.length });
});
app.put("/settings", (req, res) => {
  const patch = { ...req.body };

  // sanitize seedCount like in old version
  if (typeof patch.seedCount !== "undefined") {
    let n = Number(patch.seedCount);
    if (!Number.isFinite(n)) n = 2;
    n = Math.max(1, Math.min(16, Math.floor(n)));
    patch.seedCount = n;
  }

  currentSettings = { ...currentSettings, ...patch };
  saveSettings();
  res.sendStatus(200);
});

// --- API: canvas passthrough (unchanged) ---
app.get("/canvas", async (req, res) => {
  const { tx, ty } = req.query;
  if (isNaN(parseInt(tx)) || isNaN(parseInt(ty))) return res.sendStatus(400);
  try {
    const url = `https://backend.wplace.live/files/s0/tiles/${tx}/${ty}.png`;
    const response = await fetch(url);
    if (!response.ok) return res.sendStatus(response.status);
    const buffer = Buffer.from(await response.arrayBuffer());
    res.json({ image: `data:image/png;base64,${buffer.toString("base64")}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Keep-Alive (kept from new version) ---
const keepAlive = async () => {
  if (activeBrowserUsers.size > 0) {
    log("SYSTEM", "wplacer", "⚙️ Deferring keep-alive check: a browser operation is active.");
    return;
  }
  log("SYSTEM", "wplacer", "⚙️ Performing periodic cookie keep-alive check for all users...");
  for (const userId of Object.keys(users)) {
    if (activeBrowserUsers.has(userId)) {
      log(userId, users[userId].name, "⚠️ Skipping keep-alive check: user is currently busy.");
      continue;
    }
    activeBrowserUsers.add(userId);
    const wplacer = new WPlacer();
    try {
      await wplacer.login(users[userId].cookies);
      log(userId, users[userId].name, "✅ Cookie keep-alive successful.");
    } catch (error) {
      logUserError(error, userId, users[userId].name, "perform keep-alive check");
    } finally {
      activeBrowserUsers.delete(userId);
    }
    await sleep(currentSettings.keepAliveCooldown);
  }
  log("SYSTEM", "wplacer", "✅ Keep-alive check complete.");
};

// --- Startup ---
(async () => {
  console.clear();
  const version = JSON.parse(readFileSync("package.json", "utf8")).version;
  console.log(`\n--- wplacer v${version} by luluwaffless and jinx ---\n`);

  const loadedTemplates = loadJSON("templates.json");
  for (const id in loadedTemplates) {
    const t = loadedTemplates[id];
    if (t.userIds?.every((uid) => users[uid])) {
      const tm = new TemplateManager(
        t.name,
        t.template,
        t.coords,
        t.canBuyCharges,
        t.canBuyMaxCharges,
        t.antiGriefMode,
        t.userIds,
        !!t.paintTransparentPixels
      );
      tm.burstSeeds = t.burstSeeds || null;
      templates[id] = tm;
    } else {
      console.warn(`⚠️ Template "${t.name}" was not loaded because its assigned user(s) no longer exist.`);
    }
  }

  loadProxies();
  console.log(`✅ Loaded ${Object.keys(templates).length} templates, ${Object.keys(users).length} users and ${loadedProxies.length} proxies.`);

  const port = Number(process.env.PORT) || 80;
  const host = "0.0.0.0";
  app.listen(port, host, () => {
    console.log(`✅ Server listening on http://localhost:${port}`);
    console.log(`   Open the web UI in your browser to start!`);
    setInterval(keepAlive, 20 * 60 * 1000); // every 20 minutes
  });
})();

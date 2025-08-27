// elements
const $ = (id) => document.getElementById(id);
const main = $("main");
const openManageUsers = $("openManageUsers");
const openAddTemplate = $("openAddTemplate");
const openManageTemplates = $("openManageTemplates");
const openSettings = $("openSettings");
const userForm = $("userForm");
const scookie = $("scookie");
const jcookie = $("jcookie");
const submitUser = $("submitUser");
const manageUsers = $("manageUsers");
const userList = $("userList");
const checkUserStatus = $("checkUserStatus");
const addTemplate = $("addTemplate");
const convert = $("convert");
const details = $("details");
const size = $("size");
const ink = $("ink");
const templateCanvas = $("templateCanvas");

// Preview & overlay template
const previewCanvas = $("previewCanvas");
const previewCanvasButton = $("previewCanvasButton");
const previewBorder = $("previewBorder");
const usePaidColors = $("usePaidColors");

const templateForm = $("templateForm");
const templateFormTitle = $("templateFormTitle");
const convertInput = $("convertInput");
const templateName = $("templateName");
const tx = $("tx");
const ty = $("ty");
const px = $("px");
const py = $("py");
const userSelectList = $("userSelectList");
const selectAllUsers = $("selectAllUsers");
const canBuyMaxCharges = $("canBuyMaxCharges");
const canBuyCharges = $("canBuyCharges");
const antiGriefMode = $("antiGriefMode");
const paintTransparent = $("paintTransparent");
const submitTemplate = $("submitTemplate");
const manageTemplates = $("manageTemplates");
const templateList = $("templateList");
const startAll = $("startAll");
const stopAll = $("stopAll");
const settings = $("settings");
const turnstileNotifications = $("turnstileNotifications");
const accountCooldown = $("accountCooldown");
const purchaseCooldown = $("purchaseCooldown");
const accountCheckCooldown = $("accountCheckCooldown");
const dropletReserve = $("dropletReserve");
const antiGriefStandby = $("antiGriefStandby");
const chargeThreshold = $("chargeThreshold");
const chargeThresholdContainer = $("chargeThresholdContainer");
const totalCharges = $("totalCharges");
const totalMaxCharges = $("totalMaxCharges");
const messageBoxOverlay = $("messageBoxOverlay");
const alwaysDrawOnCharge = $("alwaysDrawOnCharge");
const messageBoxTitle = $("messageBoxTitle");
const messageBoxContent = $("messageBoxContent");
const messageBoxConfirm = $("messageBoxConfirm");
const messageBoxCancel = $("messageBoxCancel");
const manageUsersTitle = $("manageUsersTitle");
const previewSpeed = $("previewSpeed");
const previewSpeedLabel = $("previewSpeedLabel");
const showLatestInfo = $("showLatestInfo");
const buyMaxUpgradesAll = $("buyMaxUpgradesAll");

let pendingUserSelection = null; // array of userIds or null

const LAST_STATUS_KEY = 'wplacer_latest_user_status';
let LAST_USER_STATUS = {};
try {
    LAST_USER_STATUS = JSON.parse(localStorage.getItem(LAST_STATUS_KEY) || '{}') || {};
} catch (_) { LAST_USER_STATUS = {}; }

const saveLastStatus = () => {
    try { localStorage.setItem(LAST_STATUS_KEY, JSON.stringify(LAST_USER_STATUS)); } catch (_) { }
};

// Mode / burst seed inputs
const seedCountHidden = $("seedCount"); // kept for backward compatibility (hidden in UI)

// for Manage Templates live updates
let templateUpdateInterval = null;

// Message Box
let confirmCallback = null;

const showMessage = (title, content) => {
    messageBoxTitle.textContent = title;
    messageBoxContent.innerHTML = String(content);
    messageBoxCancel.classList.add('hidden');
    messageBoxConfirm.textContent = 'OK';
    messageBoxOverlay.classList.remove('hidden');
    confirmCallback = null;
};

const showConfirmation = (title, content, onConfirm) => {
    messageBoxTitle.textContent = title;
    messageBoxContent.innerHTML = String(content);
    messageBoxCancel.classList.remove('hidden');
    messageBoxConfirm.textContent = 'Confirm';
    messageBoxOverlay.classList.remove('hidden');
    confirmCallback = onConfirm;
};

const closeMessageBox = () => {
    messageBoxOverlay.classList.add('hidden');
    confirmCallback = null;
};

// PROXY UI
const proxyEnabled = $("proxyEnabled");
const proxyFormContainer = $("proxyFormContainer");
const proxyRotationMode = $("proxyRotationMode");
const proxyCount = $("proxyCount");
const reloadProxiesBtn = $("reloadProxiesBtn");
const logProxyUsage = $("logProxyUsage");


messageBoxConfirm.addEventListener('click', () => {
    if (confirmCallback) {
        confirmCallback();
    }
    closeMessageBox();
});

messageBoxCancel.addEventListener('click', () => {
    closeMessageBox();
});

previewSpeed?.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value) || 1;
    localStorage.setItem('wplacer_preview_speed', v);
    if (previewSpeedLabel) previewSpeedLabel.textContent = `${v}×`;
    if (typeof MODE_PREVIEW !== 'undefined' && MODE_PREVIEW.setSpeed) {
        MODE_PREVIEW.setSpeed(v);
    }
});

const handleError = (error) => {
    console.error(error);
    let message = "An unknown error occurred. Check the console for details.";

    if (error.code === 'ERR_NETWORK') {
        message = "Could not connect to the server. Please ensure the bot is running and accessible.";
    } else if (error.response && error.response.data && error.response.data.error) {
        const errMsg = error.response.data.error;
        if (errMsg.includes("(1015)")) {
            message = "You are being rate-limited by the server. Please wait a moment before trying again.";
        } else if (errMsg.includes("(500)")) {
            message = "Authentication failed. The user's cookie may be expired or invalid. Please try adding the user again with a new cookie.";
        } else if (errMsg.includes("(502)")) {
            message = "The server reported a Bad Gateway (502). It might be restarting. Try again shortly.";
        } else {
            message = errMsg; // Show the full error if it's not a known one
        }
    }
    showMessage("Error", message);
};

// users
const loadUsers = async (f) => {
    try {
        const users = await axios.get("/users");
        if (f) f(users.data);
    } catch (error) {
        handleError(error);
    };
};
userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const response = await axios.post('/user', { cookies: { s: scookie.value, j: jcookie.value } });
        if (response.status === 200) {
            showMessage("Success", `Logged in as ${response.data.name} (#${response.data.id})!`);
            userForm.reset();
            openManageUsers.click(); // Refresh the view
        }
    } catch (error) {
        handleError(error);
    };
});

// templates: color maps and image decoding 
const basic_colors = { "0,0,0": 1, "60,60,60": 2, "120,120,120": 3, "210,210,210": 4, "255,255,255": 5, "96,0,24": 6, "237,28,36": 7, "255,127,39": 8, "246,170,9": 9, "249,221,59": 10, "255,250,188": 11, "14,185,104": 12, "19,230,123": 13, "135,255,94": 14, "12,129,110": 15, "16,174,166": 16, "19,225,190": 17, "40,80,158": 18, "64,147,228": 19, "96,247,242": 20, "107,80,246": 21, "153,177,251": 22, "120,12,153": 23, "170,56,185": 24, "224,159,249": 25, "203,0,122": 26, "236,31,128": 27, "243,141,169": 28, "104,70,52": 29, "149,104,42": 30, "248,178,119": 31 };
const premium_colors = { "170,170,170": 32, "165,14,30": 33, "250,128,114": 34, "228,92,26": 35, "214,181,148": 36, "156,132,49": 37, "197,173,49": 38, "232,212,95": 39, "74,107,58": 40, "90,148,74": 41, "132,197,115": 42, "15,121,159": 43, "187,250,242": 44, "125,199,255": 45, "77,49,184": 46, "74,66,132": 47, "122,113,196": 48, "181,174,241": 49, "219,164,99": 50, "209,128,81": 51, "255,197,165": 52, "155,82,73": 53, "209,128,120": 54, "250,182,164": 55, "123,99,82": 56, "156,132,107": 57, "51,57,65": 58, "109,117,141": 59, "179,185,209": 60, "109,100,63": 61, "148,140,107": 62, "205,197,158": 63 };
const colors = { ...basic_colors, ...premium_colors };

const colorById = (id) => Object.keys(colors).find(key => colors[key] === id);
const closest = color => {
    const [tr, tg, tb] = color.split(',').map(Number);
    return basic_colors[Object.keys(basic_colors).reduce((closest, current) => {
        const [cr, cg, cb] = current.split(',').map(Number);
        const [clR, clG, clB] = closest.split(',').map(Number);
        return Math.sqrt(Math.pow(tr - cr, 2) + Math.pow(tg - cg, 2) + Math.pow(tb - cb, 2)) < Math.sqrt(Math.pow(tr - clR, 2) + Math.pow(tg - clG, 2) + Math.pow(tb - clB, 2)) ? current : closest;
    })];
};

// drawTemplate supports special value -1 (highlight)
const drawTemplate = (template, canvas) => {
    canvas.width = template.width;
    canvas.height = template.height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, template.width, template.height);
    const imageData = new ImageData(template.width, template.height);
    for (let x = 0; x < template.width; x++) {
        for (let y = 0; y < template.height; y++) {
            const color = template.data[x][y];
            if (color === 0) continue;
            const i = (y * template.width + x) * 4;
            if (color === -1) { // special color for demo/highlight
                imageData.data[i] = 158;
                imageData.data[i + 1] = 189;
                imageData.data[i + 2] = 255;
                imageData.data[i + 3] = 255;
                continue;
            }
            const [r, g, b] = colorById(color).split(',').map(Number);
            imageData.data[i] = r;
            imageData.data[i + 1] = g;
            imageData.data[i + 2] = b;
            imageData.data[i + 3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
};

const loadTemplates = async (f) => {
    try {
        const templates = await axios.get("/templates");
        if (f) f(templates.data);
    } catch (error) {
        handleError(error);
    };
};

let previewRenderId = 0;

// ===== preview canvas + overlay template (no conflict highlight) =====
const fetchCanvas = async (txVal, tyVal, pxVal, pyVal, width, height) => {
    const RID = ++previewRenderId; // token of current render
    const TILE_SIZE = 1000;
    const radius = Math.max(0, parseInt(previewBorder.value, 10) || 0);

    const startX = txVal * TILE_SIZE + pxVal - radius;
    const startY = tyVal * TILE_SIZE + pyVal - radius;
    const displayWidth = width + radius * 2;
    const displayHeight = height + radius * 2;
    const endX = startX + displayWidth;
    const endY = startY + displayHeight;

    const startTileX = Math.floor(startX / TILE_SIZE);
    const startTileY = Math.floor(startY / TILE_SIZE);
    const endTileX = Math.floor((endX - 1) / TILE_SIZE);
    const endTileY = Math.floor((endY - 1) / TILE_SIZE);

    // draw all tiles into offscreen buffer (template will always be on top)
    const buffer = document.createElement('canvas');
    buffer.width = displayWidth;
    buffer.height = displayHeight;
    const bctx = buffer.getContext('2d');
    bctx.imageSmoothingEnabled = false;

    for (let txi = startTileX; txi <= endTileX; txi++) {
        for (let tyi = startTileY; tyi <= endTileY; tyi++) {
            try {
                const { data } = await axios.get('/canvas', { params: { tx: txi, ty: tyi } });
                const img = new Image();
                img.src = data.image;
                await img.decode();
                if (RID !== previewRenderId) return; // outdated render — abort

                const sx = (txi === startTileX) ? startX - txi * TILE_SIZE : 0;
                const sy = (tyi === startTileY) ? startY - tyi * TILE_SIZE : 0;
                const ex = (txi === endTileX) ? endX - txi * TILE_SIZE : TILE_SIZE;
                const ey = (tyi === endTileY) ? endY - tyi * TILE_SIZE : TILE_SIZE;
                const sw = ex - sx;
                const sh = ey - sy;
                const dx = txi * TILE_SIZE + sx - startX;
                const dy = tyi * TILE_SIZE + sy - startY;

                bctx.drawImage(img, sx, sy, sw, sh, dx, dy, sw, sh);
            } catch (error) {
                handleError(error);
                return;
            }
        }
    }
    if (RID !== previewRenderId) return;

    // copy buffer to visible canvas
    previewCanvas.width = displayWidth;
    previewCanvas.height = displayHeight;
    const ctx = previewCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.drawImage(buffer, 0, 0);

    // translucent template overlay (always on top)
    ctx.globalAlpha = 0.5;
    ctx.drawImage(templateCanvas, radius, radius);
    ctx.globalAlpha = 1;
};

// ===== Manage Templates: fullscreen preview =====
let MT_PREVIEW_RENDER_ID = 0;

function ensureMtPreviewOverlay() {
    let overlay = document.getElementById('mtPreviewOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'mtPreviewOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,.65); z-index: 9999;
        display: none; align-items: center; justify-content: center; padding: 24px;
    `;

    const box = document.createElement('div');
    box.id = 'mtPreviewBox';
    box.style.cssText = `
        position: relative; background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius);
        padding: 10px 40px; max-width: 75vw; min-width: 650px; box-shadow: var(--shadow);
        display: flex; flex-direction: column; gap: 8px;
    `;

    const head = document.createElement('div');
    head.style.cssText = `display:flex; align-items:center; justify-content:space-between; gap:8px;`;

    const title = document.createElement('div');
    title.id = 'mtPreviewTitle';
    title.style.cssText = `color:#fff; font-weight:600;`;

    const close = document.createElement('button');
    close.type = 'button';
    close.innerHTML = '✕';
    close.title = 'Close';
    close.style.cssText = `
        background: var(--bg-2); border: 1px solid var(--border); color:#ddd; padding:6px 10px; border-radius:6px; cursor:pointer;
    `;
    close.addEventListener('click', () => overlay.style.display = 'none');

    head.append(title, close);

    const canvas = document.createElement('canvas');
    canvas.id = 'mtPreviewCanvas';
    canvas.style.cssText = `
        image-rendering: pixelated; width: 100%; height: auto; background:#f8f4f0; border-radius: 6px;
        cursor: default;
    `;

    const bottomControls = document.createElement('div');
    bottomControls.id = 'mtPreviewControls';
    bottomControls.style.cssText = `display:flex; align-items:center; gap:8px;`;

    const btnOverlay = document.createElement('button');
    btnOverlay.id = 'mtToggleOverlay';
    btnOverlay.type = 'button';
    btnOverlay.textContent = 'Hide template overlay';
    btnOverlay.style.cssText = `
        background: var(--bg-2); border:1px solid var(--border); color:#ddd; padding:6px 10px; border-radius:6px; cursor:pointer;
    `;

    const btnMismatch = document.createElement('button');
    btnMismatch.id = 'mtToggleMismatch';
    btnMismatch.type = 'button';
    btnMismatch.textContent = 'Highlight mismatches';
    btnMismatch.style.cssText = `
        background: var(--bg-2); border:1px solid var(--border); color:#ddd; padding:6px 10px; border-radius:6px; cursor:pointer;
    `;

    bottomControls.append(btnOverlay, btnMismatch);

    const stats = document.createElement('div');
    stats.id = 'mtPreviewStats';
    stats.style.cssText = 'color:#ddd; font-size:12px;';

    const hint = document.createElement('div');
    hint.style.cssText = 'color:#bbb; font-size:12px;';
    hint.textContent = 'Mouse wheel — zoom. Left mouse drag — pan. Esc — close.';

    box.append(head, canvas, bottomControls, stats, hint);
    overlay.append(box);
    document.body.append(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.style.display = 'none'; });
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.style.display !== 'none') overlay.style.display = 'none';
    });

    return overlay;
}

async function showManageTemplatePreview(t) {
    const overlay = ensureMtPreviewOverlay();
    const titleEl = document.getElementById('mtPreviewTitle');
    const preview = document.getElementById('mtPreviewCanvas');
    const statsEl = document.getElementById('mtPreviewStats');
    const btnOverlay = document.getElementById('mtToggleOverlay');
    const btnMismatch = document.getElementById('mtToggleMismatch');
    titleEl.textContent = `Preview: ${t.name}`;

    const RID = ++MT_PREVIEW_RENDER_ID;
    const TILE_SIZE = 1000;
    const [txVal, tyVal, pxVal, pyVal] = t.coords.map(Number);
    const width = t.template?.width || 0;
    const height = t.template?.height || 0;

    if (!Number.isFinite(txVal) || !Number.isFinite(tyVal) || !Number.isFinite(pxVal) || !Number.isFinite(pyVal) || width === 0) {
        showMessage("Error", "Template has no image or invalid coordinates.");
        return;
    }

    const startX = txVal * TILE_SIZE + pxVal;
    const startY = tyVal * TILE_SIZE + pyVal;
    const displayWidth = width;
    const displayHeight = height;
    const endX = startX + displayWidth;
    const endY = startY + displayHeight;

    const startTileX = Math.floor(startX / TILE_SIZE);
    const startTileY = Math.floor(startY / TILE_SIZE);
    const endTileX = Math.floor((endX - 1) / TILE_SIZE);
    const endTileY = Math.floor((endY - 1) / TILE_SIZE);

    const buffer = document.createElement('canvas');
    buffer.width = displayWidth;
    buffer.height = displayHeight;
    const bctx = buffer.getContext('2d');
    bctx.imageSmoothingEnabled = false;
    bctx.clearRect(0, 0, displayWidth, displayHeight);

    try {
        for (let txi = startTileX; txi <= endTileX; txi++) {
            for (let tyi = startTileY; tyi <= endTileY; tyi++) {
                const { data } = await axios.get('/canvas', { params: { tx: txi, ty: tyi } });
                if (RID !== MT_PREVIEW_RENDER_ID) return;

                const img = new Image();
                img.src = data.image;
                await img.decode();
                if (RID !== MT_PREVIEW_RENDER_ID) return;

                const sx = (txi === startTileX) ? (startX - txi * TILE_SIZE) : 0;
                const sy = (tyi === startTileY) ? (startY - tyi * TILE_SIZE) : 0;
                const ex = (txi === endTileX) ? (endX - txi * TILE_SIZE) : TILE_SIZE;
                const ey = (tyi === endTileY) ? (endY - tyi * TILE_SIZE) : TILE_SIZE;
                const sw = ex - sx;
                const sh = ey - sy;
                const dx = txi * TILE_SIZE + sx - startX;
                const dy = tyi * TILE_SIZE + sy - startY;

                bctx.drawImage(img, sx, sy, sw, sh, dx, dy, sw, sh);
            }
        }
    } catch (error) {
        handleError(error);
        return;
    }

    const SCALE = 4;
    const src = bctx.getImageData(0, 0, displayWidth, displayHeight).data;

    const rgbOfId = (id) => {
        const s = colorById(id);
        if (!s) return null;
        const [r, g, b] = s.split(',').map(n => parseInt(n, 10));
        return [r, g, b];
    };

    let totalTpl = 0, matched = 0;
    for (let y = 0; y < displayHeight; y++) {
        for (let x = 0; x < displayWidth; x++) {
            const id = t.template?.data?.[x]?.[y] ?? 0;
            if (id > 0) {
                totalTpl++;
                const tplRGB = rgbOfId(id);
                const i = (y * displayWidth + x) * 4;
                const br = src[i], bg = src[i + 1], bb = src[i + 2], ba = src[i + 3];
                if (tplRGB && ba === 255 && br === tplRGB[0] && bg === tplRGB[1] && bb === tplRGB[2]) matched++;
            }
        }
    }
    const pct = totalTpl ? (matched / totalTpl) * 100 : 0;
    statsEl.textContent = `Matches: ${matched} / ${totalTpl} (${(Math.round(pct * 100) / 100).toFixed(2)}%)`;

    preview.width = displayWidth * SCALE;
    preview.height = displayHeight * SCALE;
    const pctx = preview.getContext('2d');
    pctx.imageSmoothingEnabled = false;

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    const STATE = {
        w: displayWidth,
        h: displayHeight,
        SCALE,
        buffer,
        src,
        template: t.template,
        zoom: 1,
        maxZoom: Math.max(displayWidth, displayHeight) + 2,
        viewX: 0,
        viewY: 0,
        dragging: false,
        dragStartX: 0,
        dragStartY: 0,
        viewStartX: 0,
        viewStartY: 0,
        showOverlay: true,
        highlightMismatch: false
    };

    function drawOverlayMiniFit() {
        const MINI = Math.max(2, Math.floor(STATE.SCALE / 2));
        const OFF = Math.floor((STATE.SCALE - MINI) / 2);
        for (let y = 0; y < STATE.h; y++) {
            for (let x = 0; x < STATE.w; x++) {
                const id = STATE.template?.data?.[x]?.[y] ?? 0;
                if (id <= 0) continue;
                const tplRGB = rgbOfId(id);
                if (!tplRGB) continue;
                const i = (y * STATE.w + x) * 4;
                const br = STATE.src[i], bg = STATE.src[i + 1], bb = STATE.src[i + 2], ba = STATE.src[i + 3];
                if (ba === 255 && br === tplRGB[0] && bg === tplRGB[1] && bb === tplRGB[2]) continue;
                const dx = x * STATE.SCALE + OFF;
                const dy = y * STATE.SCALE + OFF;
                pctx.fillStyle = `rgb(${tplRGB[0]},${tplRGB[1]},${tplRGB[2]})`;
                pctx.fillRect(dx, dy, MINI, MINI);
            }
        }
    }

    function drawOverlayMiniZoom(sx, sy, vw, vh, cellW, cellH) {
        const miniW = Math.max(1, Math.floor(cellW / 2));
        const miniH = Math.max(1, Math.floor(cellH / 2));
        const offX = Math.floor((cellW - miniW) / 2);
        const offY = Math.floor((cellH - miniH) / 2);
        for (let y = sy; y < sy + vh; y++) {
            for (let x = sx; x < sx + vw; x++) {
                const id = STATE.template?.data?.[x]?.[y] ?? 0;
                if (id <= 0) continue;
                const tplRGB = rgbOfId(id);
                if (!tplRGB) continue;
                const i = (y * STATE.w + x) * 4;
                const br = STATE.src[i], bg = STATE.src[i + 1], bb = STATE.src[i + 2], ba = STATE.src[i + 3];
                if (ba === 255 && br === tplRGB[0] && bg === tplRGB[1] && bb === tplRGB[2]) continue;
                const cx = (x - sx) * cellW + offX;
                const cy = (y - sy) * cellH + offY;
                pctx.fillStyle = `rgb(${tplRGB[0]},${tplRGB[1]},${tplRGB[2]})`;
                pctx.fillRect(Math.floor(cx), Math.floor(cy), Math.floor(miniW), Math.floor(miniH));
            }
        }
    }

    function drawOverlayRedFit() {
        pctx.fillStyle = '#ff0000';
        for (let y = 0; y < STATE.h; y++) {
            for (let x = 0; x < STATE.w; x++) {
                const id = STATE.template?.data?.[x]?.[y] ?? 0;
                if (id <= 0) continue;
                const tplRGB = rgbOfId(id);
                if (!tplRGB) continue;
                const i = (y * STATE.w + x) * 4;
                const br = STATE.src[i], bg = STATE.src[i + 1], bb = STATE.src[i + 2], ba = STATE.src[i + 3];
                if (ba === 255 && br === tplRGB[0] && bg === tplRGB[1] && bb === tplRGB[2]) continue;
                pctx.fillRect(x * STATE.SCALE, y * STATE.SCALE, STATE.SCALE, STATE.SCALE);
            }
        }
    }

    function drawOverlayRedZoom(sx, sy, vw, vh, cellW, cellH) {
        pctx.fillStyle = '#ff0000';
        for (let y = sy; y < sy + vh; y++) {
            for (let x = sx; x < sx + vw; x++) {
                const id = STATE.template?.data?.[x]?.[y] ?? 0;
                if (id <= 0) continue;
                const tplRGB = rgbOfId(id);
                if (!tplRGB) continue;
                const i = (y * STATE.w + x) * 4;
                const br = STATE.src[i], bg = STATE.src[i + 1], bb = STATE.src[i + 2], ba = STATE.src[i + 3];
                if (ba === 255 && br === tplRGB[0] && bg === tplRGB[1] && bb === tplRGB[2]) continue;
                const cx = (x - sx) * cellW;
                const cy = (y - sy) * cellH;
                pctx.fillRect(Math.floor(cx), Math.floor(cy), Math.ceil(cellW), Math.ceil(cellH));
            }
        }
    }

    function drawFit() {
        pctx.clearRect(0, 0, preview.width, preview.height);
        pctx.drawImage(STATE.buffer, 0, 0, STATE.w, STATE.h, 0, 0, preview.width, preview.height);
        if (STATE.highlightMismatch) drawOverlayRedFit();
        else if (STATE.showOverlay) drawOverlayMiniFit();
    }

    function drawZoom() {
        let vw = Math.max(1, Math.round(STATE.w / STATE.zoom));
        let vh = Math.max(1, Math.round(STATE.h / STATE.zoom));
        if (STATE.zoom >= STATE.maxZoom) { vw = 1; vh = 1; }
        const cellW = preview.width / vw;
        const cellH = preview.height / vh;

        STATE.viewX = clamp(STATE.viewX, 0, STATE.w - vw);
        STATE.viewY = clamp(STATE.viewY, 0, STATE.h - vh);
        const sx = Math.floor(STATE.viewX);
        const sy = Math.floor(STATE.viewY);

        pctx.clearRect(0, 0, preview.width, preview.height);
        pctx.drawImage(STATE.buffer, sx, sy, vw, vh, 0, 0, preview.width, preview.height);

        if (STATE.highlightMismatch) drawOverlayRedZoom(sx, sy, vw, vh, cellW, cellH);
        else if (STATE.showOverlay) drawOverlayMiniZoom(sx, sy, vw, vh, cellW, cellH);
    }

    function render() {
        if (STATE.zoom <= 1.0001) {
            preview.style.cursor = 'grab';
            drawFit();
        } else {
            preview.style.cursor = STATE.dragging ? 'grabbing' : 'grab';
            drawZoom();
        }
    }

    function canvasPoint(e) {
        const r = preview.getBoundingClientRect();
        const cx = (e.clientX - r.left) * (preview.width / r.width);
        const cy = (e.clientY - r.top) * (preview.height / r.height);
        return [cx, cy];
    }

    function zoomAround(cx, cy, multiplier) {
        let vw = Math.max(1, Math.round(STATE.w / STATE.zoom));
        let vh = Math.max(1, Math.round(STATE.h / STATE.zoom));
        const cellW = preview.width / vw;
        const cellH = preview.height / vh;
        const worldX = STATE.viewX + cx / cellW;
        const worldY = STATE.viewY + cy / cellH;

        STATE.zoom = clamp(STATE.zoom * multiplier, 1, STATE.maxZoom);

        vw = Math.max(1, Math.round(STATE.w / STATE.zoom));
        vh = Math.max(1, Math.round(STATE.h / STATE.zoom));
        const cellW2 = preview.width / vw;
        const cellH2 = preview.height / vh;

        STATE.viewX = worldX - cx / cellW2;
        STATE.viewY = worldY - cy / cellH2;

        render();
    }

    preview.onwheel = (e) => {
        e.preventDefault();
        const [cx, cy] = canvasPoint(e);
        const base = 1.12;
        const steps = Math.max(1, Math.min(6, Math.abs(e.deltaY) / 60));
        const mul = Math.pow(base, steps);
        if (e.deltaY < 0) zoomAround(cx, cy, mul);
        else zoomAround(cx, cy, 1 / mul);
    };

    preview.onmousedown = (e) => {
        if (e.button !== 0) return;
        if (STATE.zoom <= 1.0001) return;
        const [cx, cy] = canvasPoint(e);
        STATE.dragging = true;
        preview.style.cursor = 'grabbing';
        STATE.dragStartX = cx;
        STATE.dragStartY = cy;
        STATE.viewStartX = STATE.viewX;
        STATE.viewStartY = STATE.viewY;
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragEnd);
        window.addEventListener('mouseleave', onDragEnd);
    };

    function onDragMove(e) {
        if (!STATE.dragging) return;
        let vw = Math.max(1, Math.round(STATE.w / STATE.zoom));
        let vh = Math.max(1, Math.round(STATE.h / STATE.zoom));
        const cellW = preview.width / vw;
        const cellH = preview.height / vh;

        const [cx, cy] = canvasPoint(e);
        const dx = cx - STATE.dragStartX;
        const dy = cy - STATE.dragStartY;

        STATE.viewX = clamp(STATE.viewStartX - dx / cellW, 0, STATE.w - vw);
        STATE.viewY = clamp(STATE.viewStartY - dy / cellH, 0, STATE.h - vh);

        render();
    }

    function onDragEnd() {
        STATE.dragging = false;
        preview.style.cursor = 'grab';
        window.removeEventListener('mousemove', onDragMove);
        window.removeEventListener('mouseup', onDragEnd);
        window.removeEventListener('mouseleave', onDragEnd);
    }

    function updateButtons() {
        btnOverlay.textContent = STATE.showOverlay ? 'Hide template overlay' : 'Show template overlay';
        btnMismatch.textContent = STATE.highlightMismatch ? 'Hide mismatches highlight' : 'Highlight mismatches';
    }

    btnOverlay.onclick = () => { STATE.showOverlay = !STATE.showOverlay; updateButtons(); render(); };
    btnMismatch.onclick = () => { STATE.highlightMismatch = !STATE.highlightMismatch; updateButtons(); render(); };

    updateButtons();
    render();
    overlay.style.display = 'flex';
}




//
// smart image decoder taking paid colors option into account
const nearestimgdecoder = (imageData, width, height) => {
    const d = imageData.data;
    const matrix = Array.from({ length: width }, () => Array(height).fill(0));
    let ink = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const a = d[i + 3];
            if (a === 255) {
                const r = d[i], g = d[i + 1], b = d[i + 2];
                const rgb = `${r},${g},${b}`;
                if (rgb === "158,189,255") matrix[x][y] = -1; // service color
                else {
                    const id = colors[rgb] && usePaidColors.checked ? colors[rgb] : closest(rgb);
                    matrix[x][y] = id;
                }
                ink++;
            } else {
                matrix[x][y] = 0;
            }
        }
    }
    return { matrix, ink };
};

let currentTemplate = { width: 0, height: 0, data: [] };

const processImageFile = (file, callback) => {
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            const image = new Image();
            image.src = e.target.result;
            image.onload = async () => {
                const canvas = document.createElement("canvas");
                canvas.width = image.width;
                canvas.height = image.height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(image, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const { matrix, ink } = nearestimgdecoder(imageData, canvas.width, canvas.height);

                const template = { width: canvas.width, height: canvas.height, ink, data: matrix };
                canvas.remove();
                callback(template);
            };
        };
        reader.readAsDataURL(file);
    }
};

const processEvent = () => {
    const file = convertInput.files[0];
    if (!file) return;
    templateName.value = file.name.replace(/\.[^/.]+$/, "");
    processImageFile(file, (template) => {
        currentTemplate = template;
        drawTemplate(template, templateCanvas);
        size.innerHTML = `${template.width}x${template.height}px`;
        ink.innerHTML = template.ink;
        details.style.display = "block";
    });
};
convertInput.addEventListener('change', processEvent);
usePaidColors.addEventListener('change', processEvent);

previewCanvasButton?.addEventListener('click', async () => {
    const txVal = parseInt(tx.value, 10);
    const tyVal = parseInt(ty.value, 10);
    const pxVal = parseInt(px.value, 10);
    const pyVal = parseInt(py.value, 10);
    if (isNaN(txVal) || isNaN(tyVal) || isNaN(pxVal) || isNaN(pyVal) || currentTemplate.width === 0) {
        showMessage("Error", "Please convert an image and enter valid coordinates before previewing.");
        return;
    }
    await fetchCanvas(txVal, tyVal, pxVal, pyVal, currentTemplate.width, currentTemplate.height);
});

canBuyMaxCharges.addEventListener('change', () => {
    if (canBuyMaxCharges.checked) {
        canBuyCharges.checked = false;
    }
});

canBuyCharges.addEventListener('change', () => {
    if (canBuyCharges.checked) {
        canBuyMaxCharges.checked = false;
    }
});

const resetTemplateForm = () => {
    templateForm.reset();
    templateFormTitle.textContent = "Add Template";
    submitTemplate.innerHTML = '<img src="icons/addTemplate.svg">Add Template';
    delete templateForm.dataset.editId;
    details.style.display = "none";
    currentTemplate = { width: 0, height: 0, data: [] };
};

templateForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const isEditMode = !!templateForm.dataset.editId;

    if (!isEditMode && (!currentTemplate || currentTemplate.width === 0)) {
        showMessage("Error", "Please convert an image before creating a template.");
        return;
    }
    const selectedUsers = Array.from(document.querySelectorAll('input[name="user_checkbox"]:checked')).map(cb => cb.value);
    if (selectedUsers.length === 0) {
        showMessage("Error", "Please select at least one user.");
        return;
    }

    const data = {
        templateName: templateName.value,
        coords: [tx.value, ty.value, px.value, py.value].map(Number),
        userIds: selectedUsers,
        canBuyCharges: canBuyCharges.checked,
        canBuyMaxCharges: canBuyMaxCharges.checked,
        antiGriefMode: antiGriefMode.checked,
        paintTransparentPixels: !!paintTransparent.checked
    };

    if (currentTemplate && currentTemplate.width > 0) {
        data.template = currentTemplate;
    }

    try {
        if (isEditMode) {
            await axios.put(`/template/edit/${templateForm.dataset.editId}`, data);
            showMessage("Success", "Template updated!");
        } else {
            await axios.post('/template', data);
            showMessage("Success", "Template created!");
        }
        resetTemplateForm();
        openManageTemplates.click();
    } catch (error) {
        handleError(error);
    };
});
startAll.addEventListener('click', async () => {
    for (const child of templateList.children) {
        try {
            await axios.put(`/template/${child.id}`, { running: true });
        } catch (error) {
            handleError(error);
        };
    };
    showMessage("Success", "Finished! Check console for details.");
    openManageTemplates.click();
});
stopAll.addEventListener('click', async () => {
    for (const child of templateList.children) {
        try {
            await axios.put(`/template/${child.id}`, { running: false });
        } catch (error) {
            handleError(error);
        };
    };
    showMessage("Success", "Finished! Check console for details.");
    openManageTemplates.click();
});


// tabs
let currentTab = main;
const changeTab = (el) => {
    // stop preview animations if leaving settings
    if (currentTab === settings && typeof MODE_PREVIEW !== 'undefined' && MODE_PREVIEW.stopAll) {
        MODE_PREVIEW.stopAll();
    }
    // if leaving manageTemplates — stop interval
    if (currentTab === manageTemplates && templateUpdateInterval) {
        clearInterval(templateUpdateInterval);
        templateUpdateInterval = null;
    }

    currentTab.style.display = "none";
    el.style.display = "block";
    currentTab = el;

    // if came to settings — start previews
    if (currentTab === settings && typeof MODE_PREVIEW !== 'undefined' && MODE_PREVIEW.start) {
        setTimeout(() => {
            const ref = document.getElementById('modeReference');
            if (ref && MODE_PREVIEW.drawReference) MODE_PREVIEW.drawReference(ref);
            document.querySelectorAll('.mode-preview[data-mode]').forEach(cv => MODE_PREVIEW.start(cv));
        }, 50);
    }
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

openManageUsers.addEventListener("click", () => {
    userList.innerHTML = "";
    userForm.reset();
    totalCharges.textContent = "?";
    totalMaxCharges.textContent = "?";
    loadUsers(users => {
        const userCount = Object.keys(users).length;
        if (manageUsersTitle) manageUsersTitle.textContent = `Existing Users (${userCount})`;
        for (const id of Object.keys(users)) {
            const user = document.createElement('div');
            user.className = 'user';
            user.id = `user-${id}`;

            // optional expiration date on backend
            const expirationDate = users[id].expirationDate;
            const expirationStr = expirationDate ? new Date(expirationDate * 1000).toLocaleString() : 'N/A';

            user.innerHTML = `
                <div class="user-info">
                    <span class="user-info-username">${users[id].name}</span>
                    <span class="user-info-id">(#${id})</span>
                    <div class="user-stats">
                        Charges: <b>?</b>/<b>?</b> | Level <b>?</b> <span class="level-progress">(?%)</span> | Droplets: <b>?</b> 
                        <br><span class="muted">Expires: <b>${expirationStr}</b></span>
                    </div>
                </div>
                <div class="user-actions">
                    <button class="delete-btn" title="Delete User"><img src="icons/remove.svg"></button>
                    <button class="json-btn" title="Get User Info"><img src="icons/code.svg"></button>
                </div>`;

            user.querySelector('.delete-btn').addEventListener("click", () => {
                showConfirmation(
                    "Delete User",
                    `Are you sure you want to delete ${users[id].name} (#${id})? This will also remove them from all templates.`,
                    async () => {
                        try {
                            await axios.delete(`/user/${id}`);
                            showMessage("Success", "User deleted.");
                            openManageUsers.click();
                        } catch (error) {
                            handleError(error);
                        };
                    }
                );
            });
            user.querySelector('.json-btn').addEventListener("click", async () => {
                try {
                    const response = await axios.get(`/user/status/${id}`);
                    const u = response.data;
                    const info = `
                        <b>User:</b> <span style="color:#f97a1f">${u.name}</span><br>
                        <b>Charges:</b> <span style="color:#f97a1f">${Math.floor(u.charges.count)}</span>/<span style="color:#f97a1f">${u.charges.max}</span><br>
                        <b>Droplets:</b> <span style="color:#f97a1f">${u.droplets}</span><br>
                        <b>Level:</b> <span style="color:#f97a1f">${Math.floor(u.level)} (${Math.round((u.level % 1) * 100)}%)</span><br>
                        <b>Favorite Locations:</b> <span style="color:#f97a1f">${u.favoriteLocations?.length ?? 0}</span>/<span style="color:#f97a1f">${u.maxFavoriteLocations ?? "?"}</span><br>
                        <b>Discord:</b> <span style="color:#f97a1f">${u.discord ?? "-"}</span><br>
                        <b>Country:</b> <span style="color:#f97a1f">${u.country ?? "-"}</span><br>
                        <b>Pixels Painted:</b> <span style="color:#f97a1f">${u.pixelsPainted ?? "-"}</span><br>
                        <b>Alliance:</b> <span style="color:#f97a1f">${u.allianceId ?? "-"}</span> / <span style="color:#f97a1f">${u.allianceRole ?? "-"}</span><br><br>
                        Copy RAW JSON to clipboard?
                    `;
                    showConfirmation("User Info", info, () => {
                        navigator.clipboard.writeText(JSON.stringify(u, null, 2));
                    });
                } catch (error) {
                    handleError(error);
                }
            });
            userList.appendChild(user);
        }
    });
    changeTab(manageUsers);
});

async function processInParallel(tasks, concurrency) {
    const queue = [...tasks];
    const workers = [];

    const runTask = async () => {
        while (queue.length > 0) {
            const task = queue.shift();
            if (task) await task();
        }
    };

    for (let i = 0; i < concurrency; i++) {
        workers.push(runTask());
    }

    await Promise.all(workers);
}

checkUserStatus.addEventListener("click", async () => {
    checkUserStatus.disabled = true;
    checkUserStatus.innerHTML = "Checking...";
    const userElements = Array.from(document.querySelectorAll('.user'));

    let totalCurrent = 0;
    let totalMax = 0;

    // consider accountCheckCooldown setting
    let settingsAccountCheckCooldown = 0;
    try {
        const { data: s } = await axios.get('/settings');
        settingsAccountCheckCooldown = s.accountCheckCooldown || 0;
    } catch (_) { /* ignore */ }

    const doOne = async (userEl) => {
        const id = userEl.id.split('-')[1];
        const infoSpans = userEl.querySelectorAll('.user-info > span');
        const currentChargesEl = userEl.querySelector('.user-stats b:nth-of-type(1)');
        const maxChargesEl = userEl.querySelector('.user-stats b:nth-of-type(2)');
        const currentLevelEl = userEl.querySelector('.user-stats b:nth-of-type(3)');
        const currentDroplets = userEl.querySelector('.user-stats b:nth-of-type(4)');
        const levelProgressEl = userEl.querySelector('.level-progress');

        infoSpans.forEach(span => span.style.color = 'var(--warning-color)');
        try {
            const response = await axios.get(`/user/status/${id}`);
            const userInfo = response.data;

            const charges = Math.floor(userInfo.charges.count);
            const max = userInfo.charges.max;
            const droplets = userInfo.droplets;
            const level = Math.floor(userInfo.level);
            const progress = Math.round((userInfo.level % 1) * 100);

            LAST_USER_STATUS[id] = { charges, max, droplets, level, progress };
            saveLastStatus();

            currentChargesEl.textContent = charges;
            maxChargesEl.textContent = max;
            currentLevelEl.textContent = level;
            levelProgressEl.textContent = `(${progress}%)`;
            currentDroplets.textContent = droplets;
            totalCurrent += charges;
            totalMax += max;

            infoSpans.forEach(span => span.style.color = 'var(--success-color)');
        } catch (error) {
            currentChargesEl.textContent = "ERR";
            maxChargesEl.textContent = "ERR";
            currentLevelEl.textContent = "?";
            levelProgressEl.textContent = "(?%)";
            currentDroplets.textContent = "?";
            infoSpans.forEach(span => span.style.color = 'var(--error-color)');
        }
        if (settingsAccountCheckCooldown > 0) {
            await sleep(settingsAccountCheckCooldown);
        }
    };

    if (settingsAccountCheckCooldown > 0) {
        // sequential
        for (const el of userElements) {
            await doOne(el);
        }
    } else {
        // parallel
        const tasks = userElements.map(el => () => doOne(el));
        await processInParallel(tasks, 5);
    }

    totalCharges.textContent = totalCurrent;
    totalMaxCharges.textContent = totalMax;

    checkUserStatus.disabled = false;
    checkUserStatus.innerHTML = '<img src="icons/check.svg">Check Account Status';
});

buyMaxUpgradesAll?.addEventListener("click", () => {
    showConfirmation(
        "Buy max charge upgrades (all)",
        `Buy the maximum number of Max Charge upgrades for all accounts in turn?
        <br><br><b>Note: </b><i>Droplet reserve</i> is used from settings 
        <i>Purchase Cooldown</i> (default 5 sec).`,
        async () => {
            try {
                buyMaxUpgradesAll.disabled = true;
                buyMaxUpgradesAll.innerHTML = "Processing...";

                const { data } = await axios.post("/users/buy-max-upgrades", {});
                const rep = data?.report || [];

                const ok = rep.filter(r => r.amount > 0).length;
                const skippedBusy = rep.filter(r => r.skipped && r.reason === "busy").length;
                const skippedNoFunds = rep.filter(r => r.skipped && r.reason === "insufficient_droplets_or_reserve").length;
                const failed = rep.filter(r => r.error).length;

                let html = `<b>Cooldown:</b> ${Math.round((data.cooldownMs || 0) / 1000)}s<br>
                            <b>Reserve:</b> ${data.reserve || 0} droplets<br><br>
                            <b>Purchased on:</b> ${ok}<br>
                            <b>Skipped (busy):</b> ${skippedBusy}<br>
                            <b>Skipped (no funds):</b> ${skippedNoFunds}<br>
                            <b>Failed:</b> ${failed}<br><br>`;

                const lines = rep.slice(0, 10).map(r => {
                    if (r.error) return `❌ ${r.name} (#${r.userId}): ${r.error}`;
                    if (r.skipped) return `⏭️ ${r.name} (#${r.userId}): ${r.reason}`;
                    return `✅ ${r.name} (#${r.userId}): +${r.amount} (droplets ${r.beforeDroplets} → ${r.afterDroplets})`;
                }).join("<br>");

                html += lines;
                if (rep.length > 10) html += `<br>...and ${rep.length - 10} more`;

                showMessage("Bulk purchase finished", html);
            } catch (error) {
                handleError(error);
            } finally {
                buyMaxUpgradesAll.disabled = false;
                buyMaxUpgradesAll.innerHTML = '<img src="icons/playAll.svg" alt=""/> Buy Max Charge Upgrades (All)';
            }
        }
    );
});


showLatestInfo.addEventListener("click", () => {
    const hasAny = LAST_USER_STATUS && Object.keys(LAST_USER_STATUS).length > 0;
    if (!hasAny) {
        showMessage("Latest Info", "Nothing to show. Press «Check Account Status».");
        return;
    }


    const userElements = Array.from(document.querySelectorAll('.user'));

    let sumCharges = 0;
    let sumMax = 0;
    let touched = false;

    userElements.forEach(userEl => {
        const id = userEl.id.split('-')[1];
        const s = LAST_USER_STATUS[id];
        if (!s) return;

        const currentChargesEl = userEl.querySelector('.user-stats b:nth-of-type(1)');
        const maxChargesEl = userEl.querySelector('.user-stats b:nth-of-type(2)');
        const currentLevelEl = userEl.querySelector('.user-stats b:nth-of-type(3)');
        const levelProgressEl = userEl.querySelector('.level-progress');
        const currentDroplets = userEl.querySelector('.user-stats b:nth-of-type(4)');

        if (currentChargesEl) currentChargesEl.textContent = s.charges;
        if (maxChargesEl) maxChargesEl.textContent = s.max;
        if (currentLevelEl) currentLevelEl.textContent = s.level;
        if (levelProgressEl) levelProgressEl.textContent = `(${s.progress}%)`;
        if (currentDroplets) currentDroplets.textContent = s.droplets;

        sumCharges += Math.floor(s.charges);
        sumMax += Math.floor(s.max);
        touched = true;
    });

    if (touched) {
        if (totalCharges) totalCharges.textContent = String(sumCharges);
        if (totalMaxCharges) totalMaxCharges.textContent = String(sumMax);
    } else {
        showMessage("Latest Info", "There is no saved data for current accounts..");
    }
});


openAddTemplate.addEventListener("click", () => {
    resetTemplateForm();
    userSelectList.innerHTML = "";
    loadUsers(users => {
        if (Object.keys(users).length === 0) {
            userSelectList.innerHTML = "<span>No users added. Please add a user first.</span>";
            return;
        }
        for (const id of Object.keys(users)) {
            const userDiv = document.createElement('div');
            userDiv.className = 'user-select-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `user_${id}`;
            checkbox.name = 'user_checkbox';
            checkbox.value = id;

            if (Array.isArray(pendingUserSelection) && pendingUserSelection.includes(String(id))) {
                checkbox.checked = true;
            }

            const label = document.createElement('label');
            label.className = 'label-margin0';
            label.htmlFor = `user_${id}`;
            label.textContent = `${users[id].name} (#${id})`;
            userDiv.appendChild(checkbox);
            userDiv.appendChild(label);
            userSelectList.appendChild(userDiv);
        }
        pendingUserSelection = null;
    });
    changeTab(addTemplate);
});
selectAllUsers.addEventListener('click', () => {
    document.querySelectorAll('#userSelectList input[type="checkbox"]').forEach(cb => cb.checked = true);
});
document.getElementById("HideSensInfo").addEventListener("click", function () {
    const btn = this;
    const elements = document.querySelectorAll(".user-info-username, .user-actions, .user-info-id");
    const isHidden = btn.dataset.hidden === "true";

    elements.forEach(el => {
        if (!isHidden) {
            el.style.setProperty("display", "none", "important");
        } else {
            el.style.removeProperty("display");
        }
    });

    btn.textContent = isHidden ? "Hide Sensitive Info" : "Show Sensitive Info";
    btn.dataset.hidden = !isHidden;
});

let createToggleButton = (template, id, buttonsContainer, statusSpan) => {
    const button = document.createElement('button');
    const isRunning = template.running;

    button.className = isRunning ? 'destructive-button button-templates' : 'primary-button button-templates';
    button.innerHTML = `<img src="icons/${isRunning ? 'pause' : 'play'}.svg">${isRunning ? 'Stop' : 'Start'}`;

    button.addEventListener('click', async () => {
        try {
            await axios.put(`/template/${id}`, { running: !isRunning });
            template.running = !isRunning;
            const newButton = createToggleButton(template, id, buttonsContainer, statusSpan);
            button.replaceWith(newButton);
            statusSpan.textContent = `Status: ${!isRunning ? 'Started' : 'Stopped'}`;
        } catch (error) {
            handleError(error);
        }
    });
    return button;
};

// live update progress
const updateTemplateStatus = async () => {
    try {
        const { data: templates } = await axios.get("/templates");
        for (const id in templates) {
            const t = templates[id];
            const templateElement = $(id);
            if (!templateElement) continue;

            const total = t.totalPixels || (t.template?.width * t.template?.height) || 1;
            const remaining = (typeof t.pixelsRemaining === 'number') ? t.pixelsRemaining : total;
            const completed = Math.max(0, total - remaining);
            const percent = Math.floor((completed / total) * 100);

            const progressBar = templateElement.querySelector('.progress-bar');
            const progressBarText = templateElement.querySelector('.progress-bar-text');
            const pixelCount = templateElement.querySelector('.pixel-count');

            if (progressBar) progressBar.style.width = `${percent}%`;
            if (progressBarText) progressBarText.textContent = `${percent}% | ${t.status}`;
            if (pixelCount) pixelCount.textContent = `${completed} / ${total}`;

            if (t.status === "Finished." || t.status === "Finished") {
                progressBar.classList.add('finished');
                progressBar.classList.remove('stopped');
            } else if (!t.running) {
                progressBar.classList.add('stopped');
                progressBar.classList.remove('finished');
            } else {
                progressBar.classList.remove('stopped', 'finished');
            }
        }
    } catch (error) {
        console.warn("Failed to update template statuses:", error);
    }
};

openManageTemplates.addEventListener("click", () => {
    templateList.innerHTML = "";
    if (templateUpdateInterval) {
        clearInterval(templateUpdateInterval);
        templateUpdateInterval = null;
    }

    loadUsers(users => {
        loadTemplates(templates => {
            for (const id of Object.keys(templates)) {
                const t = templates[id];

                const template = document.createElement('div');
                template.id = id;
                template.className = "template";

                const total = t.totalPixels || (t.template?.width * t.template?.height) || 1;
                const remaining = (typeof t.pixelsRemaining === 'number') ? t.pixelsRemaining : total;
                const completed = Math.max(0, total - remaining);
                const percent = Math.floor((completed / total) * 100);

                const infoSpan = document.createElement('span');
                infoSpan.className = 'template-info';

                const accountsRow = document.createElement('div');
                accountsRow.className = 't-accounts-row';
                const accountsLabel = document.createElement('span');
                accountsLabel.className = 't-accounts-label';
                accountsLabel.textContent = 'Accounts:';
                const accountsCount = document.createElement('b');
                accountsCount.className = 't-accounts-count';
                accountsCount.textContent = String(t.userIds.length);
                const showAllBtn = document.createElement('button');
                showAllBtn.type = 'button';
                showAllBtn.className = 'tiny-inline-btn';
                showAllBtn.textContent = 'Show All';
                accountsRow.append(accountsLabel, accountsCount, showAllBtn);

                const accountsExpanded = document.createElement('div');
                accountsExpanded.className = 'accounts-expanded';
                for (const userId of t.userIds) {
                    const u = users[userId];
                    const chip = document.createElement('span');
                    chip.className = 'account-chip';
                    const nm = document.createElement('span');
                    nm.className = 'account-name';
                    nm.textContent = u ? u.name : 'Unknown';
                    const badge = document.createElement('span');
                    badge.className = 'account-id-badge';
                    badge.textContent = `#${userId}`;
                    chip.append(nm, badge);
                    accountsExpanded.appendChild(chip);
                }
                showAllBtn.addEventListener('click', () => {
                    const willShow = !accountsExpanded.classList.contains('show');
                    accountsExpanded.classList.toggle('show', willShow);
                    showAllBtn.textContent = willShow ? 'Hide' : 'Show All';
                });

                const meta = document.createElement('div');
                meta.className = 't-meta';
                meta.innerHTML = `
                    <div class="t-accounts">Coords: ${t.coords.join(", ")}</div>
                    <div class="t-accounts">Pixels: <span class="pixel-count">${completed} / ${total}</span></div>
                    <b class="status-text">Status:</b> ${t.status}
                `;

                const nameDiv = document.createElement('div');
                nameDiv.className = 't-name';
                nameDiv.innerHTML = `<b>Template name: ${t.name}</b>`;

                infoSpan.appendChild(nameDiv);
                infoSpan.appendChild(accountsRow);
                infoSpan.appendChild(accountsExpanded);
                infoSpan.appendChild(meta);
                template.appendChild(infoSpan);

                const canvas = document.createElement("canvas");
                drawTemplate(t.template, canvas);
                template.appendChild(canvas);

                const actions = document.createElement('div');
                actions.className = "template-actions";

                const progressBarContainer = document.createElement('div');
                progressBarContainer.className = 'progress-bar-container';

                const progressBar = document.createElement('div');
                progressBar.className = 'progress-bar';
                progressBar.style.width = `${percent}%`;

                const progressBarText = document.createElement('span');
                progressBarText.className = 'progress-bar-text';
                progressBarText.textContent = `${percent}% | ${t.status}`;

                if (t.status === "Finished." || t.status === "Finished") {
                    progressBar.classList.add('finished');
                } else if (!t.running) {
                    progressBar.classList.add('stopped');
                }

                progressBarContainer.appendChild(progressBar);
                progressBarContainer.appendChild(progressBarText);
                actions.appendChild(progressBarContainer);

                const buttonsRow = document.createElement('div');
                buttonsRow.className = "template-actions-row";

                const toggleButton = createToggleButton(t, id, buttonsRow, infoSpan.querySelector('.status-text'));
                buttonsRow.appendChild(toggleButton);

                // Preview
                const previewButton = document.createElement('button');
                previewButton.className = 'secondary-button button-templates';
                previewButton.innerHTML = '<img src="icons/eye.svg">Preview';
                previewButton.addEventListener('click', () => showManageTemplatePreview(t));
                buttonsRow.appendChild(previewButton);

                const editButton = document.createElement('button');
                editButton.className = 'secondary-button button-templates';
                editButton.innerHTML = '<img src="icons/settings.svg">Edit';
                editButton.addEventListener('click', () => {
                    pendingUserSelection = Array.isArray(t.userIds) ? t.userIds.map(String) : [];

                    openAddTemplate.click();
                    templateFormTitle.textContent = `Edit Template: ${t.name}`;
                    submitTemplate.innerHTML = '<img src="icons/edit.svg">Save Changes';
                    templateForm.dataset.editId = id;

                    templateName.value = t.name;
                    [tx.value, ty.value, px.value, py.value] = t.coords;
                    canBuyCharges.checked = t.canBuyCharges;
                    canBuyMaxCharges.checked = t.canBuyMaxCharges;
                    antiGriefMode.checked = t.antiGriefMode;
                    paintTransparent.checked = !!t.paintTransparentPixels;

                    setTimeout(() => {
                        document.querySelectorAll('input[name="user_checkbox"]').forEach(cb => {
                            cb.checked = t.userIds.includes(cb.value);
                        });
                    }, 0);
                });

                const delButton = document.createElement('button');
                delButton.className = 'destructive-button button-templates';
                delButton.innerHTML = '<img src="icons/remove.svg">Delete';
                delButton.addEventListener("click", () => {
                    showConfirmation(
                        "Delete Template",
                        `Are you sure you want to delete template "${t.name}"?`,
                        async () => {
                            try {
                                await axios.delete(`/template/${id}`);
                                openManageTemplates.click();
                            } catch (error) {
                                handleError(error);
                            }
                        }
                    );
                });

                buttonsRow.append(editButton, delButton);
                actions.appendChild(buttonsRow);

                infoSpan.appendChild(actions);
                templateList.append(template);
            }
            templateUpdateInterval = setInterval(updateTemplateStatus, 2000);
        });
    });

    changeTab(manageTemplates);
});




openSettings.addEventListener("click", async () => {
    try {
        const response = await axios.get('/settings');
        const currentSettings = response.data;

        // set mode preview selection (cards)
        setModeSelectionUI(currentSettings.drawingMethod);

        turnstileNotifications.checked = currentSettings.turnstileNotifications;
        accountCooldown.value = currentSettings.accountCooldown / 1000;
        purchaseCooldown.value = currentSettings.purchaseCooldown / 1000;
        accountCheckCooldown.value = (currentSettings.accountCheckCooldown || 0) / 1000;
        dropletReserve.value = currentSettings.dropletReserve;
        antiGriefStandby.value = currentSettings.antiGriefStandby / 60000;
        chargeThreshold.value = currentSettings.chargeThreshold * 100;
        alwaysDrawOnCharge.checked = !!currentSettings.alwaysDrawOnCharge;
        seedCountHidden.value = currentSettings.seedCount ?? 2;
        window.BURST_SEED_COUNT = currentSettings.seedCount ?? 2;
        // Show/hide the threshold input depending on the toggle
        chargeThresholdContainer.style.display = alwaysDrawOnCharge.checked ? 'none' : 'block';
        // init preview speed (local)
        const speed0 = parseFloat(localStorage.getItem('wplacer_preview_speed') || '1');
        if (previewSpeed) {
            previewSpeed.value = speed0;
            if (previewSpeedLabel) previewSpeedLabel.textContent = `${speed0}×`;
            if (typeof MODE_PREVIEW !== 'undefined' && MODE_PREVIEW.setSpeed) MODE_PREVIEW.setSpeed(speed0, { silent: true });
        }

        proxyEnabled.checked = !!currentSettings.proxyEnabled;
        proxyRotationMode.value = currentSettings.proxyRotationMode || 'sequential';
        logProxyUsage.checked = !!currentSettings.logProxyUsage;
        proxyCount.textContent = String(currentSettings.proxyCount ?? 0);
        proxyFormContainer.style.display = proxyEnabled.checked ? 'block' : 'none';

    } catch (error) {
        handleError(error);
    }
    changeTab(settings);
});

// helper: set UI selection for modes
function setModeSelectionUI(method) {
    document.querySelectorAll('.mode-card').forEach(card => {
        const mode = card.dataset.mode;
        if (!mode) return;
        if (mode === method) card.classList.add('selected'); else card.classList.remove('selected');
    });
}

// handle clicks on mode cards
document.addEventListener('click', async (e) => {
    const card = e.target.closest('.mode-card');
    if (!card || !card.dataset.mode) return;
    const mode = card.dataset.mode;

    if (card.classList.contains('selected')) {
        return;
    }
    setModeSelectionUI(mode);
    try {
        await axios.put('/settings', { drawingMethod: mode });
        showMessage("Success", `Drawing mode set to "${mode}".`);
    } catch (error) {
        handleError(error);
    }
});


// sync the hidden seedCount (in settings card) as well
if (seedCountHidden) {
    seedCountHidden.addEventListener('change', async () => {
        try {
            let n = parseInt(seedCountHidden.value, 10);
            if (!Number.isFinite(n) || n < 1) n = 1;
            if (n > 16) n = 16;
            seedCountHidden.value = n;
            await axios.put('/settings', { seedCount: n });
            window.BURST_SEED_COUNT = n;
            showMessage("Success", `Burst seed count updated to ${n}.`);
            if (typeof MODE_PREVIEW !== 'undefined' && MODE_PREVIEW.stopAll && MODE_PREVIEW.start) {
                MODE_PREVIEW.stopAll();
                document.querySelectorAll('.mode-preview[data-mode]').forEach(cv => MODE_PREVIEW.start(cv));
            }
        } catch (error) {
            handleError(error);
        }
    });
}


// Settings change events (remaining handlers — mostly unchanged)
turnstileNotifications.addEventListener('change', async () => {
    try {
        await axios.put('/settings', { turnstileNotifications: turnstileNotifications.checked });
        showMessage("Success", "Notification setting saved!");
    } catch (error) {
        handleError(error);
    }
});

accountCooldown.addEventListener('change', async () => {
    try {
        const newCooldown = parseInt(accountCooldown.value, 10) * 1000;
        if (isNaN(newCooldown) || newCooldown < 0) {
            showMessage("Error", "Please enter a valid non-negative number.");
            return;
        }
        await axios.put('/settings', { accountCooldown: newCooldown });
        showMessage("Success", "Account cooldown saved!");
    } catch (error) {
        handleError(error);
    }
});

purchaseCooldown.addEventListener('change', async () => {
    try {
        const newCooldown = parseInt(purchaseCooldown.value, 10) * 1000;
        if (isNaN(newCooldown) || newCooldown < 0) {
            showMessage("Error", "Please enter a valid non-negative number.");
            return;
        }
        await axios.put('/settings', { purchaseCooldown: newCooldown });
        showMessage("Success", "Purchase cooldown saved!");
    } catch (error) {
        handleError(error);
    }
});

accountCheckCooldown.addEventListener('change', async () => {
    try {
        const v = parseInt(accountCheckCooldown.value, 10) * 1000;
        if (isNaN(v) || v < 0) {
            showMessage("Error", "Please enter a valid non-negative number.");
            return;
        }
        await axios.put('/settings', { accountCheckCooldown: v });
        showMessage("Success", "Account check cooldown saved!");
    } catch (error) {
        handleError(error);
    }
});

dropletReserve.addEventListener('change', async () => {
    try {
        const newReserve = parseInt(dropletReserve.value, 10);
        if (isNaN(newReserve) || newReserve < 0) {
            showMessage("Error", "Please enter a valid non-negative number.");
            return;
        }
        await axios.put('/settings', { dropletReserve: newReserve });
        showMessage("Success", "Droplet reserve saved!");
    } catch (error) {
        handleError(error);
    }
});

antiGriefStandby.addEventListener('change', async () => {
    try {
        const newStandby = parseInt(antiGriefStandby.value, 10) * 60000;
        if (isNaN(newStandby) || newStandby < 60000) {
            showMessage("Error", "Please enter a valid number (at least 1 minute).");
            return;
        }
        await axios.put('/settings', { antiGriefStandby: newStandby });
        showMessage("Success", "Anti-grief standby time saved!");
    } catch (error) {
        handleError(error);
    }
});

chargeThreshold.addEventListener('change', async () => {
    try {
        const newThreshold = parseInt(chargeThreshold.value, 10);
        if (isNaN(newThreshold) || newThreshold < 1 || newThreshold > 100) {
            showMessage("Error", "Please enter a valid percentage between 1 and 100.");
            return;
        }
        await axios.put('/settings', { chargeThreshold: newThreshold / 100 });
        showMessage("Success", "Charge threshold saved!");
    } catch (error) {
        handleError(error);
    }
});

// alwaysDrawOnCharge toggle
alwaysDrawOnCharge.addEventListener('change', async () => {
    try {
        await axios.put('/settings', { alwaysDrawOnCharge: alwaysDrawOnCharge.checked });
        showMessage("Success", "Always-draw-on-charge setting saved!");
        // Hide the threshold input if immediate-draw is enabled, show otherwise
        chargeThresholdContainer.style.display = alwaysDrawOnCharge.checked ? 'none' : 'block';
    } catch (error) {
        handleError(error);
    }
});

// tx parsing helpers
tx.addEventListener('blur', () => {
    const raw = (tx.value || '').trim();

    // 1) URL format .../pixel/{tx}/{ty}?x={px}&y={py}
    const urlMatch = raw.match(/pixel\/(\d+)\/(\d+)\?x=(\d+)&y=(\d+)/i);
    if (urlMatch) {
        tx.value = urlMatch[1];
        ty.value = urlMatch[2];
        px.value = urlMatch[3];
        py.value = urlMatch[4];
        return;
    }

    // 2) Labeled format: (Tl X: XXXX, Tl Y: XXXX, Px X: XXX, Px Y: XXX)
    const cleaned = raw.replace(/[()]/g, '');
    const labeledMatch = cleaned.match(
        /Tl\s*X\s*:\s*(\d+)\s*,?\s*Tl\s*Y\s*:\s*(\d+)\s*,?\s*Px\s*X\s*:\s*(\d+)\s*,?\s*Px\s*Y\s*:\s*(\d+)/i
    );
    if (labeledMatch) {
        tx.value = labeledMatch[1];
        ty.value = labeledMatch[2];
        px.value = labeledMatch[3];
        py.value = labeledMatch[4];
        return;
    }

    // 3) Four numbers separated by non-digits
    const nums = cleaned.match(/\d+/g);
    if (nums && nums.length >= 4) {
        [tx.value, ty.value, px.value, py.value] = nums.slice(0, 4);
    } else {
        // fallback: strip non-digits
        tx.value = raw.replace(/[^0-9]/g, '');
    }
});

[ty, px, py].forEach(input => {
    input.addEventListener('blur', () => {
        input.value = input.value.replace(/[^0-9]/g, '');
    });
});

/// ===== Active templates bar (unchanged) =====
const activeTemplatesBar = $("activeTemplatesBar");
const activeTemplatesBarContent = $("activeTemplatesBarContent");

const drawTemplatePreview = (t, canvas) => {
    const maxSize = 56;
    const scale = Math.min(maxSize / t.width, maxSize / t.height, 1);
    const w = Math.max(1, Math.round(t.width * scale));
    const h = Math.max(1, Math.round(t.height * scale));
    const temp = document.createElement("canvas");
    temp.width = t.width;
    temp.height = t.height;
    drawTemplate(t, temp);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(temp, 0, 0, w, h);
    temp.remove();
};

async function refreshActiveBar() {
    try {
        const resp = await axios.get("/templates");
        const tpls = resp.data || {};
        const active = Object.entries(tpls).filter(([, t]) => t.running);

        activeTemplatesBarContent.innerHTML = "";
        if (active.length === 0) {
            activeTemplatesBar.classList.add("hidden");
            return;
        }
        activeTemplatesBar.classList.remove("hidden");

        for (const [id, t] of active) {
            const item = document.createElement("div");
            item.className = "active-item";

            const preview = document.createElement("canvas");
            drawTemplatePreview(t.template, preview);

            const meta = document.createElement("div");
            meta.className = "meta";

            const title = document.createElement("div");
            title.className = "title";
            title.textContent = t.name;

            const actions = document.createElement("div");
            actions.className = "actions";

            const stopBtn = document.createElement("button");
            stopBtn.className = "mini-btn destructive";
            stopBtn.innerHTML = '<img src="icons/pause.svg">Stop';
            stopBtn.addEventListener("click", async () => {
                try {
                    await axios.put(`/template/${id}`, { running: false });
                    showMessage("Success", `Template "${t.name}" stopped.`);
                } catch (e) {
                    handleError(e);
                } finally {
                    refreshActiveBar();
                    if (currentTab === manageTemplates) openManageTemplates.click();
                }
            });

            const editBtn = document.createElement("button");
            editBtn.className = "mini-btn";
            editBtn.innerHTML = '<img src="icons/settings.svg">Edit';
            editBtn.addEventListener("click", () => {
                pendingUserSelection = Array.isArray(t.userIds) ? t.userIds.map(String) : [];

                openAddTemplate.click();
                templateFormTitle.textContent = `Edit Template: ${t.name}`;
                submitTemplate.innerHTML = '<img src="icons/edit.svg">Save Changes';
                templateForm.dataset.editId = id;

                templateName.value = t.name;
                [tx.value, ty.value, px.value, py.value] = t.coords;
                canBuyCharges.checked = t.canBuyCharges;
                canBuyMaxCharges.checked = t.canBuyMaxCharges;
                antiGriefMode.checked = t.antiGriefMode;
                paintTransparent.checked = !!t.paintTransparentPixels;

                setTimeout(() => {
                    document.querySelectorAll('input[name="user_checkbox"]').forEach(cb => {
                        cb.checked = t.userIds.includes(cb.value);
                    });
                }, 0);
            });

            actions.appendChild(stopBtn);
            actions.appendChild(editBtn);

            meta.appendChild(title);
            meta.appendChild(actions);

            item.appendChild(preview);
            item.appendChild(meta);

            activeTemplatesBarContent.appendChild(item);
        }
    } catch (e) {
        console.warn("Failed to refresh active bar:", e);
    }
}

setInterval(refreshActiveBar, 5000);

const originalCreateToggleButton = createToggleButton;
createToggleButton = function (template, id, buttonsContainer, statusSpan) {
    const btn = originalCreateToggleButton(template, id, buttonsContainer, statusSpan);
    btn.addEventListener('click', () => setTimeout(refreshActiveBar, 300));
    return btn;
};

startAll.addEventListener('click', () => setTimeout(refreshActiveBar, 500));
stopAll.addEventListener('click', () => setTimeout(refreshActiveBar, 500));

openManageTemplates.addEventListener("click", () => setTimeout(refreshActiveBar, 300));
document.addEventListener("DOMContentLoaded", refreshActiveBar);


///// ==== Mode previews — MULTI SCENES with thumbnails (uses window.BURST_SEED_COUNT) ====
const MODE_PREVIEW = (() => {
    // ---------- helpers ----------
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    // preview speed (0.25–3), persists in localStorage
    let SPEED = parseFloat(localStorage.getItem('wplacer_preview_speed') || '1');

    function setSpeed(v, opts = {}) {
        const clip = (x, a, b) => Math.max(a, Math.min(b, Number(x) || 1));
        SPEED = clip(v, 0.25, 3);
        localStorage.setItem('wplacer_preview_speed', String(SPEED));
        if (!opts.silent) {
            // перезапускаем все превью
            document.querySelectorAll('.mode-preview[data-mode]').forEach(cv => { stop(cv); start(cv); });
            const ref = document.getElementById('modeReference');
            if (ref) drawReference(ref);
        }
    }

    // — кеш сидов для burst: сцена -> { seeds: [{x,y}], activeIdx: number }
    const BURST_SEEDS_CACHE = new Map();

    function getBurstSeeds(scene, k, points) {
        let entry = BURST_SEEDS_CACHE.get(scene.id);
        if (!entry || !entry.seeds || entry.seeds.length !== k) {
            // берём далеко разведённые сиды из точек сцены
            const seeds = pickSeedsFarApart(points, Math.max(1, k)).map(s => ({ x: s.x, y: s.y }));
            entry = {
                seeds,
                activeIdx: Math.floor(Math.random() * Math.max(1, seeds.length))
            };
            BURST_SEEDS_CACHE.set(scene.id, entry);
        }
        return entry;
    }

    // tiny pixel "painter"
    class Painter {
        constructor(w, h) { this.w = w; this.h = h; this.m = new Map(); }
        put(x, y, c) {
            if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.m.set(`${x},${y}`, { x, y, colorIdx: c });
        }
        rect(x0, y0, x1, y1, c) {
            for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.put(x, y, c);
        }
        circle(cx, cy, r, c) {
            for (let y = cy - r; y <= cy + r; y++)for (let x = cx - r; x <= cx + r; x++) {
                const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy <= r * r) this.put(x, y, c);
            }
        }
        ellipse(cx, cy, rx, ry, c) {
            for (let y = cy - ry; y <= cy + ry; y++)for (let x = cx - rx; x <= cx + rx; x++) {
                const dx = (x - cx) / rx, dy = (y - cy) / ry; if (dx * dx + dy * dy <= 1) this.put(x, y, c);
            }
        }
        tri(ax, ay, bx, by, cx, cy, col) {
            // bbox + barycentric fill
            const minx = Math.floor(Math.min(ax, bx, cx)), maxx = Math.ceil(Math.max(ax, bx, cx));
            const miny = Math.floor(Math.min(ay, by, cy)), maxy = Math.ceil(Math.max(ay, by, cy));
            const area = (x1, y1, x2, y2, x3, y3) => (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);
            const A = area(ax, ay, bx, by, cx, cy);
            for (let y = miny; y <= maxy; y++)for (let x = minx; x <= maxx; x++) {
                const a1 = area(x, y, bx, by, cx, cy) / A;
                const a2 = area(ax, ay, x, y, cx, cy) / A;
                const a3 = area(ax, ay, bx, by, x, y) / A;
                if (a1 >= 0 && a2 >= 0 && a3 >= 0) this.put(x, y, col);
            }
        }
        text(x, y, str, col, scale = 1) {
            const glyph = (ch) => FONT5x7[ch] || FONT5x7['?'];
            let cx = x;
            for (const ch of str.toUpperCase()) {
                const g = glyph(ch);
                for (let gy = 0; gy < g.length; gy++) {
                    for (let gx = 0; gx < g[gy].length; gx++) {
                        if (g[gy][gx] === '1') {
                            for (let sy = 0; sy < scale; sy++)for (let sx = 0; sx < scale; sx++)
                                this.put(cx + gx * scale + sx, y + gy * scale + sy, col);
                        }
                    }
                }
                cx += (5 * scale + 1); // width + 1px spacing
            }
        }
        toArray() { return Array.from(this.m.values()); }
    }

    // Minimal 5x7 glyphs (only what we need)
    const FONT5x7 = {
        'A': ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
        'C': ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
        'D': ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
        'E': ["11111", "10000", "11110", "10000", "10000", "10000", "11111"],
        'I': ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
        'L': ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
        'M': ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
        'O': ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
        'P': ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
        'R': ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
        'V': ["10001", "10001", "10001", "10001", "01010", "01010", "00100"],
        'W': ["10001", "10001", "10101", "10101", "10101", "11011", "10001"],
        'X': ["10001", "01010", "00100", "00100", "00100", "01010", "10001"],
        'Z': ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
        ' ': ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
        '?': ["01110", "10001", "00010", "00100", "00100", "00000", "00100"]
    };

    // ---------- scenes ----------
    // each preset: { id, name, w, h, palette[], build() -> points[] }
    const SCENES = [
        // 1) Space — 30x18, 4 clr
        (() => {
            const pal = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db']; // r,y,g,b
            const w = 30, h = 18;
            const build = () => {
                const p = new Painter(w, h);

                // Planet (blue)
                const pcx = 9, pcy = 9, R = 6; p.circle(pcx, pcy, R, 3);
                // Ring (yellow)
                const a = R + 3, b = R - 1;
                for (let x = pcx - a - 3; x <= pcx + a + 3; x++) {
                    const dx = x - pcx;
                    const y = Math.round(pcy + (dx * 0.3));
                    for (let yy = -b - 2; yy <= b + 2; yy++) {
                        const val = (dx * dx) / (a * a) + (yy * yy) / (b * b);
                        if (val > 0.95 && val < 1.12) p.put(x, y + yy, 1);
                    }
                }
                p.circle(pcx - 2, pcy + 0, 2, 2);
                p.circle(pcx + 2, pcy - 2, 2, 2);

                // Rocket (red)
                const rx = 21, ry = 5;
                for (let i = 0; i < 3; i++) for (let j = 0; j <= i; j++) p.put(rx + j, ry + i, 0);
                for (let yy = 0; yy < 7; yy++) for (let xx = 0; xx < 3; xx++) p.put(rx + 1 + xx, ry + 2 + yy, 0);
                p.put(rx + 2, ry + 4, 3); p.put(rx + 2, ry + 6, 3);
                p.put(rx + 1, ry + 8, 0); p.put(rx + 4, ry + 8, 0); p.put(rx + 0, ry + 9, 0); p.put(rx + 5, ry + 9, 0);
                for (let i = 0; i < 3; i++) for (let j = -i; j <= i; j++) p.put(rx + 3 + j, ry + 9 + i, 1);

                [[2, 2], [5, 14], [14, 2], [27, 14], [24, 3], [18, 15]].forEach(([sx, sy]) => p.put(sx, sy, 1));

                return p.toArray();
            };
            return { id: 1, name: 'Space', w, h, palette: pal, build };
        })(),

        // 2) Portrait 150x90
        (() => {
            const pal = ['#3d2b1f', '#7a5b3a', '#d8b08c', '#5b7f3a']; // hair, dress, skin, bg green
            const w = 150, h = 90;
            const build = () => {
                const p = new Painter(w, h);
                p.rect(6, 6, w - 7, h - 7, 3);

                p.ellipse(80, 75, 45, 18, 1);
                p.rect(40, 62, 120, 88, 1);
                p.ellipse(78, 42, 22, 28, 2);
                p.ellipse(78, 40, 28, 34, 0);
                for (let y = 10; y < 75; y++) {
                    for (let x = 0; x < w; x++) {
                        const dx = (x - 78) / 22, dy = (y - 42) / 28;
                        if (dx * dx + dy * dy <= 1) p.put(x, y, 2);
                    }
                }

                p.rect(70, 42, 71, 43, 0);
                p.rect(85, 42, 86, 43, 0);
                p.rect(76, 51, 80, 52, 0);

                for (let i = 0; i < 6; i++) {
                    p.rect(6 + i, 6 + i, w - 7 - i, 6 + i, 0);
                    p.rect(6 + i, h - 7 - i, w - 7 - i, h - 7 - i, 0);
                    p.rect(6 + i, 6 + i, 6 + i, h - 7 - i, 0);
                    p.rect(w - 7 - i, 6 + i, w - 7 - i, h - 7 - i, 0);
                }
                return p.toArray();
            };
            return { id: 2, name: 'Portrait', w, h, palette: pal, build };
        })(),

        // 3) Typo Art — 84x16
        (() => {
            const pal = ['#ffffff', '#ffcc00', '#00c896', '#333333']; // white, yellow, teal, dark bg
            const w = 84, h = 16;
            const build = () => {
                const p = new Painter(w, h);
                p.rect(0, 0, w - 1, h - 1, 3);
                p.text(2, 3, 'WPLACER', 0, 2);
                for (let x = 2; x < w - 2; x++) if (x % 2 === 0) p.put(x, 14, 1);
                p.rect(w - 9, 2, w - 6, 5, 1);
                p.rect(w - 9, 7, w - 6, 10, 2);
                return p.toArray();
            };
            return { id: 3, name: 'Typo', w, h, palette: pal, build };
        })(),

        // 4) Landscape — 40x24
        (() => {
            const pal = ['#f5d76e', '#7f8fa6', '#273c75', '#4cd7f6']; // sun, mountains, deep, water
            const w = 40, h = 24;
            const build = () => {
                const p = new Painter(w, h);
                p.rect(0, 14, w - 1, h - 1, 3);
                for (let x = 0; x < w; x++) if ((x % 3) === 0) p.put(x, 16, 0);

                p.tri(4, 14, 14, 14, 9, 6, 1);
                p.tri(12, 14, 28, 14, 20, 4, 1);
                p.tri(24, 14, 39, 14, 31, 7, 2);

                p.circle(6, 4, 3, 0);
                return p.toArray();
            };
            return { id: 4, name: 'Landscape', w, h, palette: pal, build };
        })(),

        // 5) Dungeon — 28x28
        (() => {
            const pal = ['#c0392b', '#ecf0f1', '#7f8c8d', '#2c3e50']; // fire, light, stone, dark
            const w = 28, h = 28;
            const build = () => {
                const p = new Painter(w, h);
                p.rect(0, 0, w - 1, 0, 2); p.rect(0, h - 1, w - 1, h - 1, 2);
                p.rect(0, 0, 0, h - 1, 2); p.rect(w - 1, 0, w - 1, h - 1, 2);

                for (let y = 2; y < h - 2; y++) {
                    for (let x = 2; x < w - 2; x++) {
                        if (((x + y) & 1) === 0) p.put(x, y, 3);
                    }
                }

                p.rect(w / 2 - 2, h - 6, w / 2 + 2, h - 2, 2);
                p.rect(w / 2 - 1, h - 5, w / 2 + 1, h - 3, 1);

                p.rect(3, 6, 4, 12, 2); p.rect(w - 6, 6, w - 5, 12, 2);
                p.rect(4, 6, 5, 7, 0); p.rect(w - 6, 6, w - 5, 7, 0);
                p.put(5, 7, 1); p.put(w - 6, 7, 1);
                return p.toArray();
            };
            return { id: 5, name: 'Dungeon', w, h, palette: pal, build };
        })(),

        // 6) Emblem — 64x32
        (() => {
            const pal = ['#2ecc71', '#e74c3c', '#f1c40f', '#34495e']; // green, red, yellow, dark
            const w = 64, h = 32;
            const build = () => {
                const p = new Painter(w, h);
                p.ellipse(w / 2, h / 2 - 2, 20, 12, 3);
                p.ellipse(w / 2, h / 2 - 2, 18, 10, 0);
                for (let i = 0; i < 8; i++) p.tri(w / 2 - 2 - i, h / 2 + 6 + i, w / 2 + 2 + i, h / 2 + 6 + i, w / 2, h / 2 + 12 + i, 0);

                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        if (((x + y) % 7) === 0) p.put(x, y, 1);
                        if (((x + y + 3) % 11) === 0) p.put(x, y, 2);
                    }
                }

                p.ellipse(w / 2, h / 2 - 2, 20, 12, 3);
                return p.toArray();
            };
            return { id: 6, name: 'Emblem', w, h, palette: pal, build };
        })(),
    ];

    // ---------- ordering ----------
    function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a; }
    function orderByLinear(target, axis, reversed = false) {
        const arr = target.slice();
        arr.sort((a, b) => {
            if (axis === 'y') { if (a.y !== b.y) return reversed ? b.y - a.y : a.y - b.y; return a.x - b.x; }
            else { if (a.x !== b.x) return reversed ? b.x - a.x : a.x - b.x; return a.y - b.y; }
        });
        return arr;
    }
    function groupByColor(target) { const m = new Map(); for (const p of target) { if (!m.has(p.colorIdx)) m.set(p.colorIdx, []); m.get(p.colorIdx).push(p); } return m; }
    function orderByColor(target, random = false) {
        const g = groupByColor(target), keys = Array.from(g.keys());
        if (random) { keys.sort(); const perm = [2, 0, 3, 1, 4, 5, 6, 7]; const picked = perm.map(i => keys[i]).filter(v => v !== undefined); while (picked.length < keys.length) picked.push(keys[picked.length]); return picked.flatMap(k => orderByLinear(g.get(k), 'y', false)); }
        return keys.sort().flatMap(k => orderByLinear(g.get(k), 'y', false));
    }
    function pickSeedsFarApart(target, k = 2) {
        if (!target.length) return [];
        let bi = 0, bj = 0, best = -1;
        for (let i = 0; i < target.length; i++)for (let j = i + 1; j < target.length; j++) {
            const dx = target[i].x - target[j].x, dy = target[i].y - target[j].y, d2 = dx * dx + dy * dy;
            if (d2 > best) { best = d2; bi = i; bj = j; }
        }
        const seeds = [target[bi]]; if (target.length > 1) seeds.push(target[bj]);
        while (seeds.length < Math.min(k, target.length)) {
            let pick = null, bestMin = -1;
            for (const p of target) {
                const md = Math.min(...seeds.map(s => (s.x - p.x) ** 2 + (s.y - p.y) ** 2));
                if (md > bestMin) { bestMin = md; pick = p; }
            }
            if (!pick) break; seeds.push(pick);
        }
        return seeds.slice(0, k);
    }
    function orderByBurst(target, seedCount = 2) {
        if (!target.length) return [];

        const byKey = new Map(target.map(p => [`${p.x},${p.y}`, p]));

        const seeds = pickSeedsFarApart(target, Math.max(1, seedCount | 0));

        const nearest = (sx, sy) => {
            let best = null, bestD = Infinity;
            for (const p of target) {
                const d2 = (p.x - sx) ** 2 + (p.y - sy) ** 2;
                if (d2 < bestD) { bestD = d2; best = p; }
            }
            return best;
        };

        const starts = seeds.map(s => nearest(s.x, s.y)).filter(Boolean);

        const visited = new Set();
        const queues = [];
        const speeds = [];
        const prefs = [];

        const randDir = () => [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];

        for (const sp of starts) {
            const k = `${sp.x},${sp.y}`;
            if (!visited.has(k)) {
                visited.add(k);
                queues.push([sp]);
                speeds.push(0.7 + Math.random() * 1.1); // 0.7..1.8
                prefs.push(randDir());
            }
        }

        const pickQueue = () => {
            const w = speeds.map((s, i) => queues[i].length ? s : 0);
            const sum = w.reduce((a, b) => a + b, 0);
            if (!sum) return -1;
            let r = Math.random() * sum;
            for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
            return w.findIndex(x => x > 0);
        };

        const orderNeighbors = (dir) => {
            const base = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            base.sort((a, b) =>
                (b[0] * dir[0] + b[1] * dir[1] + (Math.random() - 0.5) * 0.2) -
                (a[0] * dir[0] + a[1] * dir[1] + (Math.random() - 0.5) * 0.2)
            );
            return base;
        };

        const dash = (from, qi, dir) => {
            const dashChance = 0.45;
            const maxDash = 1 + Math.floor(Math.random() * 3);
            if (Math.random() > dashChance) return;
            let cx = from.x, cy = from.y;
            for (let step = 0; step < maxDash; step++) {
                const nx = cx + dir[0], ny = cy + dir[1];
                const key = `${nx},${ny}`;
                if (!byKey.has(key) || visited.has(key)) break;
                visited.add(key);
                queues[qi].push(byKey.get(key));
                cx = nx; cy = ny;
            }
        };

        const out = [];

        while (true) {
            const qi = pickQueue();
            if (qi === -1) break;

            const cur = queues[qi].shift();
            out.push(cur);

            const neigh = orderNeighbors(prefs[qi]);
            let firstDir = null, firstPt = null;

            for (const [dx, dy] of neigh) {
                const nx = cur.x + dx, ny = cur.y + dy;
                const k = `${nx},${ny}`;
                if (byKey.has(k) && !visited.has(k)) {
                    visited.add(k);
                    const p = byKey.get(k);
                    queues[qi].push(p);
                    if (!firstDir) { firstDir = [dx, dy]; firstPt = p; }
                }
            }

            if (firstDir) {
                if (Math.random() < 0.85) prefs[qi] = firstDir;
                dash(firstPt, qi, prefs[qi]);
            }
        }

        if (out.length < target.length) {
            for (const p of target) {
                const k = `${p.x},${p.y}`;
                if (!visited.has(k)) {
                    visited.add(k);
                    const q = [p];
                    while (q.length) {
                        const c = q.shift();
                        out.push(c);
                        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => Math.random() - 0.5)) {
                            const nx = c.x + dx, ny = c.y + dy, kk = `${nx},${ny}`;
                            if (byKey.has(kk) && !visited.has(kk)) { visited.add(kk); q.push(byKey.get(kk)); }
                        }
                    }
                }
            }
        }

        return out;
    }


    function orderByRadialInward(target, w, h) {
        const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
        const r2 = (p) => (p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy);
        const ang = (p) => Math.atan2(p.y - cy, p.x - cx);
        const arr = target.slice();
        arr.sort((a, b) => { const d = r2(b) - r2(a); return d !== 0 ? d : (ang(a) - ang(b)); });
        return arr;
    }
    function orderByColorsBurstRare(target, seedCount) {
        const g = groupByColor(target);
        const colorsAsc = Array.from(g.keys()).sort((a, b) => g.get(a).length - g.get(b).length);
        const out = []; for (const c of colorsAsc) out.push(...orderByBurst(g.get(c), seedCount));
        return out;
    }

    function orderByOutlineThenBurst(target, seedCount) {
        const cmap = new Map(target.map(p => [`${p.x},${p.y}`, p.colorIdx]));
        const isOutline = (p) => {
            const neigh = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [dx, dy] of neigh) {
                const nx = p.x + dx, ny = p.y + dy;
                const key = `${nx},${ny}`;
                if (!cmap.has(key) || cmap.get(key) !== p.colorIdx) return true;
            }
            return false;
        };

        const outline = [], inside = [];
        for (const p of target) (isOutline(p) ? outline : inside).push(p);

        return [...orderByBurst(outline, seedCount), ...orderByBurst(inside, seedCount)];
    }

    function baseOrderForMode(mode, target, scene) {
        switch (mode) {
            case 'linear': return orderByLinear(target, 'y', false);
            case 'linear-reversed': return orderByLinear(target, 'y', true);
            case 'linear-ltr': return orderByLinear(target, 'x', false);
            case 'linear-rtl': return orderByLinear(target, 'x', true);
            case 'singleColorRandom': return orderByColor(target, true);
            case 'colorByColor': return orderByColor(target, false);
            case 'random': return shuffle(target);
            case 'burst':
                return orderByBurst(target, window.BURST_SEED_COUNT || 2);
            case 'radial-inward':
                return orderByRadialInward(target, scene.w, scene.h);
            case 'colors-burst-rare':
                return orderByColorsBurstRare(target, window.BURST_SEED_COUNT || 2);
            case 'outline-then-burst':
                return orderByOutlineThenBurst(target, window.BURST_SEED_COUNT || 2);
            default:
                return shuffle(target);
        }
    }

    function orderForMode(mode, target, scene) {
        // для всех обычных режимов — как раньше
        if (mode !== 'burst-mixed') return baseOrderForMode(mode, target, scene);

        // ▼ для burst-mixed: делим рисунок на сегменты; каждый сегмент — новый случайный подрежим
        const pool = ['outline-then-burst', 'burst', 'colors-burst-rare'];

        // храним оставшиеся точки, чтобы не рисовать одну и ту же
        const remaining = new Map(target.map(p => [`${p.x},${p.y}`, p]));
        const out = [];

        // размер сегмента — ~10% от кадра, но не меньше 40 пикселей
        const segSize = Math.max(40, Math.floor(target.length * 0.10));

        while (remaining.size) {
            const pick = pool[Math.floor(Math.random() * pool.length)];
            // строим порядок для текущих оставшихся точек выбранным подрежимом
            const ordered = baseOrderForMode(pick, Array.from(remaining.values()), scene);

            const take = Math.min(segSize, ordered.length);
            for (let i = 0; i < take; i++) {
                const p = ordered[i];
                const key = `${p.x},${p.y}`;
                if (remaining.has(key)) { // на случай дублей
                    out.push(p);
                    remaining.delete(key);
                }
            }
        }
        return out;
    }


    // ---------- drawing ----------
    let currentIndex = clamp(parseInt(localStorage.getItem('wplacer_preview_scene') || '1', 10) - 1, 0, SCENES.length - 1);
    let currentScene = null;
    const sceneCache = new Map(); // id -> {points, palette}

    function getScene(i) {
        const sc = SCENES[i];
        if (!sceneCache.has(sc.id)) {
            sceneCache.set(sc.id, { points: sc.build(), palette: sc.palette, w: sc.w, h: sc.h });
        }
        const entry = sceneCache.get(sc.id);
        return { ...sc, points: entry.points, palette: entry.palette };
    }

    function fillPoints(ctx, cell, scene, points) {
        for (const p of points) {
            ctx.fillStyle = scene.palette[p.colorIdx % scene.palette.length];
            ctx.fillRect(p.x * cell, p.y * cell, cell, cell);
        }
    }

    function drawThumb(canvas, scene) {
        const ctx = canvas.getContext('2d');

        const cssW = canvas.clientWidth || 38;
        const cssH = canvas.clientHeight || 26;
        canvas.width = cssW;
        canvas.height = cssH;

        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, cssW, cssH);

        const cell = Math.max(1, Math.floor(Math.min(cssW / scene.w, cssH / scene.h)));
        const w = cell * scene.w;
        const h = cell * scene.h;
        const offx = Math.floor((cssW - w) / 2);
        const offy = Math.floor((cssH - h) / 2);

        const tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        const tctx = tmp.getContext('2d'); tctx.imageSmoothingEnabled = false;

        fillPoints(tctx, cell, scene, scene.points);
        ctx.drawImage(tmp, offx, offy);
    }

    function redrawThumbs() {
        const wrap = document.getElementById('presetSwitcher');
        if (!wrap) return;
        wrap.querySelectorAll('.preset-btn').forEach(btn => {
            const idx = parseInt(btn.dataset.index, 10);
            const cv = btn.querySelector('canvas');
            if (cv) drawThumb(cv, getScene(idx));
        });
    }
    window.addEventListener('resize', redrawThumbs);

    function drawReference(canvas) {
        ensureUI();
        currentScene = getScene(currentIndex);
        const ctx = canvas.getContext('2d');
        const cell = Math.max(1, Math.floor(Math.min(canvas.width / currentScene.w, canvas.height / currentScene.h)));
        const w = cell * currentScene.w, h = cell * currentScene.h;
        canvas.width = w; canvas.height = h;
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h);
        fillPoints(ctx, cell, currentScene, currentScene.points);
    }

    const previews = new Map(); // canvas -> timers

    function stop(canvas) {
        const st = previews.get(canvas);
        if (!st) return;
        if (st.intervalId) clearInterval(st.intervalId);
        if (st.restartTimeoutId) clearTimeout(st.restartTimeoutId);
        previews.delete(canvas);
    }
    function stopAll() {
        for (const [, st] of previews) {
            if (st.intervalId) clearInterval(st.intervalId);
            if (st.restartTimeoutId) clearTimeout(st.restartTimeoutId);
        }
        previews.clear();
    }
    function start(canvas) {
        stop(canvas);
        if (!currentScene) currentScene = getScene(currentIndex);
        const scene = currentScene;

        const ctx = canvas.getContext('2d');
        const baseW = canvas.width, baseH = canvas.height;
        const cell = Math.max(1, Math.floor(Math.min(baseW / scene.w, baseH / scene.h)));
        const w = cell * scene.w, h = cell * scene.h;
        canvas.width = w; canvas.height = h;
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h);

        const mode = canvas.dataset.mode;
        const ordered = orderForMode(mode, scene.points, scene);

        const baseStep = Math.max(4, Math.floor((scene.w * scene.h) / 400));
        const stepPerTick = Math.max(1, Math.floor(baseStep * SPEED));
        const intervalMs = Math.max(16, Math.floor(60 / SPEED));

        let i = 0;
        const intervalId = setInterval(() => {
            for (let s = 0; s < stepPerTick && i < ordered.length; s++, i++) {
                const p = ordered[i];
                ctx.fillStyle = scene.palette[p.colorIdx % scene.palette.length];
                ctx.fillRect(p.x * cell, p.y * cell, cell, cell);
            }
            if (i >= ordered.length) {
                clearInterval(intervalId);

                if (mode === 'burst') {
                    const desired = window.BURST_SEED_COUNT || 2;
                    const entry = getBurstSeeds(scene, desired, scene.points);
                    entry.activeIdx = (entry.activeIdx + 1) % Math.max(1, entry.seeds.length);
                    BURST_SEEDS_CACHE.set(scene.id, entry);
                }

                const restartTimeoutId = setTimeout(() => start(canvas), 700);
                previews.set(canvas, { intervalId: null, restartTimeoutId });
            }
        }, intervalMs);

        previews.set(canvas, { intervalId, restartTimeoutId: null });
    }


    function updateSelectedBtn() {
        const wrap = document.getElementById('presetSwitcher');
        if (!wrap) return;
        wrap.querySelectorAll('.preset-btn').forEach((btn, idx) => {
            if (idx === currentIndex) btn.classList.add('selected'); else btn.classList.remove('selected');
        });
    }
    function ensureUI() {
        const wrap = document.getElementById('presetSwitcher');
        if (!wrap || wrap.dataset.ready === '1') return;

        SCENES.forEach((sc, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'preset-btn';
            btn.dataset.index = String(idx);

            const thumb = document.createElement('canvas');
            thumb.className = 'preset-thumb';
            thumb.width = thumb.clientWidth || 38; thumb.height = thumb.clientHeight || 26;

            const label = document.createElement('span');
            label.className = 'preset-label';
            label.textContent = String(idx + 1);

            btn.appendChild(thumb);
            btn.appendChild(label);
            btn.addEventListener('click', () => {
                setScene(idx);
            });
            wrap.appendChild(btn);

            drawThumb(thumb, getScene(idx));
        });

        wrap.dataset.ready = '1';
        updateSelectedBtn();
    }

    function setScene(idx) {
        currentIndex = clamp(idx, 0, SCENES.length - 1);
        localStorage.setItem('wplacer_preview_scene', String(currentIndex + 1));
        currentScene = getScene(currentIndex);
        updateSelectedBtn();

        const ref = document.getElementById('modeReference');
        if (ref) drawReference(ref);

        document.querySelectorAll('.mode-preview[data-mode]').forEach(cv => {
            stop(cv); start(cv);
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        ensureUI();
        const ref = document.getElementById('modeReference');
        if (ref) drawReference(ref);
    });

    return { start, stopAll, drawReference, setScene, ensureUI, drawThumb, redrawThumbs, setSpeed };
})();

// --- Proxy toggles & actions ---
proxyEnabled?.addEventListener('change', async () => {
    try {
        await axios.put('/settings', { proxyEnabled: proxyEnabled.checked });
        proxyFormContainer.style.display = proxyEnabled.checked ? 'block' : 'none';
        showMessage("Success", "Proxy setting saved!");
    } catch (error) { handleError(error); }
});

proxyRotationMode?.addEventListener('change', async () => {
    try {
        await axios.put('/settings', { proxyRotationMode: proxyRotationMode.value });
        showMessage("Success", "Proxy rotation mode saved!");
    } catch (error) { handleError(error); }
});

logProxyUsage?.addEventListener('change', async () => {
    try {
        await axios.put('/settings', { logProxyUsage: logProxyUsage.checked });
        showMessage("Success", "Proxy logging setting saved!");
    } catch (error) { handleError(error); }
});

reloadProxiesBtn?.addEventListener('click', async () => {
    try {
        reloadProxiesBtn.disabled = true;
        reloadProxiesBtn.textContent = "Reloading...";
        const { data } = await axios.post('/reload-proxies', {});
        if (data && typeof data.count === 'number') {
            proxyCount.textContent = String(data.count);
        }
        showMessage("Success", "Proxies reloaded successfully!");
    } catch (error) {
        handleError(error);
    } finally {
        reloadProxiesBtn.disabled = false;
        reloadProxiesBtn.textContent = "Reload proxies.txt";
    }
});
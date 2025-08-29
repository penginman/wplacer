// --- Constants ---
const POLL_ALARM_NAME = 'wplacer-poll-alarm';
const COOKIE_ALARM_NAME = 'wplacer-cookie-alarm';

// --- Core Functions ---
const getSettings = async () => {
    const result = await chrome.storage.local.get(['wplacerPort']);
    return {
        port: result.wplacerPort || 80,
        host: '127.0.0.1'
    };
};

const getServerUrl = async (path = '') => {
    const { host, port } = await getSettings();
    return `http://${host}:${port}${path}`;
};

let LP_ACTIVE = false;
let TOKEN_IN_PROGRESS = false;
let LAST_RELOAD_AT = 0;
const MIN_RELOAD_INTERVAL_MS = 5000;

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function startLongPoll() {
    if (LP_ACTIVE) return;
    LP_ACTIVE = true;
    while (LP_ACTIVE) {
        try {
            const url = await getServerUrl("/token-needed/long");
            const r = await fetch(url, { cache: "no-store" });
            if (r.ok) {
                const data = await r.json();
                if (data.needed) await maybeInitiateReload();
            } else {
                await wait(1000);
            }
        } catch (_) {
            await wait(2000);
        }
    }
}


// --- Token Refresh Logic ---
const pollForTokenRequest = async () => {
    console.log("wplacer: Polling server for token request...");
    try {
        const url = await getServerUrl("/token-needed");
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`wplacer: Server poll failed with status: ${response.status}`);
            return;
        }
        const data = await response.json();
        if (data.needed) {
            console.log("wplacer: Server requires a token. Initiating reload.");
            await initiateReload();
        }
    } catch (error) {
        console.error("wplacer: Could not connect to the server to poll for tokens.", error.message);
    }
};

const maybeInitiateReload = async () => {
    const now = Date.now();
    if (TOKEN_IN_PROGRESS) return;
    if (now - LAST_RELOAD_AT < MIN_RELOAD_INTERVAL_MS) return;
    TOKEN_IN_PROGRESS = true;
    await initiateReload();
    LAST_RELOAD_AT = Date.now();
};

const initiateReload = async () => {
    try {
        let tabs = await chrome.tabs.query({ url: "https://wplace.live/*" });
        if (!tabs || tabs.length === 0) {
            console.warn("wplacer: No wplace.live tabs found. Opening a new one for token acquisition.");
            const created = await chrome.tabs.create({ url: "https://wplace.live/" });
            tabs = [created];
        }
        const targetTab = tabs.find(t => t.active) || tabs[0];
        console.log(`wplacer: Sending reload command to tab #${targetTab.id}`);
        await chrome.tabs.sendMessage(targetTab.id, { action: "reloadForToken" });
    } catch (error) {
        console.error("wplacer: Error sending reload message to tab, falling back to direct reload.", error);
        const tabs = await chrome.tabs.query({ url: "https://wplace.live/*" });
        if (tabs && tabs.length > 0) {
            chrome.tabs.reload((tabs.find(t => t.active) || tabs[0]).id);
        } else {
            await chrome.tabs.create({ url: "https://wplace.live/" });
        }
    }
};

// --- User/Cookie Management ---
const sendCookie = async (callback) => {
    const getCookie = (details) => new Promise(resolve => chrome.cookies.get(details, cookie => resolve(cookie)));

    const [jCookie, sCookie] = await Promise.all([
        getCookie({ url: "https://backend.wplace.live", name: "j" }),
        getCookie({ url: "https://backend.wplace.live", name: "s" })
    ]);

    if (!jCookie) {
        if (callback) callback({ success: false, error: "Cookie 'j' not found. Are you logged in?" });
        return;
    }

    const cookies = { j: jCookie.value };
    if (sCookie) cookies.s = sCookie.value;
    const url = await getServerUrl("/user");

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cookies, expirationDate: jCookie.expirationDate })
        });
        if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);
        const userInfo = await response.json();
        if (callback) callback({ success: true, name: userInfo.name });
    } catch (error) {
        if (callback) callback({ success: false, error: "Could not connect to the wplacer server." });
    }
};

const quickLogout = (callback) => {
    const origin = "https://backend.wplace.live/";
    console.log(`wplacer: Clearing browsing data for ${origin}`);
    chrome.browsingData.remove({
        origins: [origin]
    }, {
        cache: true,
        cookies: true,
        fileSystems: true,
        indexedDB: true,
        localStorage: true,
        pluginData: true,
        serviceWorkers: true,
        webSQL: true
    }, () => {
        if (chrome.runtime.lastError) {
            console.error("wplacer: Error clearing browsing data.", chrome.runtime.lastError);
            if (callback) callback({ success: false, error: "Failed to clear data." });
        } else {
            console.log("wplacer: Browsing data cleared successfully. Reloading wplace.live tabs.");
            chrome.tabs.query({ url: "https://wplace.live/*" }, (tabs) => {
                if (tabs && tabs.length > 0) {
                    tabs.forEach(tab => chrome.tabs.reload(tab.id));
                }
            });
            if (callback) callback({ success: true });
        }
    });
};

// --- Event Listeners ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sendCookie") {
        sendCookie(sendResponse);
        return true;
    }
    if (request.action === "quickLogout") {
        quickLogout(sendResponse);
        return true;
    }
    if (request.action === "settingsUpdated") {
        LP_ACTIVE = false;
        setTimeout(startLongPoll, 100);
        if (sendResponse) sendResponse({ ok: true });
        return false;
    }
    if (request.type === "SEND_TOKEN") {
        getServerUrl("/t").then(url => {
            fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ t: request.token })
            });
        });
        // token отправлен — следующий триггер разрешён
        TOKEN_IN_PROGRESS = false;
        LAST_RELOAD_AT = Date.now();
    }
    return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.startsWith("https://wplace.live")) {
        console.log("wplacer: wplace.live tab loaded. Sending cookie.");
        sendCookie(response => console.log(`wplacer: Cookie send status: ${response.success ? 'Success' : 'Failed'}`));
    }
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === COOKIE_ALARM_NAME) {
        console.log("wplacer: Periodic alarm triggered. Sending cookie.");
        sendCookie(response => console.log(`wplacer: Periodic cookie refresh: ${response.success ? 'Success' : 'Failed'}`));
    } else if (alarm.name === POLL_ALARM_NAME) {
        // keep-alive and ensure long-poll is running, then do a quick poll as fallback
        if (!LP_ACTIVE) startLongPoll();
        pollForTokenRequest();
    }
});

// --- Initialization ---
const initializeAlarms = () => {
    // Poll for token requests every 45 seconds. This is the main keep-alive for the service worker.
    chrome.alarms.create(POLL_ALARM_NAME, {
        delayInMinutes: 0.1,
        periodInMinutes: 0.75 // 45 seconds
    });
    // Refresh cookies less frequently.
    chrome.alarms.create(COOKIE_ALARM_NAME, {
        delayInMinutes: 1,
        periodInMinutes: 20
    });
    console.log("wplacer: Alarms initialized.");
};

chrome.runtime.onStartup.addListener(() => {
    console.log("wplacer: Browser startup.");
    initializeAlarms();
    startLongPoll();
});

chrome.runtime.onInstalled.addListener(() => {
    console.log("wplacer: Extension installed/updated.");
    initializeAlarms();
    startLongPoll();
});

// Ensure long-poll starts promptly even if service worker is spun up outside of startup/installed
startLongPoll();
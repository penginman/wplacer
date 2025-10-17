document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('status');
    const hostInput = document.getElementById('host');
    const portInput = document.getElementById('port');
    const autoReloadInput = document.getElementById('autoReloadInterval');
    const saveBtn = document.getElementById('saveSettingsBtn');
    const sendCookieBtn = document.getElementById('sendCookieBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    let initialHost = '127.0.0.1';
    let initialPort = 80;
    let initialAutoReload = 0;

    const sanitizeHostValue = (value) => {
        const result = { host: '', empty: false, invalid: false, hadPort: false, portFromHost: null };
        if (value === undefined || value === null) {
            result.empty = true;
            return result;
        }

        let host = String(value).trim();
        if (!host) {
            result.empty = true;
            return result;
        }

        host = host.replace(/^https?:\/\//i, '').trim();
        if (host.includes('/')) {
            host = host.split('/')[0].trim();
        }

        if (!host) {
            result.invalid = true;
            return result;
        }

        if (/\s/.test(host)) {
            result.invalid = true;
            return result;
        }

        if (host.startsWith('[')) {
            const closingIndex = host.indexOf(']');
            const normalizedHost = closingIndex === -1 ? `${host}]` : host.slice(0, closingIndex + 1);
            const remainder = closingIndex === -1 ? '' : host.slice(closingIndex + 1).trim();

            if (remainder) {
                if (remainder.startsWith(':')) {
                    result.hadPort = true;
                    const candidatePort = Number.parseInt(remainder.slice(1), 10);
                    if (Number.isInteger(candidatePort)) {
                        result.portFromHost = candidatePort;
                    }
                } else {
                    result.invalid = true;
                    return result;
                }
            }

            result.host = normalizedHost;
            return result;
        }

        const colonMatches = host.match(/:/g) || [];
        if (colonMatches.length === 1) {
            const [baseHost, portCandidate] = host.split(':');
            result.hadPort = true;
            const candidatePort = Number.parseInt(portCandidate, 10);
            if (Number.isInteger(candidatePort)) {
                result.portFromHost = candidatePort;
            }
            host = baseHost;
        } else if (colonMatches.length > 1) {
            host = `[${host}]`;
        }

        result.host = host;
        return result;
    };

    // Load current settings
    chrome.storage.local.get(['wplacerHost', 'wplacerPort', 'wplacerAutoReload'], (result) => {
        const hostResult = sanitizeHostValue(result.wplacerHost);
        initialHost = hostResult.host || '127.0.0.1';
        hostInput.value = initialHost;

        const parsedPort = Number.parseInt(result.wplacerPort, 10);
        if (Number.isInteger(parsedPort) && parsedPort >= 1 && parsedPort <= 65535) {
            initialPort = parsedPort;
        } else if (Number.isInteger(hostResult.portFromHost) && hostResult.portFromHost >= 1 && hostResult.portFromHost <= 65535) {
            initialPort = hostResult.portFromHost;
        } else {
            initialPort = 80;
        }
        portInput.value = initialPort;

        const parsedAutoReload = Number.parseInt(result.wplacerAutoReload, 10);
        initialAutoReload = Number.isInteger(parsedAutoReload) && parsedAutoReload >= 0 && parsedAutoReload <= 3600 ? parsedAutoReload : 0;
        autoReloadInput.value = initialAutoReload;
    });

    // Save settings
    saveBtn.addEventListener('click', () => {
        const hostResult = sanitizeHostValue(hostInput.value);
        if (hostResult.empty) {
            statusEl.textContent = 'Error: Server host is required.';
            return;
        }

        if (hostResult.invalid) {
            statusEl.textContent = 'Error: Invalid server host.';
            return;
        }

        const host = hostResult.host;
        if (!host) {
            statusEl.textContent = 'Error: Invalid server host.';
            return;
        }

        hostInput.value = host;

        let port = Number.parseInt(portInput.value, 10);
        if (hostResult.hadPort) {
            const candidatePort = hostResult.portFromHost;
            if (!Number.isInteger(candidatePort) || candidatePort < 1 || candidatePort > 65535) {
                statusEl.textContent = 'Error: Invalid port in host address.';
                return;
            }
            port = candidatePort;
            portInput.value = String(port);
        }

        const autoReload = Number.parseInt(autoReloadInput.value, 10);
        
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            statusEl.textContent = 'Error: Invalid port number.';
            return;
        }
        
        if (!Number.isInteger(autoReload) || autoReload < 0 || autoReload > 3600) {
            statusEl.textContent = 'Error: Invalid auto-reload interval (0-3600 seconds).';
            return;
        }

        chrome.storage.local.set({ 
            wplacerHost: host,
            wplacerPort: port,
            wplacerAutoReload: autoReload
        }, () => {
            const reloadText = autoReload > 0 ? ` Auto-reload: ${autoReload}s.` : ' Auto-reload: disabled.';
            statusEl.textContent = `Settings saved. Server ${host}:${port}.${reloadText}`;
            
            // Inform background script if settings changed
            if (host !== initialHost || port !== initialPort || autoReload !== initialAutoReload) {
                chrome.runtime.sendMessage({ action: "settingsUpdated" });
                initialHost = host;
                initialPort = port;
                initialAutoReload = autoReload;
            }
        });
    });

    // Manually send cookie
    sendCookieBtn.addEventListener('click', () => {
        statusEl.textContent = 'Sending cookie to server...';
        chrome.runtime.sendMessage({ action: "sendCookie" }, (response) => {
            if (chrome.runtime.lastError) {
                statusEl.textContent = `Error: ${chrome.runtime.lastError.message}`;
                return;
            }
            if (response.success) {
                statusEl.textContent = `Success! User: ${response.name}.`;
            } else {
                statusEl.textContent = `Error: ${response.error}`;
            }
        });
    });

    // Quick logout
    logoutBtn.addEventListener('click', () => {
        statusEl.textContent = 'Logging out...';
        chrome.runtime.sendMessage({ action: "quickLogout" }, (response) => {
            if (chrome.runtime.lastError) {
                statusEl.textContent = `Error: ${chrome.runtime.lastError.message}`;
                return;
            }
            if (response.success) {
                statusEl.textContent = 'Logout successful. Site data cleared.';
            } else {
                statusEl.textContent = `Error: ${response.error}`;
            }
        });
    });
});
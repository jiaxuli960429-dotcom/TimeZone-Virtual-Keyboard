(function initKeyboardNetworkModule(globalObj) {
    'use strict';
    const AUTH_TOKEN_STORAGE_KEY = 'tzkAuthToken';

    function getAuthToken() {
        try {
            return (localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '').trim();
        } catch (_) {
            return '';
        }
    }

    function setAuthToken(token) {
        try {
            localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, String(token || ''));
        } catch (_) {
            /* ignore */
        }
    }

    function clearAuthToken() {
        try {
            localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        } catch (_) {
            /* ignore */
        }
    }

    function buildAuthHeaders(extra) {
        const headers = Object.assign({}, extra || {});
        const token = getAuthToken();
        if (token) headers.Authorization = 'Bearer ' + token;
        return headers;
    }

    async function authRegister(username, password) {
        const r = await fetch('/api/v1/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ username, password })
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.detail || 'register failed');
        return data;
    }

    async function authLogin(username, password) {
        const r = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ username, password })
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.detail || 'login failed');
        if (data.token) setAuthToken(data.token);
        return data;
    }

    async function authMe() {
        const r = await fetch('/api/v1/auth/me', {
            headers: buildAuthHeaders()
        });
        if (!r.ok) return null;
        const data = await r.json();
        return data && data.user ? data.user : null;
    }

    async function authLogout() {
        try {
            await fetch('/api/v1/auth/logout', {
                method: 'POST',
                headers: buildAuthHeaders()
            });
        } catch (_) {
            /* ignore */
        } finally {
            clearAuthToken();
        }
        return true;
    }

    async function listMyConfigs() {
        const r = await fetch('/api/v1/my/configs', {
            headers: buildAuthHeaders()
        });
        if (!r.ok) return null;
        const data = await r.json();
        return Array.isArray(data.items) ? data.items : [];
    }

    async function listWorkshopConfigs() {
        const r = await fetch('/api/v1/workshop/configs');
        if (!r.ok) throw new Error('workshop list failed');
        const data = await r.json();
        return Array.isArray(data.items) ? data.items : [];
    }

    async function publishConfigById(configId) {
        const r = await fetch('/api/v1/configs/' + encodeURIComponent(configId) + '/publish', {
            method: 'POST',
            headers: buildAuthHeaders()
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.detail || 'publish failed');
        return data;
    }

    async function forkConfigById(configId, name) {
        const r = await fetch('/api/v1/configs/' + encodeURIComponent(configId) + '/fork', {
            method: 'POST',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
            body: JSON.stringify({ name })
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.detail || 'fork failed');
        return data;
    }

    async function getConfigById(configId) {
        const r = await fetch('/api/v1/configs/' + encodeURIComponent(configId), {
            headers: buildAuthHeaders()
        });
        if (!r.ok) throw new Error('load config failed');
        const data = await r.json();
        return data && data.content ? data.content : null;
    }

    async function deleteConfigById(configId) {
        const r = await fetch('/api/v1/configs/' + encodeURIComponent(configId), {
            method: 'DELETE',
            headers: buildAuthHeaders()
        });
        if (!r.ok) {
            let data = {};
            try {
                data = await r.json();
            } catch (_) {
                data = {};
            }
            throw new Error(data.detail || 'delete failed');
        }
        return true;
    }

    async function updatePublicConfigByName(name, content) {
        const r = await fetch('/api/v1/public/configs/' + encodeURIComponent(name), {
            method: 'PUT',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
            body: JSON.stringify({ content })
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.detail || 'update public config failed');
        return data;
    }
    const LATENCY_LOG_INTERVAL_MS = 2000;
    let latencyWindowCount = 0;
    let latencyWindowSum = 0;
    let latencyWindowMax = 0;
    let latencyLastLogAt = 0;

    function maybeLogLatency(tsMs) {
        if (typeof tsMs !== 'number' || !isFinite(tsMs) || tsMs <= 0) return;
        const now = Date.now();
        const lag = now - tsMs;
        if (lag < 0 || lag > 60000) return;
        latencyWindowCount += 1;
        latencyWindowSum += lag;
        if (lag > latencyWindowMax) latencyWindowMax = lag;
        if (now - latencyLastLogAt < LATENCY_LOG_INTERVAL_MS) return;
        const avg = latencyWindowCount ? latencyWindowSum / latencyWindowCount : 0;
        console.log(
            '[overlay] latency avg=' +
                avg.toFixed(1) +
                'ms max=' +
                latencyWindowMax.toFixed(1) +
                'ms samples=' +
                latencyWindowCount
        );
        latencyWindowCount = 0;
        latencyWindowSum = 0;
        latencyWindowMax = 0;
        latencyLastLogAt = now;
    }

    async function refreshSavedConfigSelect(options) {
        const opts = options || {};
        const sel = opts.selectEl;
        if (!sel) return;
        try {
            let names = [];
            let items = [];
            const mine = await listMyConfigs();
            if (Array.isArray(mine)) {
                items = mine.map((x) => ({
                    id: x.id,
                    name: x.name,
                    keyCount: 0,
                    author: '',
                    updatedAt: x.updatedAt || '',
                    fileModified: '',
                    visibility: x.visibility || 'private'
                }));
                names = items.map((x) => x.name);
            } else {
                const r = await fetch('/api/configs');
                if (!r.ok) throw new Error('bad status');
                const data = await r.json();
                names = data.names || [];
                items = Array.isArray(data.items)
                    ? data.items
                    : names.map((name) => ({
                          name,
                          keyCount: 0,
                          author: '',
                          updatedAt: '',
                          fileModified: ''
                      }));
            }
            sel.innerHTML = '';
            const opt0 = document.createElement('option');
            opt0.value = '';
            opt0.textContent = names.length ? '-- 选择已保存配置 --' : '-- 暂无，请先「保存到项目」--';
            sel.appendChild(opt0);
            names.forEach((name) => {
                const o = document.createElement('option');
                o.value = name;
                o.textContent = name;
                sel.appendChild(o);
            });
            if (typeof opts.onNames === 'function') {
                opts.onNames(items.slice());
            }
            return names;
        } catch (e) {
            console.warn('配置列表不可用（请确认当前页面由在线服务器提供，而不是 file:// 本地文件）', e);
            sel.innerHTML = '';
            const opt0 = document.createElement('option');
            opt0.value = '';
            opt0.textContent = '-- 需本机 HTTP 服务（见控制台说明）--';
            sel.appendChild(opt0);
            if (typeof opts.onNames === 'function') {
                opts.onNames([]);
            }
            return [];
        }
    }

    async function saveConfigToProject(options) {
        const opts = options || {};
        const nameInput = opts.nameInput;
        const suppressSuccessAlert = !!opts.suppressSuccessAlert;
        const name = (nameInput && nameInput.value ? nameInput.value : '').trim();
        if (!name) {
            alert('请填写配置名称（将保存为项目内 configs/名称.json）');
            return false;
        }
        const config = opts.getCurrentConfig();
        const dataStr = JSON.stringify(config);
        try {
            // Prefer new cloud API, then fallback to legacy endpoint.
            let r = null;
            const token = getAuthToken();
            if (token) {
                r = await fetch('/api/v1/configs', {
                    method: 'POST',
                    headers: buildAuthHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
                    body: JSON.stringify({ name, content: config, visibility: 'private' })
                });
            } else {
                r = await fetch('/api/configs/' + encodeURIComponent(name), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json; charset=utf-8' },
                    body: JSON.stringify(config)
                });
            }
            if (r.status === 404) {
                const url = new URL('/api/config/save', window.location.origin);
                r = await fetch(url.toString(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json; charset=utf-8' },
                    body: JSON.stringify({ name, config })
                });
            }
            const text = await r.text();
            let data = {};
            try {
                data = text ? JSON.parse(text) : {};
            } catch (_) {
                data = {};
            }
            if (!r.ok) {
                if (r.status === 404) {
                    alert(
                        '保存失败 (HTTP 404)：当前地址上的服务不认识 /api/config/save。\n\n' +
                            '请确认当前页面来自在线服务，并且后端 API 已部署；\n' +
                            '不要用本地磁盘 file:// 直接打开 html。'
                    );
                    return false;
                }
                alert(data.error || ('保存失败 (HTTP ' + r.status + ')'));
                return false;
            }
            localStorage.setItem('dotaKeyboardConfig', dataStr);
            if (!suppressSuccessAlert) {
                alert('已保存到项目 configs/ 目录：' + (data.name || name) + '.json');
            }
            if (nameInput && opts.retainNameInput !== true) {
                nameInput.value = '';
            }
            if (typeof opts.onSaved === 'function') opts.onSaved();
            return true;
        } catch (err) {
            console.error(err);
            alert('保存失败（请确认在线服务可用，且页面不是用 file:// 打开）');
            return false;
        }
    }

    async function loadSelectedProjectConfig(options) {
        const opts = options || {};
        const sel = opts.selectEl;
        const suppressSuccessAlert = !!opts.suppressSuccessAlert;
        const name = sel && sel.value;
        if (!name) {
            alert('请先从下拉框选择一个配置');
            return false;
        }
        try {
            // Prefer new cloud API, then fallback to legacy endpoint.
            let r = await fetch('/api/configs/' + encodeURIComponent(name));
            let config = null;
            if (r.ok) {
                const data = await r.json();
                config = data && data.config ? data.config : null;
            } else if (r.status === 404) {
                r = await fetch('/api/config?name=' + encodeURIComponent(name));
                if (r.ok) {
                    config = await r.json();
                }
            }
            if (!config) {
                alert('加载失败 (HTTP ' + r.status + ')');
                return false;
            }
            opts.applyConfig(config);
            localStorage.setItem('dotaKeyboardConfig', JSON.stringify(config));
            if (!suppressSuccessAlert) {
                alert('已从项目 configs/ 加载：' + name);
            }
            return config;
        } catch (e) {
            console.error(e);
            alert('加载失败（请确认在线服务可用）');
            return false;
        }
    }

    async function deleteSelectedProjectConfig(options) {
        const opts = options || {};
        const sel = opts.selectEl;
        const name = sel && sel.value;
        if (!name) {
            alert('请先选择要删除的配置');
            return false;
        }
        if (!confirm('确定删除项目内配置：configs/' + name + '.json ?')) return false;
        try {
            // Prefer new cloud API, then fallback to legacy endpoint.
            let r = await fetch('/api/configs/' + encodeURIComponent(name), { method: 'DELETE' });
            if (r.status === 404) {
                r = await fetch('/api/config?name=' + encodeURIComponent(name), { method: 'DELETE' });
            }
            let data = {};
            try {
                data = await r.json();
            } catch (_) {
                data = {};
            }
            if (!r.ok) {
                alert(data.error || '删除失败');
                return false;
            }
            if (typeof opts.onDeleted === 'function') opts.onDeleted();
            return true;
        } catch (e) {
            alert('删除失败');
            return false;
        }
    }

    async function openConfigsFolder() {
        try {
            const r = await fetch('/api/config/open-folder', { method: 'POST' });
            let data = {};
            try {
                data = await r.json();
            } catch (_) {
                data = {};
            }
            if (!r.ok || !data.ok) {
                alert(data.error || '打开配置文件夹失败');
                return false;
            }
            return true;
        } catch (e) {
            console.error(e);
            alert('打开配置文件夹失败（在线模式下此功能通常不可用）');
            return false;
        }
    }

    function handleWebSocketMessage(data, pressedKeys, invalidateCanvas) {
        if (!pressedKeys) return;
        if (data.type === 'key') {
            maybeLogLatency(typeof data.ts === 'number' ? data.ts : 0);
        }
        if (data.type === 'key') {
            if (data.pressed) {
                pressedKeys.add(data.code);
            } else {
                pressedKeys.delete(data.code);
            }
        } else if (data.type === 'full_state' && Array.isArray(data.pressed_keys)) {
            pressedKeys.clear();
            data.pressed_keys.forEach((code) => pressedKeys.add(code));
        }
        invalidateCanvas();
    }

    function showConnectionStatus(status, state) {
        const st = state || {};
        if (st.suppressStatus) return st.wsStatusFadeTimerId || null;
        const statusElementId = st.statusElementId || 'ws-status';
        const mountElementId = st.statusMountElementId || 'ws-status-mount';
        let statusDiv = document.getElementById(statusElementId);
        const mount = document.getElementById(mountElementId);
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.id = statusElementId;
            statusDiv.className = 'ws-status-chip';
            if (mount) {
                mount.appendChild(statusDiv);
            } else {
                document.body.appendChild(statusDiv);
            }
        } else if (mount && statusDiv.parentNode !== mount) {
            mount.appendChild(statusDiv);
        }

        if (st.wsStatusFadeTimerId !== null) {
            clearTimeout(st.wsStatusFadeTimerId);
            st.wsStatusFadeTimerId = null;
        }
        statusDiv.style.opacity = '1';
        statusDiv.classList.remove('connected', 'disconnected');

        const isServerLink = statusElementId === 'server-link-status';
        const prefix = isServerLink ? '服务器链路：' : '实时通道：';
        if (status === 'connected' || status === true) {
            statusDiv.textContent = prefix + '已连接';
            statusDiv.classList.add('connected');
        } else if (status === 'connecting') {
            statusDiv.textContent = prefix + '连接中...';
        } else {
            statusDiv.textContent = prefix + '未连接（请检查网络或服务器）';
            statusDiv.classList.add('disconnected');
        }

        return null;
    }

    function connectWebSocket(options) {
        const opts = options || {};
        const state = opts.state;
        const reconnectDelayMs = opts.reconnectDelayMs || 3000;
        const channel = (opts.channel || 'demo').trim();
        const role = (opts.role || 'overlay').trim();
        const urls = Array.isArray(opts.urls) && opts.urls.length ? opts.urls.slice() : [opts.url];
        let nextUrlIndex = 0;
        let hasEverConnected = false;
        let pendingFastFallback = false;

        function pickNextUrl() {
            const u = urls[nextUrlIndex % urls.length];
            nextUrlIndex += 1;
            return u;
        }

        function scheduleReconnect(delayMs) {
            if (state.wsReconnectTimerId !== null) {
                clearTimeout(state.wsReconnectTimerId);
            }
            state.wsReconnectTimerId = setTimeout(() => {
                state.wsReconnectTimerId = null;
                tryConnect();
            }, delayMs);
        }

        function tryConnect() {
            const targetUrl = pickNextUrl();
            try {
                state.ws = new WebSocket(targetUrl);
            } catch (err) {
                console.warn('WebSocket connect init failed:', targetUrl, err);
                state.wsConnected = false;
                if (!hasEverConnected && urls.length > 1) {
                    showConnectionStatus('connecting', state);
                    scheduleReconnect(80);
                    return;
                }
                showConnectionStatus('disconnected', state);
                if (typeof opts.onTransportState === 'function') {
                    opts.onTransportState({
                        status: 'disconnected',
                        url: targetUrl,
                        isLocalRelay: /127\.0\.0\.1:8766|localhost:8766/.test(targetUrl)
                    });
                }
                scheduleReconnect(reconnectDelayMs);
                return;
            }

            state.ws.onopen = () => {
                if (state.wsReconnectTimerId !== null) {
                    clearTimeout(state.wsReconnectTimerId);
                    state.wsReconnectTimerId = null;
                }
                state.ws.send(
                    JSON.stringify({
                        type: 'hello',
                        role,
                        channel
                    })
                );
                console.log('WebSocket connected:', targetUrl);
                hasEverConnected = true;
                pendingFastFallback = false;
                state.wsConnected = true;
                state.useWebSocket = true;
                showConnectionStatus('connected', state);
                if (typeof opts.onTransportState === 'function') {
                    opts.onTransportState({
                        status: 'connected',
                        url: targetUrl,
                        isLocalRelay: /127\.0\.0\.1:8766|localhost:8766/.test(targetUrl)
                    });
                }
            };

            state.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'hello_ack' || data.type === 'pong') return;
                    handleWebSocketMessage(data, opts.pressedKeys, opts.invalidateCanvas);
                } catch (e) {
                    console.error('WebSocket message parse error:', e);
                }
            };

            state.ws.onclose = () => {
                console.log('WebSocket disconnected:', targetUrl);
                state.wsConnected = false;
                if (!hasEverConnected && urls.length > 1 && !pendingFastFallback) {
                    pendingFastFallback = true;
                    showConnectionStatus('connecting', state);
                    scheduleReconnect(80);
                    return;
                }
                pendingFastFallback = false;
                showConnectionStatus('disconnected', state);
                if (typeof opts.onTransportState === 'function') {
                    opts.onTransportState({
                        status: 'disconnected',
                        url: targetUrl,
                        isLocalRelay: /127\.0\.0\.1:8766|localhost:8766/.test(targetUrl)
                    });
                }
                scheduleReconnect(reconnectDelayMs);
            };

            state.ws.onerror = (error) => {
                console.error('WebSocket error:', targetUrl, error);
                state.wsConnected = false;
                if (!hasEverConnected && urls.length > 1) {
                    showConnectionStatus('connecting', state);
                    if (typeof opts.onTransportState === 'function') {
                        opts.onTransportState({
                            status: 'connecting',
                            url: targetUrl,
                            isLocalRelay: /127\.0\.0\.1:8766|localhost:8766/.test(targetUrl)
                        });
                    }
                    return;
                }
                showConnectionStatus('disconnected', state);
                if (typeof opts.onTransportState === 'function') {
                    opts.onTransportState({
                        status: 'disconnected',
                        url: targetUrl,
                        isLocalRelay: /127\.0\.0\.1:8766|localhost:8766/.test(targetUrl)
                    });
                }
            };
        }

        showConnectionStatus('connecting', state);
        if (typeof opts.onTransportState === 'function') {
            opts.onTransportState({ status: 'connecting', url: '', isLocalRelay: false });
        }
        tryConnect();
    }

    globalObj.KeyboardNetworkModule = {
        getAuthToken,
        setAuthToken,
        clearAuthToken,
        authRegister,
        authLogin,
        authMe,
        authLogout,
        listMyConfigs,
        listWorkshopConfigs,
        publishConfigById,
        forkConfigById,
        getConfigById,
        deleteConfigById,
        updatePublicConfigByName,
        refreshSavedConfigSelect,
        saveConfigToProject,
        loadSelectedProjectConfig,
        deleteSelectedProjectConfig,
        openConfigsFolder,
        handleWebSocketMessage,
        showConnectionStatus,
        connectWebSocket
    };
})(window);

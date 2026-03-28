(function initKeyboardNetworkModule(globalObj) {
    'use strict';

    async function refreshSavedConfigSelect(options) {
        const opts = options || {};
        const sel = opts.selectEl;
        if (!sel) return;
        try {
            const r = await fetch('/api/configs');
            if (!r.ok) throw new Error('bad status');
            const data = await r.json();
            const names = data.names || [];
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
                opts.onNames(names.slice());
            }
            return names;
        } catch (e) {
            console.warn('配置列表不可用（请用 start-keyboard.bat 启动，并以 http://localhost:8080 打开）', e);
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
            const url = new URL('/api/config/save', window.location.origin);
            const r = await fetch(url.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify({ name, config })
            });
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
                            '常见原因：8080 端口仍是旧的「仅静态文件」服务（例如以前 bat 起的 PowerShell）。\n' +
                            '请结束占用 8080 的进程后，只用新版 start-keyboard.bat 启动（由 key_server 同时提供网页与保存接口），\n' +
                            '并用 http://localhost:8080 打开本页（不要用本地磁盘 file:// 打开）。'
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
            if (nameInput) nameInput.value = '';
            if (typeof opts.onSaved === 'function') opts.onSaved();
            return true;
        } catch (err) {
            console.error(err);
            alert('保存失败（请确认已用 http://localhost:8080 打开页面，且 key_server 正在运行）');
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
            const r = await fetch('/api/config?name=' + encodeURIComponent(name));
            if (!r.ok) {
                alert('加载失败 (HTTP ' + r.status + ')');
                return false;
            }
            const config = await r.json();
            opts.applyConfig(config);
            localStorage.setItem('dotaKeyboardConfig', JSON.stringify(config));
            if (!suppressSuccessAlert) {
                alert('已从项目 configs/ 加载：' + name);
            }
            return true;
        } catch (e) {
            console.error(e);
            alert('加载失败（请确认本机服务已启动）');
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
            const r = await fetch('/api/config?name=' + encodeURIComponent(name), { method: 'DELETE' });
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

    function handleWebSocketMessage(data, pressedKeys, invalidateCanvas) {
        if (!pressedKeys) return;
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

    function showConnectionStatus(connected, state) {
        const st = state || {};
        if (st.suppressStatus) return st.wsStatusFadeTimerId || null;
        let statusDiv = document.getElementById('ws-status');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.id = 'ws-status';
            statusDiv.className = 'ws-status-chip';
            document.body.appendChild(statusDiv);
        }

        if (st.wsStatusFadeTimerId !== null) {
            clearTimeout(st.wsStatusFadeTimerId);
            st.wsStatusFadeTimerId = null;
        }
        statusDiv.style.opacity = '1';
        statusDiv.classList.remove('connected', 'disconnected');

        if (connected) {
            statusDiv.textContent = '全局按键捕获：已连接';
            statusDiv.classList.add('connected');
        } else {
            statusDiv.textContent = '全局按键捕获：未连接（请运行 key_server.py）';
            statusDiv.classList.add('disconnected');
        }

        st.wsStatusFadeTimerId = setTimeout(() => {
            statusDiv.style.opacity = '0.58';
            st.wsStatusFadeTimerId = null;
        }, 5000);
        return st.wsStatusFadeTimerId;
    }

    function connectWebSocket(options) {
        const opts = options || {};
        const state = opts.state;
        const reconnectDelayMs = opts.reconnectDelayMs || 3000;

        try {
            state.ws = new WebSocket(opts.url || 'ws://localhost:8765');

            state.ws.onopen = () => {
                if (state.wsReconnectTimerId !== null) {
                    clearTimeout(state.wsReconnectTimerId);
                    state.wsReconnectTimerId = null;
                }
                console.log('WebSocket Connected - Global key capture enabled');
                state.wsConnected = true;
                state.useWebSocket = true;
                showConnectionStatus(true, state);
            };

            state.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    handleWebSocketMessage(data, opts.pressedKeys, opts.invalidateCanvas);
                } catch (e) {
                    console.error('WebSocket message parse error:', e);
                }
            };

            state.ws.onclose = () => {
                console.log('WebSocket disconnected');
                state.wsConnected = false;
                showConnectionStatus(false, state);
                if (state.wsReconnectTimerId !== null) {
                    clearTimeout(state.wsReconnectTimerId);
                }
                state.wsReconnectTimerId = setTimeout(() => {
                    state.wsReconnectTimerId = null;
                    connectWebSocket(options);
                }, reconnectDelayMs);
            };

            state.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                state.wsConnected = false;
                showConnectionStatus(false, state);
            };
        } catch (e) {
            console.error('WebSocket connection failed:', e);
            showConnectionStatus(false, state);
        }
    }

    globalObj.KeyboardNetworkModule = {
        refreshSavedConfigSelect,
        saveConfigToProject,
        loadSelectedProjectConfig,
        deleteSelectedProjectConfig,
        handleWebSocketMessage,
        showConnectionStatus,
        connectWebSocket
    };
})(window);

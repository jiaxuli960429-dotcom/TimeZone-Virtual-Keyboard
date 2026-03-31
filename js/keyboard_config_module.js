(function initKeyboardConfigModule(globalObj) {
    'use strict';

    async function loadBuiltinDefaultConfig(options) {
        const opts = options || {};
        const fetchImpl = opts.fetchImpl || fetch;
        try {
            const r = await fetchImpl(opts.url, { cache: 'no-store' });
            if (!r.ok) {
                throw new Error('HTTP ' + r.status);
            }
            const config = await r.json();
            opts.applyConfig(config);
        } catch (e) {
            if (typeof opts.onFallbackEmpty === 'function') {
                opts.onFallbackEmpty();
            }
            (opts.logger || console).warn(
                '未加载内置布局 configs/默认87键.json（请用 http://localhost:8080 打开页面；若用 file:// 打开则无内置布局）。将使用空按键列表。',
                e
            );
        }
    }

    function loadSavedConfig(options) {
        const opts = options || {};
        const storage = opts.storage || localStorage;
        const logger = opts.logger || console;

        const saved = storage.getItem('dotaKeyboardConfig');
        if (!saved) return;
        try {
            const config = JSON.parse(saved);
            if (!config || typeof config !== 'object' || !Array.isArray(config.keys)) {
                storage.removeItem('dotaKeyboardConfig');
                logger.log('已忽略格式过旧或无效的地缓存（需含 keys 数组），将以项目内配置为准。');
                return;
            }
            opts.applyConfig(config);
            logger.log('已自动加载保存的配置');
        } catch (e) {
            logger.log('加载保存的配置失败:', e);
        }
    }

    function applyConfig(config, ctx) {
        const c = ctx || {};
        if (!config) {
            console.error('配置为空');
            return;
        }

        if (typeof c.resetConfigDefaults === 'function') {
            c.resetConfigDefaults();
        }

        if (config.keys && Array.isArray(config.keys)) {
            c.setKeys(config.keys.map((item) => c.keyFromPersistedData(item)));
        }

        if (config.config && typeof config.config === 'object') {
            Object.assign(c.CONFIG, config.config);
            if (c.CONFIG.keyOpacityPressed === undefined) c.CONFIG.keyOpacityPressed = c.CONFIG.keyOpacity;
            if (c.CONFIG.keyOpacityPressedUseUnpressed === undefined) c.CONFIG.keyOpacityPressedUseUnpressed = true;
            if (c.CONFIG.activeColorUseInactive === undefined) {
                c.CONFIG.activeColorUseInactive = c.CONFIG.activeColor === c.CONFIG.inactiveColor;
            }
            if (c.CONFIG.activeColorUseInactive) {
                c.CONFIG.activeColor = c.CONFIG.inactiveColor;
            }
            if (c.CONFIG.textColorPressed === undefined) c.CONFIG.textColorPressed = c.CONFIG.textColor;
            if (c.CONFIG.textColorPressedUseUnpressed === undefined) c.CONFIG.textColorPressedUseUnpressed = true;
            if (c.CONFIG.textColorPressedUseUnpressed) c.CONFIG.textColorPressed = c.CONFIG.textColor;
            if (c.CONFIG.textOpacityPressed === undefined) c.CONFIG.textOpacityPressed = c.CONFIG.textOpacity;
            if (c.CONFIG.textOpacityPressedUseUnpressed === undefined) c.CONFIG.textOpacityPressedUseUnpressed = true;
            if (c.CONFIG.textOpacityPressedUseUnpressed) c.CONFIG.textOpacityPressed = c.CONFIG.textOpacity;
            if (c.CONFIG.borderColorPressed === undefined) c.CONFIG.borderColorPressed = c.CONFIG.borderColor;
            if (c.CONFIG.borderColorPressedUseUnpressed === undefined) c.CONFIG.borderColorPressedUseUnpressed = true;
            if (c.CONFIG.borderColorPressedUseUnpressed) c.CONFIG.borderColorPressed = c.CONFIG.borderColor;
            if (c.CONFIG.borderOpacityPressed === undefined) c.CONFIG.borderOpacityPressed = c.CONFIG.borderOpacity;
            if (c.CONFIG.borderOpacityPressedUseUnpressed === undefined) c.CONFIG.borderOpacityPressedUseUnpressed = true;
            if (c.CONFIG.borderOpacityPressedUseUnpressed) c.CONFIG.borderOpacityPressed = c.CONFIG.borderOpacity;

            const opacitySliderValue = Math.round((1 - c.CONFIG.keyOpacity) * 100);
            c.setInputValue('key-opacity', opacitySliderValue);
            c.setText('key-opacity-val', opacitySliderValue);
            const opacityPressedSliderValue = Math.round((1 - c.CONFIG.keyOpacityPressed) * 100);
            c.setInputValue('key-opacity-pressed', opacityPressedSliderValue);
            c.setText('key-opacity-pressed-val', opacityPressedSliderValue);
            c.setChecked('key-opacity-pressed-use-unpressed', c.CONFIG.keyOpacityPressedUseUnpressed);
            c.setDisabled('key-opacity-pressed', c.CONFIG.keyOpacityPressedUseUnpressed);
            c.setStyle('active-color-preview', 'backgroundColor', c.CONFIG.activeColor);
            c.setStyle('inactive-color-preview', 'backgroundColor', c.CONFIG.inactiveColor);
            c.setChecked('active-color-use-inactive', c.CONFIG.activeColorUseInactive);
            c.setStyle('active-color-preview', 'pointerEvents', c.CONFIG.activeColorUseInactive ? 'none' : 'auto');
            c.setStyle('active-color-preview', 'opacity', c.CONFIG.activeColorUseInactive ? '0.45' : '1');
            const tOpRaw = c.CONFIG.textOpacity;
            const tOp =
                tOpRaw !== undefined && !Number.isNaN(Number(tOpRaw)) ? parseFloat(String(tOpRaw), 10) : 1;
            c.CONFIG.textOpacity = Math.max(0, Math.min(1, tOp));
            const textOpSlider = Math.round((1 - c.CONFIG.textOpacity) * 100);
            c.setInputValue('text-opacity', textOpSlider);
            c.setText('text-opacity-val', textOpSlider);
            c.setStyle('text-color-preview', 'backgroundColor', c.CONFIG.textColor || '#ffffff');
            c.setStyle('text-color-pressed-preview', 'backgroundColor', c.CONFIG.textColorPressed || c.CONFIG.textColor || '#ffffff');
            const textOpPressedRaw = c.CONFIG.textOpacityPressed;
            const textOpPressed =
                textOpPressedRaw !== undefined && !Number.isNaN(Number(textOpPressedRaw))
                    ? parseFloat(String(textOpPressedRaw), 10)
                    : c.CONFIG.textOpacity;
            c.CONFIG.textOpacityPressed = Math.max(0, Math.min(1, textOpPressed));
            const textOpPressedSlider = Math.round((1 - c.CONFIG.textOpacityPressed) * 100);
            c.setInputValue('text-opacity-pressed', textOpPressedSlider);
            c.setText('text-opacity-pressed-val', textOpPressedSlider);
            c.setChecked('text-color-pressed-use-unpressed', c.CONFIG.textColorPressedUseUnpressed);
            c.setChecked('text-opacity-pressed-use-unpressed', c.CONFIG.textOpacityPressedUseUnpressed);
            c.setDisabled('text-opacity-pressed', c.CONFIG.textOpacityPressedUseUnpressed);
            c.setStyle('text-color-pressed-preview', 'pointerEvents', c.CONFIG.textColorPressedUseUnpressed ? 'none' : 'auto');
            c.setStyle('text-color-pressed-preview', 'opacity', c.CONFIG.textColorPressedUseUnpressed ? '0.45' : '1');
            const bOpRaw = c.CONFIG.borderOpacity;
            const bOp =
                bOpRaw !== undefined && !Number.isNaN(Number(bOpRaw)) ? parseFloat(String(bOpRaw), 10) : 1;
            c.CONFIG.borderOpacity = Math.max(0, Math.min(1, bOp));
            const borderOpSlider = Math.round((1 - c.CONFIG.borderOpacity) * 100);
            c.setInputValue('border-opacity', borderOpSlider);
            c.setText('border-opacity-val', borderOpSlider);
            c.setStyle('border-color-preview', 'backgroundColor', c.CONFIG.borderColor || '#555555');
            c.setStyle('border-color-pressed-preview', 'backgroundColor', c.CONFIG.borderColorPressed || c.CONFIG.borderColor || '#555555');
            const bOpPressedRaw = c.CONFIG.borderOpacityPressed;
            const bOpPressed =
                bOpPressedRaw !== undefined && !Number.isNaN(Number(bOpPressedRaw))
                    ? parseFloat(String(bOpPressedRaw), 10)
                    : c.CONFIG.borderOpacity;
            c.CONFIG.borderOpacityPressed = Math.max(0, Math.min(1, bOpPressed));
            const borderOpPressedSlider = Math.round((1 - c.CONFIG.borderOpacityPressed) * 100);
            c.setInputValue('border-opacity-pressed', borderOpPressedSlider);
            c.setText('border-opacity-pressed-val', borderOpPressedSlider);
            c.setChecked('border-color-pressed-use-unpressed', c.CONFIG.borderColorPressedUseUnpressed);
            c.setChecked('border-opacity-pressed-use-unpressed', c.CONFIG.borderOpacityPressedUseUnpressed);
            c.setDisabled('border-opacity-pressed', c.CONFIG.borderOpacityPressedUseUnpressed);
            c.setStyle('border-color-pressed-preview', 'pointerEvents', c.CONFIG.borderColorPressedUseUnpressed ? 'none' : 'auto');
            c.setStyle('border-color-pressed-preview', 'opacity', c.CONFIG.borderColorPressedUseUnpressed ? '0.45' : '1');
        }

        if (typeof c.CONFIG.canvasWidth !== 'number' || !Number.isFinite(c.CONFIG.canvasWidth)) {
            c.CONFIG.canvasWidth = 1200;
        }
        if (typeof c.CONFIG.canvasHeight !== 'number' || !Number.isFinite(c.CONFIG.canvasHeight)) {
            c.CONFIG.canvasHeight = 400;
        }
        if (typeof c.setInputValue === 'function') {
            c.setInputValue('console-canvas-width', String(Math.round(c.CONFIG.canvasWidth)));
            c.setInputValue('console-canvas-height', String(Math.round(c.CONFIG.canvasHeight)));
        }

        if (config.bgImage && config.bgImage !== '' && config.bgImage !== window.location.href) {
            const nextBg = new Image();
            nextBg.onload = () => {
                c.setBgImage(nextBg);
                c.setImageSrc('bg-image', config.bgImage);
                c.setDisplay('bg-image', 'block');
                c.setDisplay('remove-bg-btn', 'inline-block');
                c.updateOpacityControlsVisibility(true);
                c.invalidateCanvas();
            };
            nextBg.onerror = () => {
                console.warn('全局背景图片加载失败');
                c.setBgImage(null);
                c.invalidateCanvas();
            };
            nextBg.src = config.bgImage;
        } else {
            c.setBgImage(null);
            c.setImageSrc('bg-image', '');
            c.setDisplay('bg-image', 'none');
            c.setDisplay('remove-bg-btn', 'none');
            c.updateOpacityControlsVisibility(false);
            c.invalidateCanvas();
        }

        if (config.bgPosition && typeof config.bgPosition === 'object') {
            c.setBgPosition({
                x: config.bgPosition.x || 0,
                y: config.bgPosition.y || 0
            });
        } else {
            c.setBgPosition({ x: 0, y: 0 });
        }

        c.setBgScale(config.bgScale !== undefined && !isNaN(config.bgScale) ? parseFloat(config.bgScale) : 1.0);
        c.setInputValue('bg-scale', Math.round(c.getBgScale() * 100));
        c.setText('bg-scale-val', Math.round(c.getBgScale() * 100));

        c.setBgKeyOpacity(config.bgKeyOpacity !== undefined && !isNaN(config.bgKeyOpacity) ? parseFloat(config.bgKeyOpacity) : 0.8);
        c.setInputValue('bg-key-opacity', Math.round((1 - c.getBgKeyOpacity()) * 100));
        c.setText('bg-key-opacity-val', Math.round((1 - c.getBgKeyOpacity()) * 100));
        c.setBgKeyOpacityPressed(
            config.bgKeyOpacityPressed !== undefined && !isNaN(config.bgKeyOpacityPressed)
                ? parseFloat(config.bgKeyOpacityPressed)
                : c.getBgKeyOpacity()
        );
        c.setBgKeyOpacityPressedUseUnpressed(
            config.bgKeyOpacityPressedUseUnpressed !== undefined ? !!config.bgKeyOpacityPressedUseUnpressed : true
        );
        if (c.getBgKeyOpacityPressedUseUnpressed()) {
            c.setBgKeyOpacityPressed(c.getBgKeyOpacity());
        }
        c.setInputValue('bg-key-opacity-pressed', Math.round((1 - c.getBgKeyOpacityPressed()) * 100));
        c.setText('bg-key-opacity-pressed-val', Math.round((1 - c.getBgKeyOpacityPressed()) * 100));
        c.setChecked('bg-key-opacity-pressed-use-unpressed', c.getBgKeyOpacityPressedUseUnpressed());
        c.setDisabled('bg-key-opacity-pressed', c.getBgKeyOpacityPressedUseUnpressed());

        c.setBgNonKeyOpacity(
            config.bgNonKeyOpacity !== undefined && !isNaN(config.bgNonKeyOpacity) ? parseFloat(config.bgNonKeyOpacity) : 0.8
        );
        c.setInputValue('bg-non-key-opacity', Math.round((1 - c.getBgNonKeyOpacity()) * 100));
        c.setText('bg-non-key-opacity-val', Math.round((1 - c.getBgNonKeyOpacity()) * 100));

        c.syncCanvasSize();
        c.ensureKeySizeDefaults();
        c.updateKeyList();
        c.resetLayoutHistory();
        console.log('配置加载完成');
        c.invalidateCanvas();
    }

    function exportConfigJsonFile(configObject) {
        const dataStr = JSON.stringify(configObject, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dota-keyboard-config.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        localStorage.setItem('dotaKeyboardConfig', dataStr);
        alert('已导出 JSON 下载，并已写入本浏览器 localStorage 缓存。');
    }

    function loadConfigFromFile(event, applyConfigFn, onLoaded) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const config = JSON.parse(e.target.result);
                applyConfigFn(config);
                alert('配置已加载！');
                if (typeof onLoaded === 'function') onLoaded();
            } catch (err) {
                console.error('配置加载错误:', err);
                alert('配置文件格式错误！');
            }
        };
        reader.readAsText(file);
    }

    /** 无 query 时叠加层会尝试加载的项目内文件名（configs/obs.json）。 */
    const OVERLAY_FALLBACK_PROFILE_NAME = 'obs';

    async function loadProjectConfigByName(options) {
        const opts = options || {};
        const name = (opts.name || '').trim();
        if (!name || typeof opts.applyConfig !== 'function') return false;
        const fetchImpl = opts.fetchImpl || fetch;
        try {
            const r = await fetchImpl('/api/config?name=' + encodeURIComponent(name), { cache: 'no-store' });
            if (!r.ok) return false;
            const config = await r.json();
            opts.applyConfig(config);
            return true;
        } catch (e) {
            (opts.logger || console).warn('加载项目配置失败: ' + name, e);
            return false;
        }
    }

    /**
     * OBS / 独立浏览器叠加层：不依赖 localStorage。
     * 顺序：先 URL ?config=名称，再尝试 configs/obs.json。
     */
    async function loadOverlayServerProfile(options) {
        const opts = options || {};
        const fallback =
            typeof opts.overlayFallbackName === 'string' && opts.overlayFallbackName.trim()
                ? opts.overlayFallbackName.trim()
                : OVERLAY_FALLBACK_PROFILE_NAME;
        const logger = opts.logger || console;
        const params = new URLSearchParams(
            typeof globalObj.location !== 'undefined' && globalObj.location.search ? globalObj.location.search : ''
        );
        const fromQuery = (params.get('config') || '').trim();
        const names = [];
        if (fromQuery) names.push(fromQuery);
        if (fallback && names.indexOf(fallback) === -1) names.push(fallback);

        for (let i = 0; i < names.length; i++) {
            const ok = await loadProjectConfigByName({
                name: names[i],
                applyConfig: opts.applyConfig,
                fetchImpl: opts.fetchImpl,
                logger: opts.logger
            });
            if (ok) {
                logger.log('叠加层已使用服务端配置: configs/' + names[i] + '.json');
                return;
            }
        }
        logger.log(
            '叠加层未找到可加载的项目配置（已尝试: ' +
                names.join(', ') +
                '）。当前为内置模板 configs/默认87键.json。请在控制台「保存到项目」为 obs 或所选名称，并复制带 ?config= 的 OBS 地址。'
        );
    }

    globalObj.KeyboardConfigModule = {
        OVERLAY_FALLBACK_PROFILE_NAME,
        loadBuiltinDefaultConfig,
        loadSavedConfig,
        applyConfig,
        exportConfigJsonFile,
        loadConfigFromFile,
        loadProjectConfigByName,
        loadOverlayServerProfile
    };
})(window);

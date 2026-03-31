(function initKeyboardPanelModule(globalObj) {
    'use strict';

    function byId(id) {
        return document.getElementById(id);
    }

    function toggleControls(ctx) {
        const panel = byId('controls-panel');
        const btn = byId('toggle-controls');
        if (!panel || !btn) return;

        if (panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
            btn.textContent = '⚙️ 设置';
            if (ctx && typeof ctx.refreshSavedConfigSelect === 'function') {
                ctx.refreshSavedConfigSelect();
            }
            return;
        }

        panel.classList.add('hidden');
        btn.textContent = '⚙️ 设置';
    }

    function hideControls() {
        const panel = byId('controls-panel');
        const btn = byId('toggle-controls');
        if (panel) panel.classList.add('hidden');
        if (btn) btn.textContent = '⚙️ 设置';
    }

    function clamp01(v, fallback) {
        const n = Number(v);
        if (Number.isNaN(n)) return fallback;
        return Math.max(0, Math.min(1, n));
    }

    function percentToUnit(val, fallback = 1) {
        const n = parseInt(val, 10);
        if (!Number.isFinite(n)) return fallback;
        return clamp01((100 - n) / 100, fallback);
    }

    function unitToPercent(val, fallback = 0) {
        return Math.round((1 - clamp01(val, 1 - fallback / 100)) * 100);
    }

    function updateOpacity(ctx, val) {
        if (!ctx || !ctx.CONFIG) return;
        ctx.CONFIG.keyOpacity = percentToUnit(val, 0.8);
        const label = byId('key-opacity-val');
        if (label) label.textContent = val;
        if (ctx.CONFIG.keyOpacityPressedUseUnpressed) {
            ctx.CONFIG.keyOpacityPressed = ctx.CONFIG.keyOpacity;
            const pressedInput = byId('key-opacity-pressed');
            const pressedVal = byId('key-opacity-pressed-val');
            if (pressedInput) pressedInput.value = String(unitToPercent(ctx.CONFIG.keyOpacityPressed, 0));
            if (pressedVal) pressedVal.textContent = String(unitToPercent(ctx.CONFIG.keyOpacityPressed, 0));
        }
        if (typeof ctx.invalidateCanvas === 'function') ctx.invalidateCanvas();
    }

    function updateOpacityPressed(ctx, val) {
        if (!ctx || !ctx.CONFIG || ctx.CONFIG.keyOpacityPressedUseUnpressed) return;
        ctx.CONFIG.keyOpacityPressed = percentToUnit(val, ctx.CONFIG.keyOpacity);
        const label = byId('key-opacity-pressed-val');
        if (label) label.textContent = val;
        if (typeof ctx.invalidateCanvas === 'function') ctx.invalidateCanvas();
    }

    function toggleKeyOpacityPressedUseUnpressed(ctx) {
        if (!ctx || !ctx.CONFIG) return;
        const cb = byId('key-opacity-pressed-use-unpressed');
        const input = byId('key-opacity-pressed');
        const value = byId('key-opacity-pressed-val');
        if (!cb || !input || !value) return;
        ctx.CONFIG.keyOpacityPressedUseUnpressed = !!cb.checked;
        if (ctx.CONFIG.keyOpacityPressedUseUnpressed) {
            ctx.CONFIG.keyOpacityPressed = ctx.CONFIG.keyOpacity;
            const p = unitToPercent(ctx.CONFIG.keyOpacity, 0);
            input.value = String(p);
            value.textContent = String(p);
            input.disabled = true;
        } else {
            input.disabled = false;
        }
        if (typeof ctx.invalidateCanvas === 'function') ctx.invalidateCanvas();
    }

    function updateTextOpacity(ctx, val) {
        if (!ctx || !ctx.CONFIG) return;
        ctx.CONFIG.textOpacity = percentToUnit(val, 1);
        const label = byId('text-opacity-val');
        if (label) label.textContent = val;
        if (ctx.CONFIG.textOpacityPressedUseUnpressed) {
            ctx.CONFIG.textOpacityPressed = ctx.CONFIG.textOpacity;
            const p = unitToPercent(ctx.CONFIG.textOpacityPressed, 0);
            const input = byId('text-opacity-pressed');
            const value = byId('text-opacity-pressed-val');
            if (input) input.value = String(p);
            if (value) value.textContent = String(p);
        }
        if (typeof ctx.invalidateCanvas === 'function') ctx.invalidateCanvas();
    }

    function updateTextOpacityPressed(ctx, val) {
        if (!ctx || !ctx.CONFIG || ctx.CONFIG.textOpacityPressedUseUnpressed) return;
        ctx.CONFIG.textOpacityPressed = percentToUnit(val, ctx.CONFIG.textOpacity);
        const label = byId('text-opacity-pressed-val');
        if (label) label.textContent = val;
        if (typeof ctx.invalidateCanvas === 'function') ctx.invalidateCanvas();
    }

    function toggleTextOpacityPressedUseUnpressed(ctx) {
        if (!ctx || !ctx.CONFIG) return;
        const cb = byId('text-opacity-pressed-use-unpressed');
        const input = byId('text-opacity-pressed');
        const value = byId('text-opacity-pressed-val');
        if (!cb || !input || !value) return;
        ctx.CONFIG.textOpacityPressedUseUnpressed = !!cb.checked;
        if (ctx.CONFIG.textOpacityPressedUseUnpressed) {
            ctx.CONFIG.textOpacityPressed = ctx.CONFIG.textOpacity;
            const p = unitToPercent(ctx.CONFIG.textOpacity, 0);
            input.value = String(p);
            value.textContent = String(p);
            input.disabled = true;
        } else {
            input.disabled = false;
        }
        if (typeof ctx.invalidateCanvas === 'function') ctx.invalidateCanvas();
    }

    function updateBorderOpacity(ctx, val) {
        if (!ctx || !ctx.CONFIG) return;
        ctx.CONFIG.borderOpacity = percentToUnit(val, 1);
        const label = byId('border-opacity-val');
        if (label) label.textContent = val;
        if (ctx.CONFIG.borderOpacityPressedUseUnpressed) {
            ctx.CONFIG.borderOpacityPressed = ctx.CONFIG.borderOpacity;
            const p = unitToPercent(ctx.CONFIG.borderOpacityPressed, 0);
            const input = byId('border-opacity-pressed');
            const value = byId('border-opacity-pressed-val');
            if (input) input.value = String(p);
            if (value) value.textContent = String(p);
        }
        if (typeof ctx.invalidateCanvas === 'function') ctx.invalidateCanvas();
    }

    function updateBorderOpacityPressed(ctx, val) {
        if (!ctx || !ctx.CONFIG || ctx.CONFIG.borderOpacityPressedUseUnpressed) return;
        ctx.CONFIG.borderOpacityPressed = percentToUnit(val, ctx.CONFIG.borderOpacity);
        const label = byId('border-opacity-pressed-val');
        if (label) label.textContent = val;
        if (typeof ctx.invalidateCanvas === 'function') ctx.invalidateCanvas();
    }

    function toggleBorderOpacityPressedUseUnpressed(ctx) {
        if (!ctx || !ctx.CONFIG) return;
        const cb = byId('border-opacity-pressed-use-unpressed');
        const input = byId('border-opacity-pressed');
        const value = byId('border-opacity-pressed-val');
        if (!cb || !input || !value) return;
        ctx.CONFIG.borderOpacityPressedUseUnpressed = !!cb.checked;
        if (ctx.CONFIG.borderOpacityPressedUseUnpressed) {
            ctx.CONFIG.borderOpacityPressed = ctx.CONFIG.borderOpacity;
            const p = unitToPercent(ctx.CONFIG.borderOpacity, 0);
            input.value = String(p);
            value.textContent = String(p);
            input.disabled = true;
        } else {
            input.disabled = false;
        }
        if (typeof ctx.invalidateCanvas === 'function') ctx.invalidateCanvas();
    }

    function updateOpacityControlsVisibility(hasBackground) {
        const controlGroups = document.querySelectorAll('.control-group');
        controlGroups.forEach((group) => {
            const label = group.querySelector('label');
            if (!label) return;

            const labelText = label.textContent;
            const isBackgroundControl =
                labelText.includes('背景缩放') ||
                labelText.includes('按键区域背景透明度') ||
                labelText.includes('非按键区域背景透明度');
            const isKeyOpacityControl = labelText.includes('按键透明度');

            if (isBackgroundControl) {
                group.style.display = hasBackground ? 'block' : 'none';
            } else if (isKeyOpacityControl) {
                group.style.display = 'block';
            }
        });
    }

    function updateBgScale(ctx, val) {
        if (!ctx || typeof ctx.setBgScale !== 'function') return;
        ctx.setBgScale(parseInt(val, 10) / 100);
        const label = byId('bg-scale-val');
        if (label) label.textContent = val;
        if (typeof ctx.invalidateCanvas === 'function') ctx.invalidateCanvas();
    }

    function updateBgKeyOpacity(ctx, val) {
        if (!ctx || typeof ctx.setBgKeyOpacity !== 'function') return;
        ctx.setBgKeyOpacity(percentToUnit(val, 0.8));
        const label = byId('bg-key-opacity-val');
        if (label) label.textContent = val;
        if (
            typeof ctx.getBgKeyOpacityPressedUseUnpressed === 'function' &&
            typeof ctx.getBgKeyOpacity === 'function' &&
            typeof ctx.setBgKeyOpacityPressed === 'function' &&
            ctx.getBgKeyOpacityPressedUseUnpressed()
        ) {
            ctx.setBgKeyOpacityPressed(ctx.getBgKeyOpacity());
            const p = unitToPercent(ctx.getBgKeyOpacity(), 0);
            const input = byId('bg-key-opacity-pressed');
            const value = byId('bg-key-opacity-pressed-val');
            if (input) input.value = String(p);
            if (value) value.textContent = String(p);
        }
        if (typeof ctx.invalidateCanvas === 'function') ctx.invalidateCanvas();
    }

    function updateBgKeyOpacityPressed(ctx, val) {
        if (
            !ctx ||
            typeof ctx.setBgKeyOpacityPressed !== 'function' ||
            typeof ctx.getBgKeyOpacityPressedUseUnpressed !== 'function' ||
            typeof ctx.getBgKeyOpacity !== 'function'
        ) {
            return;
        }
        // 防御式处理：若外部状态意外回到“与未按下一致”，用户拖动该滑条时自动切为独立。
        if (ctx.getBgKeyOpacityPressedUseUnpressed()) {
            if (typeof ctx.setBgKeyOpacityPressedUseUnpressed === 'function') {
                ctx.setBgKeyOpacityPressedUseUnpressed(false);
            }
            const cb = byId('bg-key-opacity-pressed-use-unpressed');
            const input = byId('bg-key-opacity-pressed');
            if (cb) cb.checked = false;
            if (input) input.disabled = false;
        }
        ctx.setBgKeyOpacityPressed(percentToUnit(val, ctx.getBgKeyOpacity()));
        const label = byId('bg-key-opacity-pressed-val');
        if (label) label.textContent = val;
        if (typeof ctx.invalidateCanvas === 'function') ctx.invalidateCanvas();
    }

    function toggleBgKeyOpacityPressedUseUnpressed(ctx) {
        if (
            !ctx ||
            typeof ctx.getBgKeyOpacity !== 'function' ||
            typeof ctx.setBgKeyOpacityPressed !== 'function' ||
            typeof ctx.setBgKeyOpacityPressedUseUnpressed !== 'function'
        ) {
            return;
        }
        const cb = byId('bg-key-opacity-pressed-use-unpressed');
        const input = byId('bg-key-opacity-pressed');
        const value = byId('bg-key-opacity-pressed-val');
        if (!cb || !input || !value) return;
        ctx.setBgKeyOpacityPressedUseUnpressed(!!cb.checked);
        if (cb.checked) {
            ctx.setBgKeyOpacityPressed(ctx.getBgKeyOpacity());
            const p = unitToPercent(ctx.getBgKeyOpacity(), 0);
            input.value = String(p);
            value.textContent = String(p);
            input.disabled = true;
        } else {
            input.disabled = false;
        }
        if (typeof ctx.invalidateCanvas === 'function') ctx.invalidateCanvas();
    }

    function updateBgNonKeyOpacity(ctx, val) {
        if (!ctx || typeof ctx.setBgNonKeyOpacity !== 'function') return;
        ctx.setBgNonKeyOpacity((100 - val) / 100);
        const label = byId('bg-non-key-opacity-val');
        if (label) label.textContent = val;
        if (typeof ctx.invalidateCanvas === 'function') ctx.invalidateCanvas();
    }

    function loadBackground(ctx, event) {
        if (!ctx || typeof ctx.setBgImage !== 'function') return;
        const file = event && event.target ? event.target.files[0] : null;
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const nextBgImage = new Image();
            nextBgImage.onload = () => {
                ctx.setBgImage(nextBgImage);
                const bgEl = byId('bg-image');
                const removeBtn = byId('remove-bg-btn');
                if (bgEl) {
                    bgEl.src = e.target.result;
                    bgEl.style.display = 'block';
                }
                if (removeBtn) removeBtn.style.display = 'inline-block';
                updateOpacityControlsVisibility(true);
                if (typeof ctx.invalidateCanvas === 'function') {
                    ctx.invalidateCanvas();
                }
            };
            nextBgImage.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function removeBackground(ctx) {
        if (!ctx) return;
        if (typeof ctx.setBgImage === 'function') ctx.setBgImage(null);
        if (typeof ctx.setBgPosition === 'function') ctx.setBgPosition({ x: 0, y: 0 });
        if (typeof ctx.setBgScale === 'function') ctx.setBgScale(1.0);
        if (typeof ctx.setBgKeyOpacity === 'function') ctx.setBgKeyOpacity(0.8);
        if (typeof ctx.setBgKeyOpacityPressed === 'function') ctx.setBgKeyOpacityPressed(0.8);
        if (typeof ctx.setBgKeyOpacityPressedUseUnpressed === 'function') {
            ctx.setBgKeyOpacityPressedUseUnpressed(true);
        }
        if (typeof ctx.setBgNonKeyOpacity === 'function') ctx.setBgNonKeyOpacity(0.8);

        const bgEl = byId('bg-image');
        if (bgEl) {
            bgEl.src = '';
            bgEl.style.display = 'none';
        }

        const bgScale = byId('bg-scale');
        const bgScaleVal = byId('bg-scale-val');
        const bgKeyOpacity = byId('bg-key-opacity');
        const bgKeyOpacityVal = byId('bg-key-opacity-val');
        const bgNonKeyOpacity = byId('bg-non-key-opacity');
        const bgNonKeyOpacityVal = byId('bg-non-key-opacity-val');
        const upload = byId('bg-upload');
        const removeBtn = byId('remove-bg-btn');

        if (bgScale) bgScale.value = 100;
        if (bgScaleVal) bgScaleVal.textContent = 100;
        if (bgKeyOpacity) bgKeyOpacity.value = 80;
        if (bgKeyOpacityVal) bgKeyOpacityVal.textContent = 80;
        const bgKeyOpacityPressed = byId('bg-key-opacity-pressed');
        const bgKeyOpacityPressedVal = byId('bg-key-opacity-pressed-val');
        const bgKeyOpacityPressedUse = byId('bg-key-opacity-pressed-use-unpressed');
        if (bgKeyOpacityPressed) {
            bgKeyOpacityPressed.value = 80;
            bgKeyOpacityPressed.disabled = true;
        }
        if (bgKeyOpacityPressedVal) bgKeyOpacityPressedVal.textContent = 80;
        if (bgKeyOpacityPressedUse) bgKeyOpacityPressedUse.checked = true;
        if (bgNonKeyOpacity) bgNonKeyOpacity.value = 20;
        if (bgNonKeyOpacityVal) bgNonKeyOpacityVal.textContent = 20;
        if (upload) upload.value = '';
        if (removeBtn) removeBtn.style.display = 'none';

        updateOpacityControlsVisibility(false);
        if (typeof ctx.invalidateCanvas === 'function') {
            ctx.invalidateCanvas();
        }
    }

    globalObj.KeyboardPanelModule = {
        toggleControls,
        hideControls,
        updateOpacity,
        updateOpacityPressed,
        toggleKeyOpacityPressedUseUnpressed,
        updateTextOpacity,
        updateTextOpacityPressed,
        toggleTextOpacityPressedUseUnpressed,
        updateBorderOpacity,
        updateBorderOpacityPressed,
        toggleBorderOpacityPressedUseUnpressed,
        updateOpacityControlsVisibility,
        updateBgScale,
        updateBgKeyOpacity,
        updateBgKeyOpacityPressed,
        toggleBgKeyOpacityPressedUseUnpressed,
        updateBgNonKeyOpacity,
        loadBackground,
        removeBackground
    };
})(window);

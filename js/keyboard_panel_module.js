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

    function updateOpacity(ctx, val) {
        if (!ctx || !ctx.CONFIG) return;
        ctx.CONFIG.keyOpacity = (100 - val) / 100;
        const label = byId('key-opacity-val');
        if (label) label.textContent = val;
        if (typeof ctx.invalidateCanvas === 'function') {
            ctx.invalidateCanvas();
        }
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
        ctx.setBgKeyOpacity((100 - val) / 100);
        const label = byId('bg-key-opacity-val');
        if (label) label.textContent = val;
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
        updateOpacityControlsVisibility,
        updateBgScale,
        updateBgKeyOpacity,
        updateBgNonKeyOpacity,
        loadBackground,
        removeBackground
    };
})(window);

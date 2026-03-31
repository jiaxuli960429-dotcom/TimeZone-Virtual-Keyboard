(function initKeyboardKeyBgModule(globalObj) {
    'use strict';

    function setupKeyBackgroundImageUI(ctx, key) {
        const fileInput = document.getElementById('edit-key-bg-image');
        const removeBtn = document.getElementById('remove-key-bg-btn');
        const previewDiv = document.getElementById('key-bg-preview');
        const previewImg = document.getElementById('key-bg-preview-img');
        if (!fileInput || !removeBtn || !previewDiv || !previewImg) return;

        fileInput.value = '';
        if (key && key.bgImage) {
            previewImg.src = key.bgImage;
            previewDiv.style.display = 'block';
            removeBtn.style.display = 'inline-block';
        } else {
            previewDiv.style.display = 'none';
            removeBtn.style.display = 'none';
        }
    }

    function loadKeyBackgroundImage(ctx, event) {
        const file = event && event.target ? event.target.files[0] : null;
        const editingKey = ctx.getEditingKey();
        if (!file || !editingKey) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = e.target.result;
            const img = new Image();
            img.onload = () => {
                editingKey.bgImage = imageData;
                editingKey._bgImageObj = img;
                editingKey.bgOpacity = 1.0;

                const previewDiv = document.getElementById('key-bg-preview');
                const previewImg = document.getElementById('key-bg-preview-img');
                const removeBtn = document.getElementById('remove-key-bg-btn');
                const bgOpacityRow = document.getElementById('key-bg-opacity-row');
                const bgModeRow = document.getElementById('key-bg-mode-row');

                if (previewImg) previewImg.src = imageData;
                if (previewDiv) previewDiv.style.display = 'block';
                if (removeBtn) removeBtn.style.display = 'inline-block';
                if (bgOpacityRow) bgOpacityRow.style.display = 'flex';
                if (bgModeRow) bgModeRow.style.display = 'flex';

                const pressedRow = document.getElementById('key-bg-pressed-row');
                if (pressedRow) pressedRow.style.display = 'flex';

                const bgOpacity = document.getElementById('edit-key-bg-opacity');
                const bgOpacityVal = document.getElementById('edit-key-bg-opacity-val');
                const bgOpacityPressed = document.getElementById('edit-key-bg-opacity-pressed');
                const bgOpacityPressedVal = document.getElementById('edit-key-bg-opacity-pressed-val');
                const bgOpacityPressedUse = document.getElementById('edit-key-bg-opacity-pressed-use-unpressed');
                if (bgOpacity) bgOpacity.value = 0;
                if (bgOpacityVal) bgOpacityVal.textContent = 0;
                if (bgOpacityPressed) {
                    bgOpacityPressed.value = 0;
                    bgOpacityPressed.disabled = true;
                }
                if (bgOpacityPressedVal) bgOpacityPressedVal.textContent = 0;
                if (bgOpacityPressedUse) bgOpacityPressedUse.checked = true;
                editingKey.bgOpacityPressedUseUnpressed = true;
                editingKey.bgOpacityPressed = editingKey.bgOpacity;

                ctx.setKeyBgMode('advanced');
                if (ctx.getEditingKey()) {
                    ctx.getEditingKey().bgMode = 'advanced';
                }
                ctx.updateKeyBgModeUI();
                ctx.invalidateCanvas();
            };
            img.src = imageData;
        };
        reader.readAsDataURL(file);
    }

    function setupKeyBackgroundPressedImageUI(ctx, key) {
        const fileInput = document.getElementById('edit-key-bg-pressed-image');
        const removeBtn = document.getElementById('remove-key-bg-pressed-btn');
        const previewDiv = document.getElementById('key-bg-pressed-preview');
        const previewImg = document.getElementById('key-bg-pressed-preview-img');
        if (!fileInput || !removeBtn || !previewDiv || !previewImg) return;

        fileInput.value = '';
        if (key && key.bgPressedImage) {
            previewImg.src = key.bgPressedImage;
            previewDiv.style.display = 'block';
            removeBtn.style.display = 'inline-block';
        } else {
            previewDiv.style.display = 'none';
            removeBtn.style.display = 'none';
        }
    }

    function loadKeyBackgroundPressedImage(ctx, event) {
        const file = event && event.target ? event.target.files[0] : null;
        const editingKey = ctx.getEditingKey();
        if (!file || !editingKey || !editingKey.bgImage) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = e.target.result;
            const img = new Image();
            img.onload = () => {
                editingKey.bgPressedImage = imageData;
                editingKey._bgPressedImageObj = img;

                const previewDiv = document.getElementById('key-bg-pressed-preview');
                const previewImg = document.getElementById('key-bg-pressed-preview-img');
                const removeBtn = document.getElementById('remove-key-bg-pressed-btn');
                if (previewImg) previewImg.src = imageData;
                if (previewDiv) previewDiv.style.display = 'block';
                if (removeBtn) removeBtn.style.display = 'inline-block';

                ctx.invalidateCanvas();
            };
            img.src = imageData;
        };
        reader.readAsDataURL(file);
    }

    function removeKeyBackgroundPressedImage(ctx) {
        const editingKey = ctx.getEditingKey();
        if (!editingKey) return;

        delete editingKey.bgPressedImage;
        delete editingKey._bgPressedImageObj;

        const fileInput = document.getElementById('edit-key-bg-pressed-image');
        const removeBtn = document.getElementById('remove-key-bg-pressed-btn');
        const previewDiv = document.getElementById('key-bg-pressed-preview');
        if (fileInput) fileInput.value = '';
        if (previewDiv) previewDiv.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'none';
        ctx.invalidateCanvas();
    }

    function removeKeyBackgroundImage(ctx) {
        const editingKey = ctx.getEditingKey();
        if (!editingKey) return;

        delete editingKey.bgImage;
        delete editingKey._bgImageObj;
        delete editingKey.bgOpacity;
        delete editingKey.bgMode;
        delete editingKey.bgScale;
        delete editingKey.bgOffsetX;
        delete editingKey.bgOffsetY;
        delete editingKey.bgPressedImage;
        delete editingKey._bgPressedImageObj;

        const fileInput = document.getElementById('edit-key-bg-image');
        const removeBtn = document.getElementById('remove-key-bg-btn');
        const previewDiv = document.getElementById('key-bg-preview');
        const bgOpacityRow = document.getElementById('key-bg-opacity-row');
        const bgModeRow = document.getElementById('key-bg-mode-row');
        const bgAdvancedRow = document.getElementById('key-bg-advanced-row');
        const bgOpacityPressed = document.getElementById('edit-key-bg-opacity-pressed');
        const bgOpacityPressedVal = document.getElementById('edit-key-bg-opacity-pressed-val');
        const bgOpacityPressedUse = document.getElementById('edit-key-bg-opacity-pressed-use-unpressed');

        if (fileInput) fileInput.value = '';
        if (previewDiv) previewDiv.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'none';
        if (bgOpacityRow) bgOpacityRow.style.display = 'none';
        if (bgModeRow) bgModeRow.style.display = 'none';
        if (bgAdvancedRow) bgAdvancedRow.style.display = 'none';
        if (bgOpacityPressed) {
            bgOpacityPressed.value = 0;
            bgOpacityPressed.disabled = true;
        }
        if (bgOpacityPressedVal) bgOpacityPressedVal.textContent = 0;
        if (bgOpacityPressedUse) bgOpacityPressedUse.checked = true;

        const pressedRow = document.getElementById('key-bg-pressed-row');
        if (pressedRow) pressedRow.style.display = 'none';
        setupKeyBackgroundPressedImageUI(ctx, editingKey);

        ctx.invalidateCanvas();
    }

    function toggleKeyOpacity(ctx) {
        const useGlobal = document.getElementById('use-global-opacity').checked;
        const opacityInput = document.getElementById('edit-key-opacity');
        const opacityValue = document.getElementById('edit-key-opacity-val');
        if (!opacityInput || !opacityValue) return;

        if (useGlobal) {
            const globalOpacityValue = Math.round((1 - ctx.CONFIG.keyOpacity) * 100);
            opacityInput.value = globalOpacityValue;
            opacityValue.textContent = globalOpacityValue;
            opacityInput.disabled = true;
            if (ctx.getEditingKey()) {
                delete ctx.getEditingKey().opacity;
            }
        } else {
            opacityInput.disabled = false;
            if (ctx.getEditingKey()) {
                ctx.getEditingKey().opacity = (100 - parseInt(opacityInput.value, 10)) / 100;
            }
        }
        ctx.invalidateCanvas();
    }

    function updateKeyOpacityPreview(ctx, value) {
        const opacityVal = document.getElementById('edit-key-opacity-val');
        if (opacityVal) opacityVal.textContent = value;
        if (ctx.getEditingKey()) {
            ctx.getEditingKey().opacity = (100 - parseInt(value, 10)) / 100;
        }
        ctx.invalidateCanvas();
    }

    function updateKeyBgOpacityPreview(ctx, value) {
        const bgOpacityVal = document.getElementById('edit-key-bg-opacity-val');
        if (bgOpacityVal) bgOpacityVal.textContent = value;
        if (ctx.getEditingKey()) {
            ctx.getEditingKey().bgOpacity = (100 - parseInt(value, 10)) / 100;
            if (ctx.getEditingKey().bgOpacityPressedUseUnpressed) {
                ctx.getEditingKey().bgOpacityPressed = ctx.getEditingKey().bgOpacity;
                const pressedVal = document.getElementById('edit-key-bg-opacity-pressed-val');
                const pressedInput = document.getElementById('edit-key-bg-opacity-pressed');
                const p = Math.round((1 - ctx.getEditingKey().bgOpacity) * 100);
                if (pressedVal) pressedVal.textContent = p;
                if (pressedInput) pressedInput.value = p;
            }
        }
        ctx.invalidateCanvas();
    }

    function toggleKeyBgOpacityPressedUseUnpressed(ctx) {
        const cb = document.getElementById('edit-key-bg-opacity-pressed-use-unpressed');
        const input = document.getElementById('edit-key-bg-opacity-pressed');
        const val = document.getElementById('edit-key-bg-opacity-pressed-val');
        if (!cb || !input || !val || !ctx.getEditingKey()) return;
        const key = ctx.getEditingKey();
        key.bgOpacityPressedUseUnpressed = !!cb.checked;
        if (key.bgOpacityPressedUseUnpressed) {
            const base = key.bgOpacity !== undefined ? key.bgOpacity : 1;
            key.bgOpacityPressed = base;
            const p = Math.round((1 - base) * 100);
            input.value = p;
            val.textContent = p;
            input.disabled = true;
        } else {
            input.disabled = false;
        }
        ctx.invalidateCanvas();
    }

    function updateKeyBgOpacityPressedPreview(ctx, value) {
        const val = document.getElementById('edit-key-bg-opacity-pressed-val');
        if (val) val.textContent = value;
        if (ctx.getEditingKey()) {
            ctx.getEditingKey().bgOpacityPressed = (100 - parseInt(value, 10)) / 100;
        }
        ctx.invalidateCanvas();
    }

    function updateKeyBgScalePreview(ctx, value) {
        const bgScaleVal = document.getElementById('edit-key-bg-scale-val');
        if (bgScaleVal) bgScaleVal.textContent = value;
        if (ctx.getEditingKey()) {
            ctx.getEditingKey().bgScale = parseInt(value, 10) / 100;
        }
        ctx.invalidateCanvas();
    }

    function updateKeyBgPositionPreview(ctx) {
        const xInput = document.getElementById('edit-key-bg-x');
        const yInput = document.getElementById('edit-key-bg-y');
        const xVal = document.getElementById('edit-key-bg-x-val');
        const yVal = document.getElementById('edit-key-bg-y-val');
        const x = xInput ? parseInt(xInput.value, 10) || 0 : 0;
        const y = yInput ? parseInt(yInput.value, 10) || 0 : 0;
        if (xVal) xVal.textContent = x;
        if (yVal) yVal.textContent = y;
        if (ctx.getEditingKey()) {
            ctx.getEditingKey().bgOffsetX = x;
            ctx.getEditingKey().bgOffsetY = y;
        }
        ctx.invalidateCanvas();
    }

    function resetKeyBgTransform(ctx) {
        const scale = document.getElementById('edit-key-bg-scale');
        const scaleVal = document.getElementById('edit-key-bg-scale-val');
        if (scale) scale.value = 100;
        if (scaleVal) scaleVal.textContent = 100;
        if (ctx.getEditingKey()) {
            ctx.getEditingKey().bgScale = 1.0;
            ctx.getEditingKey().bgOffsetX = 0;
            ctx.getEditingKey().bgOffsetY = 0;
        }
        ctx.invalidateCanvas();
    }

    function toggleKeyBgViewMode(ctx) {
        const nextMode = ctx.getKeyBgViewMode() === 'full' ? 'clipped' : 'full';
        ctx.setKeyBgViewMode(nextMode);
        const btn = document.getElementById('toggle-bg-view-mode');
        if (btn) {
            btn.textContent = nextMode === 'full' ? '显示模式: 完整背景' : '显示模式: 按键内裁剪';
        }
        ctx.invalidateCanvas();
    }

    function setKeyBgMode(ctx, mode) {
        ctx.setKeyBgMode(mode);
        if (ctx.getEditingKey()) {
            ctx.getEditingKey().bgMode = mode;
        }
        ctx.updateKeyBgModeUI();
        if (mode === 'simple' && ctx.getEditingKey()) {
            ctx.getEditingKey().bgOffsetX = 0;
            ctx.getEditingKey().bgOffsetY = 0;
        }
        ctx.invalidateCanvas();
    }

    function updateKeyBgModeUI(ctx) {
        const simpleBtn = document.getElementById('key-bg-mode-simple');
        const advancedBtn = document.getElementById('key-bg-mode-advanced');
        const advancedRow = document.getElementById('key-bg-advanced-row');
        if (!simpleBtn || !advancedBtn || !advancedRow) return;

        if (ctx.getKeyBgMode() === 'simple') {
            simpleBtn.classList.add('btn-primary');
            advancedBtn.classList.remove('btn-primary');
            advancedRow.style.display = 'none';
        } else {
            simpleBtn.classList.remove('btn-primary');
            advancedBtn.classList.add('btn-primary');
            advancedRow.style.display = 'flex';
        }
    }

    globalObj.KeyboardKeyBgModule = {
        setupKeyBackgroundImageUI,
        setupKeyBackgroundPressedImageUI,
        loadKeyBackgroundImage,
        loadKeyBackgroundPressedImage,
        removeKeyBackgroundImage,
        removeKeyBackgroundPressedImage,
        toggleKeyOpacity,
        updateKeyOpacityPreview,
        updateKeyBgOpacityPreview,
        toggleKeyBgOpacityPressedUseUnpressed,
        updateKeyBgOpacityPressedPreview,
        updateKeyBgScalePreview,
        updateKeyBgPositionPreview,
        resetKeyBgTransform,
        toggleKeyBgViewMode,
        setKeyBgMode,
        updateKeyBgModeUI
    };
})(window);

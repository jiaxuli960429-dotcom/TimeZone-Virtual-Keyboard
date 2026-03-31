(function initKeyboardPureUtils(globalObj) {
    'use strict';

    const KEY_PERSISTENT_PROPS = [
        'code', 'label', 'x', 'y', 'width', 'height',
        'activeColor', 'inactiveColor', 'activeColorUseInactive',
        'opacity', 'opacityPressed', 'opacityPressedUseUnpressed',
        'textColor', 'textColorPressed', 'textColorPressedUseUnpressed',
        'textOpacity', 'textOpacityPressed', 'textOpacityPressedUseUnpressed',
        'borderColor', 'borderColorPressed', 'borderColorPressedUseUnpressed',
        'borderOpacity', 'borderOpacityPressed', 'borderOpacityPressedUseUnpressed',
        'bgImage', 'bgPressedImage', 'bgOpacity', 'bgOpacityPressed', 'bgOpacityPressedUseUnpressed',
        'bgScale', 'bgOffsetX', 'bgOffsetY', 'bgMode'
    ];

    function cleanKeyForSave(key) {
        const cleaned = {};
        KEY_PERSISTENT_PROPS.forEach((prop) => {
            if (key[prop] !== undefined) {
                cleaned[prop] = key[prop];
            }
        });
        return cleaned;
    }

    function keyFromPersistedData(keyData, options) {
        const opts = options || {};
        const onInvalidate = typeof opts.onInvalidate === 'function' ? opts.onInvalidate : function noop() {};

        const key = cleanKeyForSave(keyData || {});
        if (key.activeColorUseInactive === undefined && key.activeColor !== undefined) {
            key.activeColorUseInactive = key.inactiveColor !== undefined ? key.activeColor === key.inactiveColor : false;
        }
        if (key.opacityPressed === undefined && key.opacity !== undefined) key.opacityPressed = key.opacity;
        if (key.opacityPressedUseUnpressed === undefined && (key.opacity !== undefined || key.opacityPressed !== undefined)) {
            key.opacityPressedUseUnpressed = true;
        }
        if (key.textColorPressed === undefined && key.textColor !== undefined) key.textColorPressed = key.textColor;
        if (
            key.textColorPressedUseUnpressed === undefined &&
            (key.textColor !== undefined || key.textColorPressed !== undefined)
        ) {
            key.textColorPressedUseUnpressed = true;
        }
        if (key.textOpacityPressed === undefined && key.textOpacity !== undefined) key.textOpacityPressed = key.textOpacity;
        if (
            key.textOpacityPressedUseUnpressed === undefined &&
            (key.textOpacity !== undefined || key.textOpacityPressed !== undefined)
        ) {
            key.textOpacityPressedUseUnpressed = true;
        }
        if (key.borderColorPressed === undefined && key.borderColor !== undefined) key.borderColorPressed = key.borderColor;
        if (
            key.borderColorPressedUseUnpressed === undefined &&
            (key.borderColor !== undefined || key.borderColorPressed !== undefined)
        ) {
            key.borderColorPressedUseUnpressed = true;
        }
        if (key.borderOpacityPressed === undefined && key.borderOpacity !== undefined) key.borderOpacityPressed = key.borderOpacity;
        if (
            key.borderOpacityPressedUseUnpressed === undefined &&
            (key.borderOpacity !== undefined || key.borderOpacityPressed !== undefined)
        ) {
            key.borderOpacityPressedUseUnpressed = true;
        }
        if (key.bgOpacityPressed === undefined && key.bgOpacity !== undefined) key.bgOpacityPressed = key.bgOpacity;
        if (key.bgOpacityPressedUseUnpressed === undefined && (key.bgOpacity !== undefined || key.bgOpacityPressed !== undefined)) {
            key.bgOpacityPressedUseUnpressed = true;
        }
        // 兼容修复：历史版本可能把“按下与未按下一致”标记批量写到所有键，导致全局按下态配置失效。
        // 若该键本身没有对应的单键外观覆盖，则清理这些标记，回退到全局按下态逻辑。
        if (key.opacity === undefined && key.opacityPressed === undefined) {
            delete key.opacityPressedUseUnpressed;
        }
        if (key.textColor === undefined && key.textColorPressed === undefined) {
            delete key.textColorPressedUseUnpressed;
        }
        if (key.textOpacity === undefined && key.textOpacityPressed === undefined) {
            delete key.textOpacityPressedUseUnpressed;
        }
        if (key.borderColor === undefined && key.borderColorPressed === undefined) {
            delete key.borderColorPressedUseUnpressed;
        }
        if (key.borderOpacity === undefined && key.borderOpacityPressed === undefined) {
            delete key.borderOpacityPressedUseUnpressed;
        }
        if (key.activeColor === undefined && key.inactiveColor === undefined) {
            delete key.activeColorUseInactive;
        }
        if (key.bgImage) {
            const img = new Image();
            img.onload = () => {
                key._bgImageObj = img;
                onInvalidate();
            };
            img.onerror = () => {
                key._bgImageLoadFailed = true;
                onInvalidate();
            };
            img.src = key.bgImage;
        }
        if (key.bgPressedImage) {
            const imgP = new Image();
            imgP.onload = () => {
                key._bgPressedImageObj = imgP;
                onInvalidate();
            };
            imgP.onerror = () => {
                key._bgPressedImageLoadFailed = true;
                onInvalidate();
            };
            imgP.src = key.bgPressedImage;
        }
        return key;
    }

    function snapshotKeysLayout(keys) {
        return (keys || []).map((key) => JSON.parse(JSON.stringify(cleanKeyForSave(key))));
    }

    function snapshotsLayoutEqual(a, b) {
        return JSON.stringify(a) === JSON.stringify(b);
    }

    function buildCurrentConfigObject(state) {
        const safeState = state || {};
        const cleanedKeys = (safeState.keys || []).map(cleanKeyForSave);
        const bgImageEl = safeState.getBgImageElement ? safeState.getBgImageElement() : null;

        return {
            keys: cleanedKeys,
            config: safeState.CONFIG || {},
            bgImage: safeState.bgImage ? (bgImageEl ? bgImageEl.src : '') : '',
            bgPosition: safeState.bgPosition || { x: 0, y: 0 },
            bgScale: safeState.bgScale !== undefined ? safeState.bgScale : 1.0,
            bgKeyOpacity: safeState.bgKeyOpacity !== undefined ? safeState.bgKeyOpacity : 0.8,
            bgKeyOpacityPressed:
                safeState.bgKeyOpacityPressed !== undefined ? safeState.bgKeyOpacityPressed : safeState.bgKeyOpacity,
            bgKeyOpacityPressedUseUnpressed:
                safeState.bgKeyOpacityPressedUseUnpressed !== undefined
                    ? !!safeState.bgKeyOpacityPressedUseUnpressed
                    : true,
            bgNonKeyOpacity: safeState.bgNonKeyOpacity !== undefined ? safeState.bgNonKeyOpacity : 0.8
        };
    }

    globalObj.KeyboardPureUtils = {
        KEY_PERSISTENT_PROPS,
        cleanKeyForSave,
        keyFromPersistedData,
        snapshotKeysLayout,
        snapshotsLayoutEqual,
        buildCurrentConfigObject
    };
})(window);

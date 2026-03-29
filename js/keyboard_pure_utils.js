(function initKeyboardPureUtils(globalObj) {
    'use strict';

    const KEY_PERSISTENT_PROPS = [
        'code', 'label', 'x', 'y', 'width', 'height',
        'activeColor', 'inactiveColor', 'opacity',
        'bgImage', 'bgOpacity', 'bgScale', 'bgOffsetX', 'bgOffsetY', 'bgMode'
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

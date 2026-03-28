(function initKeyboardSnapControlsModule(globalObj) {
    'use strict';

    function setDisplay(id, display) {
        const el = document.getElementById(id);
        if (el) el.style.display = display;
    }

    function setChecked(id, checked) {
        const el = document.getElementById(id);
        if (el) el.checked = checked;
    }

    function updateStatusByToggles(snapConfig) {
        if (!snapConfig.toEdges && !snapConfig.toCenter && !snapConfig.toAssist) {
            snapConfig.enabled = false;
            snapConfig.status = 'unselected';
            return;
        }
        snapConfig.enabled = true;
        snapConfig.status = 'half-selected';
    }

    function enableAllSnap(snapConfig) {
        snapConfig.enabled = true;
        snapConfig.toEdges = true;
        snapConfig.toCenter = true;
        snapConfig.toAssist = true;
        snapConfig.status = 'selected';

        setChecked('snap-to-edges', true);
        setChecked('snap-to-center', true);
        setChecked('snap-to-assist', true);

        setDisplay('snap-edges-controls', 'block');
        setDisplay('snap-center-controls', 'block');
        setDisplay('snap-assist-controls', 'block');
    }

    function disableAllSnap(snapConfig) {
        snapConfig.enabled = false;
        snapConfig.toEdges = false;
        snapConfig.toCenter = false;
        snapConfig.toAssist = false;
        snapConfig.status = 'unselected';

        setChecked('snap-to-edges', false);
        setChecked('snap-to-center', false);
        setChecked('snap-to-assist', false);

        setDisplay('snap-edges-controls', 'none');
        setDisplay('snap-center-controls', 'none');
        setDisplay('snap-assist-controls', 'none');
    }

    function toggleSnapToEdges(snapConfig) {
        const checkbox = document.getElementById('snap-to-edges');
        snapConfig.toEdges = !!(checkbox && checkbox.checked);
        setDisplay('snap-edges-controls', snapConfig.toEdges ? 'block' : 'none');
        updateStatusByToggles(snapConfig);
    }

    function toggleSnapToCenter(snapConfig) {
        const checkbox = document.getElementById('snap-to-center');
        snapConfig.toCenter = !!(checkbox && checkbox.checked);
        setDisplay('snap-center-controls', snapConfig.toCenter ? 'block' : 'none');
        updateStatusByToggles(snapConfig);
    }

    function toggleSnapToAssist(snapConfig) {
        const checkbox = document.getElementById('snap-to-assist');
        snapConfig.toAssist = !!(checkbox && checkbox.checked);
        setDisplay('snap-assist-controls', snapConfig.toAssist ? 'block' : 'none');
        updateStatusByToggles(snapConfig);
    }

    function updateSnapDistance(snapConfig, val) {
        snapConfig.distance = parseInt(val, 10);
        const label = document.getElementById('snap-distance-val');
        if (label) label.textContent = val;
    }

    function updateSnapAssistThreshold(snapConfig, val) {
        snapConfig.thresholds.assist = parseInt(val, 10);
        const label = document.getElementById('snap-assist-threshold-val');
        if (label) label.textContent = val;
    }

    function updateSnapEdgesThreshold(snapConfig, val) {
        snapConfig.thresholds.edges = parseInt(val, 10);
        const label = document.getElementById('snap-edges-threshold-val');
        if (label) label.textContent = val;
    }

    function updateSnapCenterThreshold(snapConfig, val) {
        snapConfig.thresholds.center = parseInt(val, 10);
        const label = document.getElementById('snap-center-threshold-val');
        if (label) label.textContent = val;
    }

    globalObj.KeyboardSnapControlsModule = {
        enableAllSnap,
        disableAllSnap,
        toggleSnapToEdges,
        toggleSnapToCenter,
        toggleSnapToAssist,
        updateSnapDistance,
        updateSnapAssistThreshold,
        updateSnapEdgesThreshold,
        updateSnapCenterThreshold
    };
})(window);

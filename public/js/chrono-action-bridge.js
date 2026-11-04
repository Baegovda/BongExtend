"use strict";

// Chrono's download features stay available without taking over BongExtend's toolbar.
globalThis.BongExtendChronoAction ||= (() => {
    const ignoreToolbarChange = () => Promise.resolve();
    return {
        setPopup: ignoreToolbarChange,
        setTitle: ignoreToolbarChange,
        setBadgeText: ignoreToolbarChange,
        setIcon: ignoreToolbarChange,
        openPopup: ignoreToolbarChange
    };
})();

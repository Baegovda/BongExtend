// 페이지 세상에서 오른쪽 클릭·복사·글자 선택을 되살린다. 바깥 변수를 캡처하지 않는다.

export function installRightClickGuard() {
    var root = window;
    if (root.__bexRightClick && root.__bexRightClick.stop) root.__bexRightClick.stop();
    var events = ["contextmenu", "selectstart", "copy", "cut", "paste", "dragstart"];
    var stop = function (event) { event.stopPropagation(); };
    var keys = function (event) {
        var key = String(event.key || "").toLowerCase();
        if ((event.ctrlKey || event.metaKey) && (key === "c" || key === "v" || key === "x" || key === "a")) {
            event.stopPropagation();
        }
    };
    events.forEach(function (name) {
        root.addEventListener(name, stop, true);
        document.addEventListener(name, stop, true);
    });
    root.addEventListener("keydown", keys, true);
    var style = document.getElementById("bex-right-click");
    if (!style) {
        style = document.createElement("style");
        style.id = "bex-right-click";
        (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = "*, *::before, *::after { -webkit-user-select: text !important; user-select: text !important; } img, video { pointer-events: auto !important; }";
    var oldAlert = root.alert;
    root.alert = function () {};
    var names = ["oncontextmenu", "onselectstart", "oncopy", "oncut", "onpaste", "ondragstart"];
    var strip = function (node) {
        if (!node || node.nodeType !== 1 || !node.removeAttribute) return;
        names.forEach(function (name) {
            if (node.hasAttribute(name)) node.removeAttribute(name);
        });
    };
    var walk = function (node) {
        strip(node);
        if (!node || !node.children) return;
        Array.prototype.forEach.call(node.children, walk);
    };
    walk(document.documentElement);
    var Observer = root.MutationObserver;
    var observer = new Observer(function (records) {
        records.forEach(function (record) {
            if (record.target) strip(record.target);
            if (record.addedNodes) Array.prototype.forEach.call(record.addedNodes, strip);
        });
    });
    if (document.documentElement) {
        observer.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: names
        });
    }
    root.__bexRightClick = {
        stop: function () {
            events.forEach(function (name) {
                root.removeEventListener(name, stop, true);
                document.removeEventListener(name, stop, true);
            });
            root.removeEventListener("keydown", keys, true);
            observer.disconnect();
            if (style && style.parentNode) style.parentNode.removeChild(style);
            root.alert = oldAlert;
            try { delete root.__bexRightClick; } catch (e) { root.__bexRightClick = undefined; }
        }
    };
}

export function removeRightClickGuard() {
    var guard = window.__bexRightClick;
    if (guard && guard.stop) guard.stop();
}

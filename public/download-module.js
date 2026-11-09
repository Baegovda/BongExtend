// 파일 열기 권한은 해당 동작을 누를 때만 요청해요.
(() => {
    const nativeOpen = chrome.downloads.open?.bind(chrome.downloads);
    if (!nativeOpen) return;
    let canOpen = false;
    chrome.permissions.contains({permissions: ["downloads.open"]}).then(value => {canOpen = value;});
    chrome.downloads.open = (id, callback) => {
        if (canOpen) return nativeOpen(id, callback);
        return chrome.permissions.request({permissions: ["downloads.open"]}).then(granted => {
            if (!granted) throw new Error("파일 열기 권한을 허용해 주세요.");
            canOpen = true;
            return nativeOpen(id, callback);
        });
    };
})();

// Keep Chrono's layout engine and handlers; adapt only its public layout options.
(() => {
    if (location.pathname !== '/ui/index.html') return;
    // The pinned Chrono manager expects these local DB-reader exports. The
    // packaged upstream IDB wrapper does not expose them, so its list loader
    // silently falls back to []. Native readonly transactions restore that
    // connection without remote code, dynamic evaluation, or DB migration.
    const readTasks = async ids => {
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('downloady');
            request.onupgradeneeded = () => request.transaction.abort();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        }).catch(() => null);
        if (!db) return [];
        if (!db.objectStoreNames.contains('tasks-v2')) { db.close(); return []; }
        return new Promise((resolve, reject) => {
            const tx = db.transaction('tasks-v2', 'readonly'), store = tx.objectStore('tasks-v2');
            let result = [];
            tx.oncomplete = () => { db.close(); resolve(result.filter(Boolean)); };
            tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || new Error('다운로드 목록을 읽지 못했어요.')); };
            if (Array.isArray(ids)) {
                result = new Array(ids.length);
                ids.forEach((id, index) => { const request = store.get(id); request.onsuccess = () => { result[index] = request.result; }; });
            } else {
                const request = store.getAll(); request.onsuccess = () => { result = request.result; };
            }
        });
    };
    const exports = globalThis.__cdexp_$0 ||= Object.create(null);
    // Stable aliases from the bundled 3-method UI/WASM interface, not URLs.
    exports._EMVOSPc7GuSRphaa ||= () => readTasks();
    exports._TRSDhfcb25pubqsY ||= ids => readTasks(ids);
    exports._tVohLiVmoDA7UeaI ||= async state => (await readTasks()).filter(task => {
        if (task.recycled) return false;
        // Pinned tasks-v2 states: 3 finished, 4 interrupted; exists is 0/1.
        if (state === 'finished') return task.state === 3;
        if (state === 'interrupted') return task.state === 4;
        if (state === 'both') return task.state === 3 || task.state === 4;
        if (state === 'miss') return task.state === 3 && !task.exists;
        return false;
    }).length;
    const plugin = $.fn.layout;
    $.fn.layout = function(options, ...args) {
        if (this.is('#dy_tot_wrap') && options && typeof options === 'object') {
            const narrow = innerWidth < 560;
            options = {...options, north__size: narrow ? 108 : 64, west__size: narrow ? 112 : 164};
        }
        return plugin.call(this, options, ...args);
    };
    document.addEventListener('DOMContentLoaded', () => {
        // Focus expands the legacy search field. Avoid a mouse-down focus
        // followed by the click handler immediately collapsing it again.
        document.getElementById('dy_searchbox_btn')?.addEventListener('mousedown', event => { if (event.button === 0) event.preventDefault(); });
        const icons = {add:'add',start:'play_arrow',pause:'pause',restart:'refresh',startall:'playlist_play',pauseall:'pause_circle_outline',trash:'delete_outline',restore:'restore',delete:'delete_forever',options:'tune',help:'help_outline'};
        const labels = {add:'새 다운로드',start:'시작',pause:'일시 정지',restart:'다시 시작',startall:'모두 시작',pauseall:'모두 일시 정지',trash:'휴지통으로 이동',restore:'복원',delete:'영구 삭제',options:'설정',help:'도움말'};
        for (const [id, glyph] of Object.entries(icons)) {
            const button = document.getElementById(`dy_tbar_${id}`);
            const icon = button?.querySelector('i');
            if (!icon) continue;
            icon.className = 'material-icons';
            icon.textContent = glyph;
            button.setAttribute('aria-label', labels[id]);
            button.title = labels[id];
            if (id === 'add') { const label = document.createElement('span'); label.textContent = '새 다운로드'; button.append(label); }
        }
        const resize = () => {
            const layout = $('#dy_tot_wrap').data('layout');
            if (!layout) return;
            layout.sizePane('north', innerWidth < 560 ? 108 : 64);
            layout.sizePane('west', innerWidth < 560 ? 112 : 164);
            layout.resizeAll();
        };
        window.addEventListener('resize', resize);
    });
})();

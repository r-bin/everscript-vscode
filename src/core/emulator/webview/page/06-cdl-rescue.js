// TODO port to TS (docs/todo/port-to-ts.md)

    // -- CDL: nothing lost when the extension host dies -----------------------------------
    // The page cannot write files; the extension host does, at most once a minute (cdl/host.ts). Until the
    // host says a delta is on disk (cdlSaved, after its write), the page keeps it here (cdlKeep, from
    // cdlDrain in cdl.js). When the host goes quiet (05-host-watch.js), the page parks what it kept in its
    // own IndexedDB, once: a webview keeps its storage across panels and VS Code restarts (VS Code gives
    // each extension's view type a fixed origin). The next emulator page hands parked sessions to its host
    // (cdlRescue -> cdl/rescue.ts) and deletes them once the host wrote them (cdlRescued). Normal play writes
    // nothing here. A delta is numbered (session, seq): the library records the last one it holds per
    // session, so a rescued delta is merged once (hit counters are summed).
    const CDL_SESSION = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    const CDL_RESCUE_DB = 'everscript-cdl-rescue';
    let cdlSeq = 0;
    let cdlKept = [];          // [{ seq, lib, delta }] sent, not on disk yet
    let cdlRescueLib = null;   // { hash, romSize } of the library the core records into (cdlSeed)
    let cdlParked = false;
    let cdlRescueSent = false;

    function cdlRescueSetLib(lib) {
      cdlRescueLib = lib || null;
    }

    // Numbers a drained delta and keeps it until the host has written it.
    function cdlKeep(delta) {
      delta.session = CDL_SESSION;
      delta.seq = ++cdlSeq;
      if (cdlRescueLib) cdlKept.push({ seq: delta.seq, lib: cdlRescueLib, delta: delta });
    }

    function cdlRescueSaved(data) {
      if (data.session !== CDL_SESSION) return;
      cdlKept = cdlKept.filter(k => k.seq > data.seq);
      if (!cdlKept.length && cdlParked) {
        cdlParked = false;
        cdlRescueStore('readwrite', s => s.delete(CDL_SESSION)).catch(() => {});
        emuAlertClear('cdl-park');
      }
    }

    // One IndexedDB call: fn(store) -> request; resolves with its result.
    function cdlRescueStore(mode, fn) {
      return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') { reject(new Error('no IndexedDB')); return; }
        const open = indexedDB.open(CDL_RESCUE_DB, 1);
        open.onupgradeneeded = () => open.result.createObjectStore('sessions', { keyPath: 'session' });
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('sessions', mode);
          const req = fn(tx.objectStore('sessions'));
          tx.oncomplete = () => { db.close(); resolve(req ? req.result : undefined); };
          tx.onerror = () => { db.close(); reject(tx.error); };
          tx.onabort = () => { db.close(); reject(tx.error); };
        };
      });
    }

    // The host stopped answering: put what is not on disk where the next page finds it.
    function cdlRescuePark() {
      if (typeof cdlDrain === 'function') cdlDrain();
      if (!cdlKept.length) return;
      const record = { session: CDL_SESSION, at: Date.now(), entries: cdlKept.slice() };
      cdlRescueStore('readwrite', s => s.put(record)).then(() => {
        cdlParked = true;
        emuAlert('cdl-park', 'The CDL recorded since the last save (' + record.entries.length + ' parts) is kept in this'
          + ' page\'s storage; the next emulator page hands it to the library.');
      }, err => {
        emuAlert('cdl-park', 'The CDL recorded since the last save could not be kept (' + (err && err.message || err)
          + '): keep this tab open; it goes to the library if VS Code answers again.');
      });
    }

    // A fresh page with a working host: hand over what earlier pages parked.
    function cdlRescueSend() {
      if (cdlRescueSent) return;
      cdlRescueSent = true;
      cdlRescueStore('readonly', s => s.getAll()).then(records => {
        for (const r of records || []) {
          if (r.session !== CDL_SESSION) vscodeApi.postMessage({ command: 'cdlRescue', session: r.session, at: r.at, entries: r.entries });
        }
      }, () => {});
    }

    function cdlRescueDone(data) {
      if (data.session && data.session !== CDL_SESSION) cdlRescueStore('readwrite', s => s.delete(data.session)).catch(() => {});
    }

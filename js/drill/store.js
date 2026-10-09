// Palette Drill: its own saved work, in its own IndexedDB database. Shares
// nothing with the camp's storage. Falls back to memory if storage is blocked.
(function () {
  const DB_NAME = "palette-drill";
  const STORE = "drill";
  const memory = new Map();
  let dbPromise = null;

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve) => {
        try {
          const req = indexedDB.open(DB_NAME, 1);
          req.onupgradeneeded = () => req.result.createObjectStore(STORE);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch (_) {
          resolve(null);
        }
      });
    }
    return dbPromise;
  }

  function run(mode, fn, fallback) {
    return open().then((db) => new Promise((resolve) => {
      if (!db) return resolve(fallback());
      try {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        if (mode === "readwrite") tx.oncomplete = tx.onerror = () => resolve();
        else { req.onsuccess = () => resolve(req.result); req.onerror = () => resolve(fallback()); }
      } catch (_) {
        resolve(fallback());
      }
    }));
  }

  const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  const get = (key) => run("readonly", (s) => s.get(key), () => clone(memory.get(key)));
  const set = (key, value) => { memory.set(key, clone(value)); return run("readwrite", (s) => s.put(clone(value), key), () => {}); };
  const keys = () => run("readonly", (s) => s.getAllKeys(), () => [...memory.keys()]).then((k) => (k || []).map(String));

  window.PDStore = { get, set, keys };
})();

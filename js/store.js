// Keeps uploaded screens in the browser (IndexedDB) so later rounds can show
// them next to the references. Falls back to memory if storage is blocked.
(function () {
  const DB_NAME = "design-training-camp";
  const STORE = "screens";
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

  async function get(key) {
    const db = await open();
    if (!db) return memory.get(key);
    return new Promise((resolve) => {
      try {
        const req = db.transaction(STORE).objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(memory.get(key));
      } catch (_) {
        resolve(memory.get(key));
      }
    });
  }

  async function set(key, value) {
    memory.set(key, value);
    const db = await open();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = tx.onerror = () => resolve();
      } catch (_) {
        resolve();
      }
    });
  }

  // One record per day and round, e.g. "2026-10-02:design".
  function key(round, date) {
    return window.DTC.dateKey(date) + ":" + round;
  }

  window.DTCStore = { get, set, key };
})();

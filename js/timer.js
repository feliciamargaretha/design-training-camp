// Round countdown. Starts the first time the round opens, keeps counting
// across reloads, and pauses or resumes when the time is clicked.
(function () {
  function create({ el, stateEl, round, label, minutes }) {
    const duration = minutes * 60 * 1000;
    const key = "dtc:timer:" + window.DTCStore.key(round);
    let timer = null;
    let interval = null;

    function read() {
      try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; }
    }
    function write() {
      try { localStorage.setItem(key, JSON.stringify(timer)); } catch (_) {}
    }
    function left() {
      if (!timer) return duration;
      return timer.startedAt
        ? Math.max(0, timer.remaining - (Date.now() - timer.startedAt))
        : timer.remaining;
    }
    function tick() {
      const ms = left();
      const s = Math.ceil(ms / 1000);
      el.textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
      const paused = !timer || !timer.startedAt;
      el.classList.toggle("is-paused", !!timer && paused && ms > 0);
      el.classList.toggle("is-done", ms === 0);
      el.setAttribute("aria-label", paused ? "Resume timer" : "Pause timer");
      stateEl.textContent = label + " · " + (ms === 0 ? "Time's up" : timer && paused ? "Paused" : minutes + " min");
      if (ms === 0 && interval) {
        clearInterval(interval);
        interval = null;
      }
    }

    el.addEventListener("click", () => {
      if (!timer || left() === 0) return;
      timer = timer.startedAt
        ? { remaining: left(), startedAt: null }
        : { remaining: timer.remaining, startedAt: Date.now() };
      write();
      tick();
    });

    timer = read();
    tick();

    return {
      start() {
        if (!timer) {
          timer = { remaining: duration, startedAt: Date.now() };
          write();
        }
        if (!interval && left() > 0) interval = setInterval(tick, 250);
        tick();
      },
    };
  }

  window.DTCTimer = { create };
})();

(function () {
  const $ = (id) => document.getElementById(id);
  const challenge = window.DTC.today();
  const DURATION = 10 * 60 * 1000;
  const timerKey = "dtc:timer:" + window.DTCStore.key("study");
  const notesKey = window.DTCStore.key("study");

  // ---------- Timer (survives reloads, click to pause) ----------
  const timerEl = $("timer");
  const stateEl = $("timer-state");
  let timer = readTimer() || { remaining: DURATION, startedAt: Date.now() };

  function readTimer() {
    try { return JSON.parse(localStorage.getItem(timerKey)); } catch (_) { return null; }
  }
  function writeTimer() {
    try { localStorage.setItem(timerKey, JSON.stringify(timer)); } catch (_) {}
  }
  function left() {
    return timer.startedAt
      ? Math.max(0, timer.remaining - (Date.now() - timer.startedAt))
      : timer.remaining;
  }
  function tick() {
    const ms = left();
    const s = Math.ceil(ms / 1000);
    timerEl.textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    const paused = !timer.startedAt;
    timerEl.classList.toggle("is-paused", paused && ms > 0);
    timerEl.classList.toggle("is-done", ms === 0);
    timerEl.setAttribute("aria-label", paused ? "Resume timer" : "Pause timer");
    stateEl.textContent = ms === 0
      ? "Round 2 of 4 · Time's up"
      : paused ? "Round 2 of 4 · Paused" : "Round 2 of 4 · 10 min";
  }
  timerEl.addEventListener("click", () => {
    if (left() === 0) return;
    timer = timer.startedAt
      ? { remaining: left(), startedAt: null }
      : { remaining: timer.remaining, startedAt: Date.now() };
    writeTimer();
    tick();
  });
  writeTimer();
  tick();
  setInterval(tick, 250);

  // ---------- References ----------
  const refs = $("refs");
  $("refs-mobbin").href = window.DTC.mobbinUrl(challenge);

  function renderSkeleton() {
    refs.replaceChildren(...Array.from({ length: 5 }, () => {
      const li = document.createElement("li");
      li.className = "ref ref--loading";
      li.innerHTML = '<div class="ref__shot"></div><p class="ref__app"></p><p class="ref__caption"></p>';
      li.setAttribute("aria-hidden", "true");
      return li;
    }));
  }

  function renderScreens(screens) {
    refs.replaceChildren(...screens.map((s) => {
      const li = document.createElement("li");
      li.className = "ref";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ref__shot";
      const img = document.createElement("img");
      img.src = s.image;
      img.alt = s.appName + " " + challenge.name.toLowerCase() + " screen";
      btn.append(img);
      btn.addEventListener("click", () => openLightbox(s));
      const app = document.createElement("p");
      app.className = "ref__app";
      app.textContent = s.appName;
      const cap = document.createElement("a");
      cap.className = "ref__caption";
      cap.href = s.url;
      cap.target = "_blank";
      cap.rel = "noopener";
      cap.textContent = "View on Mobbin ↗";
      li.append(btn, app, cap);
      return li;
    }));
  }

  function numberWord(n) {
    return ["Zero", "One", "Two", "Three", "Four", "Five", "Six"][n] || String(n);
  }

  renderSkeleton();
  window.DTCRefs.load(challenge).then(({ status, screens, message, notice }) => {
    if (status === "ok" && screens.length) {
      if (notice) {
        $("refs-notice").textContent = notice;
        $("refs-notice").hidden = false;
      }
      $("refs-title").textContent = numberWord(screens.length) + " " + challenge.name.toLowerCase() + " screens. Plenty to notice.";
      $("refs-note").textContent = challenge.name + " references · Click to enlarge";
      renderScreens(screens);
    } else {
      refs.hidden = true;
      $("refs-title").textContent = "Today's pattern: " + challenge.name + ". Plenty to notice.";
      $("refs-note").textContent = "References from Mobbin";
      $("refs-empty").hidden = false;
      $("refs-empty-text").textContent = message;
    }
  });

  // ---------- Lightbox ----------
  const lightbox = $("lightbox");
  function openLightbox(s) {
    $("lightbox-img").src = s.image;
    $("lightbox-img").alt = s.appName + " " + challenge.name.toLowerCase() + " screen";
    $("lightbox-app").textContent = s.appName;
    $("lightbox-link").href = s.url;
    lightbox.showModal();
  }
  $("lightbox-close").addEventListener("click", () => lightbox.close());
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) lightbox.close(); });

  // ---------- Notes ----------
  const inputs = [...document.querySelectorAll(".notice input")];
  let saveTimer = null;
  function saveNotes() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const notes = { challengeId: challenge.id };
      inputs.forEach((i) => (notes[i.id] = i.value));
      window.DTCStore.set(notesKey, notes);
    }, 200);
  }
  inputs.forEach((i) => i.addEventListener("input", saveNotes));
  window.DTCStore.get(notesKey).then((saved) => {
    if (saved && saved.challengeId === challenge.id) {
      inputs.forEach((i) => (i.value = saved[i.id] || ""));
    }
  });
})();

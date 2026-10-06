// Study round: the brief's Mobbin references, a 10-minute timer and your notes.
(function () {
  const root = document.querySelector('[data-page="study"]');
  const $ = (id) => document.getElementById(id);
  const challenge = window.DTC.today();
  const notesKey = window.DTCStore.key("study");

  const timer = window.DTCTimer.create({
    el: $("study-timer"),
    stateEl: $("study-timer-state"),
    round: "study",
    label: "Round 2 of 5",
    minutes: 10,
  });

  // ---------- References ----------
  const refs = $("refs");
  $("refs-mobbin").href = window.DTC.mobbinUrl(challenge);

  function numberWord(n) {
    return ["Zero", "One", "Two", "Three", "Four", "Five", "Six"][n] || String(n);
  }

  function renderSkeleton() {
    refs.replaceChildren(...Array.from({ length: 5 }, () => {
      const li = document.createElement("li");
      li.className = "ref ref--loading";
      li.setAttribute("aria-hidden", "true");
      li.innerHTML = '<div class="ref__shot"></div><p class="ref__app"></p><p class="ref__caption"></p>';
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
      img.alt = s.appName + " " + window.DTC.refNoun(challenge);
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

  let loaded = false;
  function loadReferences() {
    if (loaded) return;
    loaded = true;
    renderSkeleton();
    window.DTCRefs.load(challenge).then(({ status, screens, message, notice }) => {
      if (status === "ok" && screens.length) {
        if (notice) {
          $("refs-notice").textContent = notice;
          $("refs-notice").hidden = false;
        }
        $("refs-title").textContent = numberWord(screens.length) + " " + window.DTC.refNoun(challenge) + "s. Plenty to notice.";
        $("refs-note").textContent = challenge.name + " references · Click to enlarge";
        renderScreens(screens);
      } else {
        loaded = false; // try again next time the round opens
        refs.hidden = true;
        $("refs-title").textContent = "This brief's pattern: " + challenge.name + ". Plenty to notice.";
        $("refs-note").textContent = "References from Mobbin";
        $("refs-empty").hidden = false;
        $("refs-empty-text").textContent = message;
      }
    });
  }

  // ---------- Lightbox ----------
  const lightbox = $("lightbox");
  function openLightbox(s) {
    $("lightbox-img").src = s.image;
    $("lightbox-img").alt = s.appName + " " + window.DTC.refNoun(challenge);
    $("lightbox-app").textContent = s.appName;
    $("lightbox-link").href = s.url;
    lightbox.showModal();
  }
  $("lightbox-close").addEventListener("click", () => lightbox.close());
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) lightbox.close(); });

  // ---------- Notes ----------
  const inputs = [...root.querySelectorAll(".notice input")];
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

  window.DTCPages.on("study", () => {
    timer.start();
    loadReferences();
  });
})();

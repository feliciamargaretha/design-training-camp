// Design round: upload your first take on the brief. No timer.
(function () {
  const root = document.querySelector('[data-page="design"]');
  const $ = (name) => root.querySelector('[data-el="' + name + '"]');
  const challenge = window.DTC.today();
  const storeKey = window.DTCStore.key("design");

  const intent = $("intent");
  const continueBtn = $("continue");
  let screens = [];
  let workspace = null;
  let saveTimer = null;

  $("challenge-label").textContent = "Your challenge · " + window.DTC.label(challenge);
  $("challenge-brief").textContent = challenge.brief;
  window.DTC.renderMeta($("brief-meta"), challenge);

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      window.DTCStore.set(storeKey, {
        challengeId: challenge.id,
        intent: intent.value,
        size: size.get(),
        screens,
      });
    }, 150);
  }

  function updateContinue() {
    const has = screens.length > 0;
    continueBtn.classList.toggle("is-disabled", !has);
    continueBtn.setAttribute("aria-disabled", String(!has));
  }

  const size = window.DTCWorkspace.sizeControl(root, () => [$("canvas")], save);

  continueBtn.addEventListener("click", (e) => {
    if (!screens.length) e.preventDefault();
  });
  intent.addEventListener("input", save);

  document.addEventListener("paste", (e) => {
    if (root.hidden || !workspace || e.target === intent) return;
    const files = window.DTCWorkspace.pastedFiles(e);
    if (files.length) {
      e.preventDefault();
      workspace.addFiles(files);
    }
  });

  // Starting a brief keeps it on screen until its Review is finished.
  window.DTCPages.on("design", () => window.DTC.pin(window.DTC.dateKey()));

  // Restore saved work for this brief.
  window.DTCStore.get(storeKey).then((saved) => {
    if (saved && saved.challengeId === challenge.id) {
      intent.value = saved.intent || "";
      if (saved.size) size.set(saved.size, true);
      screens = saved.screens || [];
    }
    workspace = window.DTCWorkspace.create(root.querySelector('[data-el="workspace"]'), {
      screens,
      onChange(next) {
        screens = next;
        updateContinue();
        save();
      },
    });
    updateContinue();
  });
})();

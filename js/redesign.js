// Redesign round: one or more explorations, each with its own screens.
// No timer.
(function () {
  const root = document.querySelector('[data-page="redesign"]');
  const $ = (id) => document.getElementById(id);
  const challenge = window.DTC.today();
  const storeKey = window.DTCStore.key("redesign");
  const LETTERS = "ABCDEFGHIJ";
  const MAX = LETTERS.length;

  $("rd-challenge-label").textContent = "Your challenge · " + String(challenge.id).padStart(3, "0");
  $("rd-challenge-brief").textContent = challenge.brief;

  const listEl = $("rd-explorations");
  const template = $("rd-exploration-template");
  const continueBtn = $("rd-continue");

  // { id, name, intent, screens, el, workspace }
  let explorations = [];
  let active = null; // where pasted images go
  let saveTimer = null;

  const size = window.DTCWorkspace.sizeControl(
    root.querySelector(".workspace__bar"),
    () => [...listEl.querySelectorAll('[data-el="canvas"]')],
    save
  );

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      window.DTCStore.set(storeKey, {
        challengeId: challenge.id,
        size: size.get(),
        explorations: explorations.map(({ id, name, intent, screens }) => ({ id, name, intent, screens })),
      });
    }, 150);
  }

  function defaultName(i) {
    return "Exploration " + LETTERS[i];
  }

  function updateSummary() {
    const n = explorations.length;
    const screens = explorations.reduce((sum, x) => sum + x.screens.length, 0);
    $("rd-count").textContent = n + (n === 1 ? " exploration" : " explorations") + " · " +
      screens + (screens === 1 ? " screen" : " screens");
    const ready = explorations.some((x) => x.screens.length);
    continueBtn.classList.toggle("is-disabled", !ready);
    continueBtn.setAttribute("aria-disabled", String(!ready));
    const full = n >= MAX;
    $("rd-add").disabled = full;
    $("rd-add-bottom").hidden = full;
    explorations.forEach((x, i) => {
      const q = (name) => x.el.querySelector('[data-el="' + name + '"]');
      q("letter").textContent = LETTERS[i];
      q("name").placeholder = defaultName(i);
      q("remove").hidden = n === 1;
    });
  }

  function addExploration(data, focus) {
    if (explorations.length >= MAX) return;
    const i = explorations.length;
    const x = {
      id: (data && data.id) || Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      name: (data && data.name) || "",
      intent: (data && data.intent) || "",
      screens: (data && data.screens) || [],
    };
    const el = template.content.firstElementChild.cloneNode(true);
    const q = (name) => el.querySelector('[data-el="' + name + '"]');
    x.el = el;

    const nameInput = q("name");
    const intentInput = q("intent");
    nameInput.id = "rd-name-" + x.id;
    intentInput.id = "rd-intent-" + x.id;
    nameInput.value = x.name;
    intentInput.value = x.intent;
    q("canvas").dataset.size = size.get();

    nameInput.addEventListener("input", () => {
      x.name = nameInput.value;
      save();
    });
    intentInput.addEventListener("input", () => {
      x.intent = intentInput.value;
      save();
    });

    // Remove: a second click confirms when the exploration has screens.
    const removeBtn = q("remove");
    let armed = false;
    removeBtn.addEventListener("click", () => {
      if (x.screens.length && !armed) {
        armed = true;
        removeBtn.textContent = "Click again to remove";
        setTimeout(() => {
          armed = false;
          removeBtn.textContent = "Remove";
        }, 2500);
        return;
      }
      x.workspace.destroy();
      el.remove();
      explorations = explorations.filter((e) => e !== x);
      if (active === x) active = null;
      updateSummary();
      save();
    });

    el.addEventListener("pointerdown", () => (active = x));
    el.addEventListener("focusin", () => (active = x));

    listEl.append(el);
    explorations.push(x);
    x.workspace = window.DTCWorkspace.create(el, {
      screens: x.screens,
      onChange(next) {
        x.screens = next;
        updateSummary();
        save();
      },
    });
    updateSummary();
    if (focus) {
      active = x;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      nameInput.focus({ preventScroll: true });
    }
    return x;
  }

  function addNew() {
    addExploration(null, true);
    save();
  }
  $("rd-add").addEventListener("click", addNew);
  $("rd-add-bottom").addEventListener("click", addNew);

  continueBtn.addEventListener("click", (e) => {
    if (!explorations.some((x) => x.screens.length)) e.preventDefault();
  });

  document.addEventListener("paste", (e) => {
    if (root.hidden || e.target.tagName === "INPUT") return;
    const files = window.DTCWorkspace.pastedFiles(e);
    if (!files.length) return;
    e.preventDefault();
    const target = active || explorations[explorations.length - 1];
    if (target) target.workspace.addFiles(files);
  });

  // ---------- Carry over from Compare ----------
  async function renderCarry() {
    const [analysis, marks] = await Promise.all([
      window.DTCStore.get(window.DTCStore.key("analysis")),
      window.DTCStore.get(window.DTCStore.key("compare")),
    ]);
    const section = $("rd-carry");
    if (!analysis || analysis.challengeId !== challenge.id) {
      section.hidden = true;
      return;
    }
    const noticed = new Set(marks && marks.challengeId === challenge.id ? marks.noticed || [] : []);
    const items = analysis.observations
      .map((o, i) => ({ o, i }))
      .filter(({ o, i }) => noticed.has(i) || o.yourDesign === "no" || o.yourDesign === "partly");
    if (!items.length) {
      section.hidden = true;
      return;
    }
    $("rd-carry-list").replaceChildren(...items.map(({ o, i }) => {
      const li = document.createElement("li");
      const num = document.createElement("span");
      num.className = "carry__num";
      num.textContent = String(i + 1).padStart(2, "0");
      const title = document.createElement("span");
      title.className = "carry__title";
      title.textContent = o.title;
      li.append(num, title);
      const tag = document.createElement("span");
      tag.className = "carry__tag";
      if (o.yourDesign === "no") {
        tag.classList.add("carry__tag--no");
        tag.textContent = "Missing";
      } else if (o.yourDesign === "partly") {
        tag.classList.add("carry__tag--partly");
        tag.textContent = "Partly";
      } else {
        tag.classList.add("carry__tag--noticed");
        tag.textContent = "You noticed";
      }
      li.append(tag);
      return li;
    }));
    section.hidden = false;
  }

  // ---------- Start ----------
  let loaded = false;
  window.DTCStore.get(storeKey).then((saved) => {
    const today = saved && saved.challengeId === challenge.id;
    if (today && saved.size) size.set(saved.size, true);
    const stored = today ? saved.explorations || [] : [];
    if (stored.length) stored.forEach((x) => addExploration(x));
    else addExploration(null);
    loaded = true;
  });

  window.DTCPages.on("redesign", () => {
    renderCarry();
    if (loaded) updateSummary();
  });
})();

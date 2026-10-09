// Palette Drill: one brief a day, twenty minutes. Read the brief, write three
// feel words, pick 3–5 base colors, color the grayscale screen from their
// scales, lock it, then see the real product, your measured screen and
// Claude's analysis.
(function () {
  const C = window.PDColor;
  const TPL = window.PDTemplates;
  const MINUTES = 20;
  const STEPS = [
    ["brief", "Brief", ""],
    ["feel", "Feel words", "3 min"],
    ["colors", "Base colors", "5 min"],
    ["screen", "Color the screen", "10 min"],
    ["reveal", "Reveal", ""],
  ];

  const $ = (id) => document.getElementById(id);
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "style") el.style.cssText = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "value") el.value = v;
      else el.setAttribute(k, v === true ? "" : v);
    });
    kids.flat(Infinity).forEach((c) => { if (c != null && c !== false) el.append(c); });
    return el;
  }

  let key = window.PDBriefs.key(new Date());
  let brief = null;
  let state = null;
  let ready = null;
  let selected = null; // { role, el }
  let shownVersion = null;
  let tick = null;

  // ---------- State ----------
  function blank() {
    return {
      briefId: brief.id, started: null, step: "brief",
      feel: [0, 1, 2].map(() => ({ word: "", decision: "" })),
      draft: { bases: { neutral: "", primary: "", accent: "", s1: "", s2: "" }, useAccent: true, assign: {}, split: {} },
      editing: true, versions: [],
    };
  }

  async function loadDay(k) {
    key = k;
    brief = window.PDBriefs.forDate(window.PDBriefs.parse(k));
    const saved = await window.PDStore.get("day:" + k);
    state = saved && saved.briefId === brief.id ? saved : blank();
    state.versions.forEach((v) => { if (v.analysis && v.analysis.status === "loading") v.analysis = null; });
    selected = null;
    shownVersion = null;
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => window.PDStore.set("day:" + key, state), 250);
  }

  // ---------- Base colors and scales ----------
  function slots() {
    const s = [
      { id: "neutral", label: "Neutral", kind: "neutral", note: "Backgrounds, cards, text and lines come from this scale." },
      { id: "primary", label: "Primary", kind: "primary", note: "The brand color: main actions and key moments." },
    ];
    const statuses = brief.statuses || [];
    s.push({ id: "accent", label: "Accent", kind: "accent", optional: statuses.length > 0, note: statuses.length ? "Optional. A second voice for highlights." : "A second voice for highlights." });
    statuses.forEach((name, i) => s.push({ id: "s" + (i + 1), label: name, kind: "status", note: "Status color." }));
    return s;
  }
  function activeSlots(d) {
    return slots().filter((s) => !(s.optional && !d.useAccent));
  }
  function scalesFor(d) {
    return activeSlots(d).map((s) => {
      const sc = d.bases[s.id] ? C.scale(d.bases[s.id]) : null;
      return { ...s, scale: sc };
    });
  }
  function baseInfo(d) {
    const f = window.PDChecks.fmt;
    return scalesFor(d).filter((s) => s.scale).map((s) => {
      const b = s.scale.base;
      return { id: s.id, label: s.label, kind: s.kind, hex: b.hex, L: b.L, C: b.C, H: b.H, fmt: { L: f.L(b.L), C: f.C(b.C), H: b.C < 0.002 ? "—" : f.H(b.H) } };
    });
  }

  // "primary:5" -> color, using a draft or a version.
  function resolve(d, value, scales) {
    if (!value) return null;
    const [id, i] = value.split(":");
    const s = (scales || scalesFor(d)).find((x) => x.id === id);
    if (!s || !s.scale) return null;
    const stop = s.scale.stops[+i];
    return { key: value, hex: stop.hex, scaleId: id, stop: stop.stop, base: stop.base, label: s.label + " " + stop.stop };
  }
  function valueFor(d, el) {
    return d.split[el.dataset.el] || d.assign[el.dataset.r] || null;
  }

  // ---------- Timer ----------
  function updateTimer() {
    const el = $("pd-timer");
    if (!el) return;
    if (!state || !state.started) { el.textContent = MINUTES + ":00"; el.classList.remove("is-over"); return; }
    const left = MINUTES * 60000 - (Date.now() - state.started);
    const s = Math.floor(Math.abs(left) / 1000);
    const t = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    el.textContent = left >= 0 ? t : "+" + t + " over";
    el.classList.toggle("is-over", left < 0);
  }

  // ---------- Layout ----------
  function renderSteps() {
    const list = $("pd-steps");
    const locked = state.versions.length > 0;
    list.replaceChildren(...STEPS.map(([id, label, time], i) => {
      const can = id === "brief" || (state.started && (id !== "reveal" || locked));
      return h("li", { class: "pd-step" + (state.step === id ? " is-on" : "") },
        h("button", { type: "button", disabled: !can, onclick: () => go(id) },
          h("span", { class: "pd-step__n", text: String(i + 1).padStart(2, "0") }),
          h("span", { class: "pd-step__label", text: label }),
          time ? h("span", { class: "pd-step__time", text: time }) : null));
    }));
  }

  function go(step) {
    state.step = step;
    save();
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    const today = window.PDBriefs.key(new Date());
    $("pd-eyebrow").textContent = "Palette drill · Drill " + brief.number;
    $("pd-viewing").hidden = key === today;
    $("pd-viewing-text").textContent = "You're looking at Drill " + brief.number + ".";
    renderSteps();
    updateTimer();
    const body = $("pd-body");
    const view = { brief: viewBrief, feel: viewFeel, colors: viewColors, screen: viewScreen, reveal: viewReveal }[state.step] || viewBrief;
    body.replaceChildren(view());
    if (state.step === "screen") requestAnimationFrame(fitStages);
    if (state.step === "reveal") requestAnimationFrame(fitStages);
  }

  const head = (n, title, time, lede) =>
    h("div", { class: "pd-head" },
      h("p", { class: "round-title__num", text: n }),
      h("div", {}, h("h2", { class: "pd-head__title", text: title }, time ? h("span", { class: "pd-head__time", text: " · " + time }) : null),
        lede ? h("p", { class: "pd-head__lede", text: lede }) : null));

  // ---------- 1. Brief ----------
  function viewBrief() {
    const t = TPL.TEMPLATES[brief.template];
    const sl = slots();
    const rows = [
      ["The product", brief.what],
      ["Positioning", brief.positioning],
      ["Personality", brief.personality + " " + brief.avoid],
      ["Mode", brief.mode === "dark" ? "Dark mode" : "Light mode"],
      ["Where the color must work", brief.where],
      ["Base colors to pick", sl.map((s) => s.label + (s.optional ? " (optional)" : "")).join(" · ")],
      ["The hard part", brief.hard],
    ];
    const statusCount = (brief.statuses || []).length;
    const checksRun = 6 + (statusCount >= 2 ? 1 : 0) + 1;
    return h("div", { class: "pd-panel" },
      head("01", "Today's brief", "", "The product's name stays hidden until the reveal."),
      h("div", { class: "pd-brief" },
        h("div", { class: "pd-brief__tags" },
          h("span", { class: "pill", text: t.name }), h("span", { class: "pill", text: brief.mode === "dark" ? "Dark" : "Light" }),
          h("span", { class: "pill", text: checksRun + " of 8 checks run" })),
        h("dl", { class: "pd-brief__list" }, rows.map(([k, v]) => [h("dt", { text: k }), h("dd", { text: v })]))),
      h("div", { class: "pd-actions" },
        state.started
          ? h("button", { type: "button", class: "btn", onclick: () => go(state.versions.length ? "reveal" : "feel"), text: state.versions.length ? "Open the reveal →" : "Continue →" })
          : h("button", { type: "button", class: "btn", onclick: () => { state.started = Date.now(); go("feel"); }, text: "Start the 20 minutes →" }),
        h("span", { class: "hint", text: state.started ? "The clock keeps running. It never locks you out." : "Read it, then start the clock." })),
      pastList());
  }

  function pastList() {
    const wrap = h("section", { class: "pd-past" }, h("h3", { class: "pd-sub", text: "Past drills" }));
    const list = h("ul", { class: "pd-past__list" });
    wrap.append(list);
    window.PDStore.keys().then(async (keys) => {
      const days = keys.filter((k) => k.startsWith("day:")).map((k) => k.slice(4)).filter((k) => k !== key).sort().reverse();
      if (!days.length) { list.append(h("li", { class: "hint", text: "Your finished and started drills will show here." })); return; }
      for (const d of days) {
        const s = await window.PDStore.get("day:" + d);
        const b = window.PDBriefs.forDate(window.PDBriefs.parse(d));
        if (!s || s.briefId !== b.id) continue;
        const done = s.versions && s.versions.length;
        list.append(h("li", { class: "pd-past__item" },
          h("span", { class: "pd-past__n", text: "Drill " + b.number }),
          h("span", { class: "pd-past__name", text: done ? b.product + " · " + s.versions.length + (s.versions.length > 1 ? " versions" : " version") : "Not finished" }),
          s.versions && s.versions[0] && s.versions[0].next ? h("span", { class: "pd-past__next", text: "Practice next: " + s.versions[s.versions.length - 1].next }) : null,
          h("button", { type: "button", class: "btn btn--sm btn--ghost", text: "Open", onclick: () => openDay(d) })));
      }
    });
    return wrap;
  }

  async function openDay(d) {
    await loadDay(d);
    if (state.versions.length) state.step = "reveal";
    render();
    window.scrollTo(0, 0);
  }

  // ---------- 2. Feel words ----------
  function viewFeel() {
    const ro = state.versions.length > 0;
    const examples = [["Dependable", "so status colors share one lightness."], ["Defiant", "so the primary is the only saturated color."], ["Calm", "so cards sit one small step off the background."]];
    return h("div", { class: "pd-panel" },
      head("02", "Three feel words", "about 3 minutes", "Each word gets a color decision you can check later. Write the decision as “so …”."),
      h("div", { class: "pd-feel" }, state.feel.map((f, i) => h("div", { class: "pd-feel__row" },
        h("span", { class: "pd-feel__n", text: String(i + 1) }),
        h("label", { class: "pd-field" }, h("span", { text: "Word" }),
          h("input", { type: "text", value: f.word, placeholder: examples[i][0], maxlength: 24, disabled: ro, oninput: (e) => { f.word = e.target.value; save(); } })),
        h("label", { class: "pd-field pd-field--wide" }, h("span", { text: "Color decision" }),
          h("input", { type: "text", value: f.decision, placeholder: examples[i][1], maxlength: 140, disabled: ro, oninput: (e) => { f.decision = e.target.value; save(); } }))))),
      ro ? h("p", { class: "hint", text: "Locked with version 1." }) : null,
      h("div", { class: "pd-actions" },
        h("button", { type: "button", class: "btn", text: "Pick base colors →", onclick: () => go("colors") }),
        h("span", { class: "hint", text: state.feel.filter((f) => f.word.trim() && f.decision.trim()).length + " of 3 written" })));
  }

  // ---------- 3. Base colors ----------
  function viewColors() {
    const d = state.draft;
    const ro = !state.editing;
    const wrap = h("div", { class: "pd-panel" },
      head("03", "Pick 3–5 base colors", "about 5 minutes", "Only the hex for each role. The page builds a 10-stop scale from each one, all on the same lightness ladder. Your exact hex sits at its nearest stop."));
    const list = h("div", { class: "pd-bases" });
    const refresh = () => { list.replaceChildren(...slots().map(baseRow)); count.textContent = activeSlots(d).filter((s) => d.bases[s.id]).length + " base colors"; save(); };
    const count = h("span", { class: "hint" });

    function baseRow(s) {
      const off = s.optional && !d.useAccent;
      const sc = !off && d.bases[s.id] ? C.scale(d.bases[s.id]) : null;
      const hexIn = h("input", { type: "text", class: "pd-hex", value: d.bases[s.id] || "", placeholder: "#000000", maxlength: 7, disabled: ro || off, "aria-label": s.label + " hex",
        onchange: (e) => { const v = C.normHex(e.target.value); if (v || !e.target.value) { d.bases[s.id] = v || ""; refresh(); } else e.target.classList.add("is-bad"); } });
      const picker = h("input", { type: "color", class: "pd-picker", value: d.bases[s.id] || "#888888", disabled: ro || off, "aria-label": "Pick " + s.label,
        oninput: (e) => { d.bases[s.id] = e.target.value; hexIn.value = e.target.value; strip.replaceChildren(...stripFor(C.scale(e.target.value))); },
        onchange: () => refresh() });
      const strip = h("div", { class: "pd-scale" }, stripFor(sc));
      return h("div", { class: "pd-base" + (off ? " is-off" : "") },
        h("div", { class: "pd-base__head" },
          h("div", {}, h("p", { class: "pd-base__label", text: s.label }), h("p", { class: "pd-base__note", text: s.note })),
          s.optional ? h("label", { class: "pd-toggle" }, h("input", { type: "checkbox", checked: d.useAccent, disabled: ro, onchange: (e) => { d.useAccent = e.target.checked; refresh(); } }), h("span", { text: "Use an accent" })) : null),
        off ? null : h("div", { class: "pd-base__pick" }, picker, hexIn),
        off ? null : strip);
    }
    function stripFor(sc) {
      if (!sc) return [h("p", { class: "pd-scale__empty", text: "Pick a color to see its scale." })];
      return sc.stops.map((st) => h("div", { class: "pd-swatch" + (st.base ? " is-base" : ""), title: st.hex + " · L " + st.L.toFixed(2) },
        h("span", { class: "pd-swatch__chip", style: "background:" + st.hex }),
        h("span", { class: "pd-swatch__stop", text: String(st.stop) }),
        st.base ? h("span", { class: "pd-swatch__base", text: "base " + (st.offset >= 0 ? "+" : "−") + Math.abs(st.offset).toFixed(2) + " L" }) : null));
    }
    wrap.append(list);
    refresh();
    const missing = () => activeSlots(d).filter((s) => !d.bases[s.id]);
    const note = h("span", { class: "pd-warn" });
    wrap.append(h("div", { class: "pd-actions" },
      h("button", { type: "button", class: "btn", text: "Color the screen →", onclick: () => {
        const m = missing();
        if (m.length && !ro) { note.textContent = "Pick " + m.map((s) => s.label).join(", ") + " first."; return; }
        go("screen");
      } }),
      count, note));
    if (ro) wrap.append(h("p", { class: "hint", text: "This version is locked. Revise it from the reveal to make version " + (state.versions.length + 1) + "." }));
    return wrap;
  }

  // ---------- 4. Color the screen ----------
  function applyColors(root, d, scales) {
    const mode = brief.mode === "dark" ? "d" : "l";
    root.querySelectorAll("[data-r]").forEach((el) => paint(el, d, scales, mode));
    paint(root, d, scales, mode);
  }
  function paint(el, d, scales, mode) {
    const def = TPL.ROLES[el.dataset.r];
    if (!def) return;
    const c = resolve(d, valueFor(d, el), scales);
    const hex = c ? c.hex : C.gray(def[mode]);
    el.classList.toggle("pd-unset", !c);
    if (def.kind === "fill") el.style.background = hex;
    else if (def.kind === "line") el.style.borderColor = hex;
    else el.style.color = hex;
  }

  function stage(root, t, maxH) {
    const box = h("div", { class: "pd-stage", "data-w": t.w, "data-h": t.h, "data-maxh": maxH || 760 });
    const inner = h("div", { class: "pd-stage__inner" }, root);
    box.append(inner);
    return box;
  }
  function fitStages() {
    document.querySelectorAll(".pd-stage").forEach((box) => {
      const w = +box.dataset.w, hh = +box.dataset.h, maxH = +box.dataset.maxh;
      const avail = box.parentElement.clientWidth;
      // On short screens keep the screen small enough to color it with the palette in view.
      const s = Math.min(1, avail / w, Math.min(maxH, Math.max(420, window.innerHeight * 0.62)) / hh);
      box.style.width = w * s + "px";
      box.style.height = hh * s + "px";
      box.firstElementChild.style.transform = "scale(" + s + ")";
    });
  }
  window.addEventListener("resize", () => { if (state && (state.step === "screen" || state.step === "reveal")) fitStages(); });

  function rolesIn(root) {
    const seen = new Map();
    [root, ...root.querySelectorAll("[data-r]")].forEach((el) => {
      if (!el.getClientRects().length && el !== root) return;
      const r = el.dataset.r;
      if (!seen.has(r)) seen.set(r, []);
      seen.get(r).push(el);
    });
    return seen;
  }

  function viewScreen() {
    const d = state.draft;
    const ro = !state.editing;
    const t = TPL.TEMPLATES[brief.template];
    const scales = scalesFor(d);
    const root = TPL.render(brief.template, brief);
    applyColors(root, d, scales);
    const panel = h("div", { class: "pd-palette" });
    const wrap = h("div", { class: "pd-panel" },
      head("04", "Color the screen", "about 10 minutes", "Click any element, then pick a stop. Elements with the same role change together; tick “Only this one” to split one off."),
      h("div", { class: "pd-work" }, h("div", { class: "pd-work__screen" }, stage(root, t, 760)), panel));

    let roles = new Map();
    function draw() {
      roles = rolesIn(root);
      applyColors(root, d, scales);
      root.querySelectorAll(".pd-sel").forEach((x) => x.classList.remove("pd-sel"));
      if (selected) {
        const els = selected.only ? [root.querySelector('[data-el="' + selected.el + '"]') || root] : roles.get(selected.role) || [];
        els.forEach((x) => x.classList.add("pd-sel"));
      }
      panel.replaceChildren(...panelKids());
    }

    function setValue(v) {
      if (ro || !selected) return;
      if (selected.only) d.split[selected.el] = v;
      else {
        d.assign[selected.role] = v;
        // Re-joining: split elements keep their own stop until un-split.
      }
      save();
      draw();
    }

    function panelKids() {
      const total = [...roles.keys()];
      const done = total.filter((r) => (roles.get(r) || []).every((el) => resolve(d, valueFor(d, el), scales))).length;
      const kids = [];
      if (selected) {
        const els = roles.get(selected.role) || [];
        const current = selected.only ? d.split[selected.el] : d.assign[selected.role];
        kids.push(h("div", { class: "pd-sel-card" },
          h("p", { class: "pd-sel-card__role", text: TPL.roleLabel(selected.role, brief) }),
          h("p", { class: "pd-sel-card__meta", text: (selected.only ? "This element only" : els.length + (els.length === 1 ? " element" : " elements")) + " · " + (resolve(d, current, scales) ? resolve(d, current, scales).label : "not colored yet") }),
          els.length > 1 || selected.only ? h("label", { class: "pd-toggle" },
            h("input", { type: "checkbox", checked: !!selected.only, disabled: ro, onchange: (e) => {
              selected.only = e.target.checked;
              if (!e.target.checked) delete d.split[selected.el];
              else if (!d.split[selected.el] && d.assign[selected.role]) d.split[selected.el] = d.assign[selected.role];
              save(); draw();
            } }), h("span", { text: "Only this one" })) : null));
      } else {
        kids.push(h("p", { class: "pd-sel-card pd-sel-card--empty", text: "Click an element on the screen to color it." }));
      }
      kids.push(h("div", { class: "pd-grid" }, scales.filter((s) => s.scale).map((s) =>
        h("div", { class: "pd-grid__row" },
          h("span", { class: "pd-grid__label", text: s.label }),
          h("div", { class: "pd-grid__stops" }, s.scale.stops.map((st, i) => {
            const v = s.id + ":" + i;
            const cur = selected && (selected.only ? d.split[selected.el] : d.assign[selected.role]) === v;
            return h("button", { type: "button", class: "pd-chip" + (cur ? " is-on" : "") + (st.base ? " is-base" : ""), style: "background:" + st.hex,
              title: s.label + " " + st.stop + " · " + st.hex, "aria-label": s.label + " " + st.stop, disabled: ro || !selected, onclick: () => setValue(v) });
          }))))));
      kids.push(h("div", { class: "pd-roles" },
        h("p", { class: "pd-sub", text: "Roles · " + done + " of " + total.length + " colored" }),
        h("ul", {}, total.map((r) => {
          const c = resolve(d, d.assign[r], scales);
          return h("li", {}, h("button", { type: "button", class: "pd-role" + (selected && selected.role === r ? " is-on" : ""), onclick: () => { selected = { role: r, el: roles.get(r)[0].dataset.el || "root", only: false }; draw(); } },
            h("span", { class: "pd-role__chip" + (c ? "" : " is-empty"), style: c ? "background:" + c.hex : "" }),
            h("span", { class: "pd-role__label", text: TPL.roleLabel(r, brief) }),
            h("span", { class: "pd-role__stop", text: c ? c.label : "—" })));
        }))));
      if (!ro) {
        kids.push(h("div", { class: "pd-actions pd-actions--stack" },
          h("button", { type: "button", class: "btn btn--sm btn--ghost", text: "Fill the uncolored roles from Neutral", onclick: () => {
            const mode = brief.mode === "dark" ? "d" : "l";
            total.forEach((r) => { if (!d.assign[r] && TPL.ROLES[r]) d.assign[r] = "neutral:" + TPL.ROLES[r][mode]; });
            save(); draw();
          } }),
          h("button", { type: "button", class: "btn", disabled: done < total.length, text: "Lock version " + (state.versions.length + 1), onclick: () => lock(root, scales) }),
          done < total.length ? h("span", { class: "hint", text: "Color every role to lock." }) : h("span", { class: "hint", text: "A locked version can't be edited. You can revise it as a new version." })));
      }
      return kids;
    }

    root.addEventListener("click", (e) => {
      const el = e.target.closest("[data-r]");
      if (!el || !root.contains(el) && el !== root) return;
      const only = !!d.split[el.dataset.el];
      selected = { role: el.dataset.r, el: el.dataset.el || "root", only };
      draw();
    });
    root.dataset.el = "root";
    requestAnimationFrame(draw);
    return wrap;
  }

  // ---------- Lock ----------
  function lock(root, scales) {
    const d = state.draft;
    const colorOf = (el) => resolve(d, valueFor(d, el), scales);
    const m = window.PDChecks.measure(root, colorOf, scales.filter((s) => s.scale).map((s) => ({ id: s.id, label: s.label, kind: s.kind })));
    const roleNames = {};
    [root, ...root.querySelectorAll("[data-r]")].forEach((el) => {
      if (el !== root && !el.getClientRects().length) return;
      const c = colorOf(el);
      if (!c) return;
      (roleNames[c.key] = roleNames[c.key] || new Set()).add(TPL.roleLabel(el.dataset.r, brief));
    });
    const bases = baseInfo(d);
    const checks = window.PDChecks.run(m, bases, (r) => TPL.roleLabel(r, brief));
    const colors = m.colors.map((c) => ({ key: c.key, label: c.label, hex: c.hex, scaleId: c.scaleId, stop: c.stop, base: c.base, kind: c.kind, L: c.L, C: c.C, H: c.H, share: c.share, fmt: c.fmt, roles: [...(roleNames[c.key] || [])] }));
    state.versions.push({ n: state.versions.length + 1, lockedAt: Date.now(), draft: JSON.parse(JSON.stringify(d)), bases, colors, checks, analysis: null, next: "" });
    state.editing = false;
    shownVersion = state.versions.length - 1;
    selected = null;
    go("reveal");
  }

  // ---------- 5. Reveal ----------
  let refsResult = null;
  let refsFor = null;
  let refsPromise = null;
  function getRefs() {
    if (!refsPromise || refsPromise.id !== brief.id) {
      const id = brief.id, b = brief;
      refsPromise = window.PDRefs.load(b).then((res) => { if (brief.id === id) { refsResult = res; refsFor = id; } return res; });
      refsPromise.id = id;
    }
    return refsPromise;
  }

  function viewReveal() {
    const vi = shownVersion == null ? state.versions.length - 1 : shownVersion;
    const v = state.versions[vi];
    const wrap = h("div", { class: "pd-panel" },
      head("05", "Reveal", "", "The real product, your measured screen and Claude's read of the numbers."));
    if (!v) { wrap.append(h("p", { class: "hint", text: "Lock a version to see the reveal." })); return wrap; }

    if (state.versions.length > 1) {
      wrap.append(h("div", { class: "pd-versions", role: "tablist" }, state.versions.map((x, i) =>
        h("button", { type: "button", role: "tab", "aria-selected": String(i === vi), class: "pd-version" + (i === vi ? " is-on" : ""), text: "Version " + x.n, onclick: () => { shownVersion = i; render(); } }))));
    }

    // 1. Real products
    const real = h("section", { class: "pd-sec" },
      h("h3", { class: "pd-sec__title" }, h("span", { class: "pd-sec__n", text: "1" }), "This brief was written from ", h("strong", { text: brief.product })),
      h("p", { class: "pd-sec__lede", text: "Next to it, " + brief.competitors.join(" and ") + ". One real screen each, with its colors read from the screenshot's pixels." }));
    const cards = h("div", { class: "pd-refs" });
    real.append(cards);
    const fill = (res) => {
      cards.replaceChildren(...res.products.map(refCard));
      if (res.status !== "ok") real.append(h("p", { class: "pd-note", text: refsMessage(res.status) }));
    };
    if (refsResult && refsFor === brief.id) {
      fill(refsResult);
      if (v.analysis == null) runAnalysis(vi);
    } else {
      cards.replaceChildren(...[brief.product, ...brief.competitors].map((n) => h("div", { class: "pd-ref is-loading" }, h("p", { class: "pd-ref__name", text: n }), h("p", { class: "hint", text: "Loading from Mobbin…" }))));
      const id = brief.id;
      getRefs().then((res) => { if (brief.id !== id || !cards.isConnected) return; fill(res); if (v.analysis == null) runAnalysis(vi); });
    }
    wrap.append(real);

    // 2. Your screen measured
    const scales = scalesFor(v.draft);
    const root = TPL.render(brief.template, brief);
    applyColors(root, v.draft, scales);
    root.classList.add("pd-static");
    const t = TPL.TEMPLATES[brief.template];
    wrap.append(h("section", { class: "pd-sec" },
      h("h3", { class: "pd-sec__title" }, h("span", { class: "pd-sec__n", text: "2" }), "Your screen, measured"),
      h("div", { class: "pd-measured" },
        h("div", { class: "pd-measured__screen" }, stage(root, t, 560)),
        h("div", { class: "pd-measured__data" },
          h("div", { class: "pd-table-wrap" }, h("table", { class: "pd-table" },
            h("thead", {}, h("tr", {}, ["Color", "Hex", "L", "C", "H", "Share"].map((x) => h("th", { text: x })))),
            h("tbody", {}, v.colors.map((c) => h("tr", {},
              h("td", {}, h("span", { class: "pd-dot", style: "background:" + c.hex }), c.label, c.base ? h("span", { class: "pd-basetag", text: "base" }) : null),
              h("td", { class: "mono", text: c.hex }), h("td", { text: c.fmt.L }), h("td", { text: c.fmt.C }), h("td", { text: c.fmt.H }), h("td", { text: c.fmt.share })))))),
          h("p", { class: "pd-note", text: "Share is measured from element sizes. Text counts at about a third of its box, icons at a quarter." }),
          h("ul", { class: "pd-checks" }, v.checks.map((c) => h("li", { class: "pd-check pd-check--" + c.result },
            h("span", { class: "pd-check__result", text: c.result === "clear" ? "Clear" : c.result === "look" ? "Look again" : "Not run" }),
            h("div", {}, h("p", { class: "pd-check__name" }, c.name, c.value ? h("span", { class: "pd-check__value", text: " · " + c.value }) : null),
              h("p", { class: "pd-check__detail", text: c.detail }), c.rule ? h("p", { class: "pd-check__rule", text: c.rule }) : null)))),
          h("p", { class: "pd-note", text: "Contrast thresholds are WCAG 2 AA. The other thresholds are starting values." })))));

    // 3. Claude's analysis
    const an = h("section", { class: "pd-sec", id: "pd-analysis" });
    wrap.append(an);
    drawAnalysis(an, v, vi);

    // 4. Practice next
    const nextIn = h("input", { type: "text", class: "pd-next__input", value: v.next || (v.analysis && v.analysis.next) || "", placeholder: "One line: what to practice next time", maxlength: 160 });
    const saved = h("span", { class: "hint" });
    wrap.append(h("section", { class: "pd-sec" },
      h("h3", { class: "pd-sec__title" }, h("span", { class: "pd-sec__n", text: "4" }), "Practice next"),
      h("div", { class: "pd-next" }, nextIn,
        h("button", { type: "button", class: "btn btn--sm", text: "Save", onclick: () => { v.next = nextIn.value.trim(); save(); saved.textContent = "Saved."; } }), saved)));

    // Revise
    wrap.append(h("div", { class: "pd-actions" },
      h("button", { type: "button", class: "btn btn--ghost", text: "Revise as version " + (state.versions.length + 1), onclick: () => {
        state.draft = JSON.parse(JSON.stringify(state.versions[state.versions.length - 1].draft));
        state.editing = true;
        go("screen");
      } }),
      h("span", { class: "hint", text: "Version " + v.n + " stays as it is. The revision saves beside it." })));
    wrap.append(h("p", { class: "pd-note", text: "Reference palettes come from screenshot pixels, so they include photos and illustrations, and their hex values are approximate. What each reference color is used for isn't known." }));
    return wrap;
  }

  function refsMessage(status) {
    return ({
      unavailable: "Mobbin screens load when this page is open inside Claude. The products are still named, and your screen is still measured and analyzed.",
      server_not_connected: "Mobbin isn't connected to your Claude account. Add it in claude.ai Settings → Connectors, then reload.",
      needs_reauth: "Your Mobbin connection expired. Reconnect it in claude.ai Settings → Connectors, then reload.",
      not_granted: "This page isn't allowed to use Mobbin. Allow it when Claude asks, then reload.",
      empty: "Mobbin had no screens for these products today. Your screen is still measured and analyzed.",
    })[status] || "Mobbin screens couldn't load (" + status + "). Your screen is still measured and analyzed.";
  }

  function refCard(p) {
    if (!p.found) return h("div", { class: "pd-ref is-missing" },
      h("p", { class: "pd-ref__name" }, p.name, p.role === "product" ? h("span", { class: "pd-ref__tag", text: "The brief" }) : null),
      h("p", { class: "hint", text: "No Mobbin screen to measure." }));
    const s = p.summary;
    return h("div", { class: "pd-ref" },
      h("a", { class: "pd-ref__img", href: p.url, target: "_blank", rel: "noopener" }, h("img", { src: p.thumb, alt: p.name + " screen" })),
      h("p", { class: "pd-ref__name" }, p.name, p.role === "product" ? h("span", { class: "pd-ref__tag", text: "The brief" }) : null),
      h("div", { class: "pd-sharebar", title: "Color share" }, p.palette.map((c) => h("span", { style: "background:" + c.hex + ";flex:" + c.share, title: c.hex + " · " + c.share.toFixed(1) + "%" }))),
      h("p", { class: "pd-ref__meta", text: "Lightness " + s.lightMin + "–" + s.lightMax + (s.owner ? " · most saturated " + s.owner.hex + " at " + s.owner.share : "") }));
  }

  function drawAnalysis(an, v, vi) {
    const title = h("h3", { class: "pd-sec__title" }, h("span", { class: "pd-sec__n", text: "3" }), "Claude's analysis");
    const a = v.analysis;
    if (!a || a.status === "loading") {
      an.replaceChildren(title, h("p", { class: "hint pd-loading", text: (a && a.text) || "Waiting for the real products, then Claude reads the numbers…" }));
      return;
    }
    if (a.status !== "ok") {
      an.replaceChildren(title,
        h("p", { class: "pd-note", text: a.status === "unavailable" ? "Claude's analysis works when this page is open inside Claude. Everything above is measured by the page." : "The analysis couldn't be written (" + a.status + ")." }),
        a.status !== "unavailable" ? h("button", { type: "button", class: "btn btn--sm btn--ghost", text: "Try again", onclick: () => runAnalysis(vi, true) }) : null);
      return;
    }
    const x = a.analysis;
    an.replaceChildren(title,
      h("div", { class: "pd-an" },
        h("div", { class: "pd-an__part" }, h("p", { class: "pd-an__h", text: "What the real products did" }),
          h("ul", {}, x.real.products.map((p) => h("li", {}, h("strong", { text: p.name + ": " }), p.line))),
          x.real.shared ? h("p", {}, h("strong", { text: "Shared: " }), x.real.shared) : null,
          x.real.split ? h("p", {}, h("strong", { text: "Split: " }), x.real.split) : null),
        h("div", { class: "pd-an__part" }, h("p", { class: "pd-an__h", text: "What you got right" }), h("ul", {}, x.right.map((r) => h("li", { text: r })))),
        h("div", { class: "pd-an__part" }, h("p", { class: "pd-an__h" }, "Harmonious or not ", h("span", { class: "pd-verdict pd-verdict--" + (x.harmony.verdict === "harmonious" ? "ok" : "no"), text: x.harmony.verdict === "harmonious" ? "Harmonious" : "Not yet" })),
          x.harmony.why ? h("p", { text: x.harmony.why }) : null,
          x.harmony.verdict !== "harmonious" && (x.harmony.color || x.harmony.change) ? h("p", {}, h("strong", { text: "Change " + (x.harmony.color || "one color") + ": " }), x.harmony.change) : null),
        h("div", { class: "pd-an__part" }, h("p", { class: "pd-an__h", text: "Feel translation" }),
          h("ul", {}, x.feel.map((f) => h("li", {}, h("span", { class: "pd-verdict pd-verdict--" + (f.verdict === "held" ? "ok" : "no"), text: f.verdict === "held" ? "Held" : "Broke" }), " ", h("strong", { text: f.word + ": " }), f.line)))),
        x.next ? h("div", { class: "pd-an__part" }, h("p", { class: "pd-an__h", text: "Practice next" }), h("p", { text: x.next })) : null),
      a.dropped ? h("p", { class: "pd-note", text: a.dropped + (a.dropped === 1 ? " line was" : " lines were") + " left out because a number in it didn't match the table." }) : null,
      h("p", { class: "pd-note", text: "Written by Claude from the measured values only. It didn't see your screen." }));
  }

  async function runAnalysis(vi, retry) {
    const v = state.versions[vi];
    if (!v || (v.analysis && v.analysis.status === "ok" && !retry)) return;
    const k = key;
    const refresh = (text) => {
      v.analysis = { status: "loading", text };
      const an = $("pd-analysis");
      if (an && k === key && (shownVersion == null ? state.versions.length - 1 : shownVersion) === vi) drawAnalysis(an, v, vi);
    };
    refresh();
    const refs = (refsResult && refsFor === brief.id ? refsResult.products : [brief.product, ...brief.competitors].map((n, i) => ({ name: n, role: i ? "competitor" : "product", found: false })));
    const res = await window.PDAnalysis.analyze({ brief, feel: state.feel.filter((f) => f.word.trim()), bases: v.bases, colors: v.colors, checks: v.checks, refs }, refresh);
    v.analysis = res;
    if (res.status === "ok" && !v.next) v.next = res.analysis.next;
    save();
    if (k === key && state.step === "reveal") render();
  }

  // ---------- Start ----------
  async function open() {
    if (!ready) ready = loadDay(window.PDBriefs.key(new Date()));
    await ready;
    // An analysis that never finished (page closed mid-way) starts again.
    state.versions.forEach((v) => { if (v.analysis && v.analysis.status === "loading") v.analysis = null; });
    render();
    if (!tick) tick = setInterval(updateTimer, 1000);
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("pd-back-today").addEventListener("click", async () => { await loadDay(window.PDBriefs.key(new Date())); ready = Promise.resolve(); render(); });
  });
  window.DTCPages.on("drill", open);
})();

// Review round: your original design and each redesign exploration, checked
// against today's Compare observations. Claude fills the grid when it can see
// images; otherwise you do, and Claude writes the summary from your answers.
(function () {
  const $ = (id) => document.getElementById(id);
  const challenge = window.DTC.today();
  const reviewKey = window.DTCStore.key("review");
  const CACHE = { gcTime: 86400000 };
  const ASSUMED_IMAGE_LIMITS = {
    maxCount: 6,
    maxInputBytes: 20000000,
    mediaTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  };

  const VALUES = ["applied", "partly", "not_yet"];
  const LABELS = { applied: "Applied", partly: "Partly", not_yet: "Not yet" };
  // Brand choices are options: the grid records whether a design uses one.
  const CHOICE_LABELS = { applied: "Used", partly: "Partly used", not_yet: "Not used" };
  const FROM_COMPARE = { yes: "applied", partly: "partly", no: "not_yet" };

  const status = $("rv-status");
  const statusText = $("rv-status-text");
  const statusAction = $("rv-status-action");
  const table = $("rv-table");
  const summaryEl = $("rv-summary");
  const summaryBtn = $("rv-summary-btn");
  const rerunBtn = $("rv-rerun");

  let analysis = null;
  let columns = []; // { id, label, intent, screens }
  let review = null; // { challengeId, verdicts: {colId: [v]}, filledBy: {colId: "claude"|"you"}, notes, summary, mode, signature }
  let urls = [];
  let busy = false;

  // ---------- Status ----------
  function setStatus(text, action) {
    status.hidden = !text;
    statusText.textContent = text || "";
    statusAction.hidden = !action;
    if (action) {
      statusAction.textContent = action.label;
      statusAction.href = action.href || "#review";
      statusAction.onclick = action.onClick
        ? (e) => { e.preventDefault(); action.onClick(); }
        : null;
    }
  }

  // ---------- Data ----------
  async function loadAll() {
    const [a, design, redesign, saved] = await Promise.all([
      window.DTCStore.get(window.DTCStore.key("analysis")),
      window.DTCStore.get(window.DTCStore.key("design")),
      window.DTCStore.get(window.DTCStore.key("redesign")),
      window.DTCStore.get(reviewKey),
    ]);
    const today = (x) => x && x.challengeId === challenge.id;
    analysis = today(a) ? a : null;
    columns = [];
    if (today(design) && design.screens && design.screens.length) {
      columns.push({ id: "original", label: "Original", intent: design.intent || "", screens: design.screens });
    }
    if (today(redesign)) {
      (redesign.explorations || []).forEach((x, i) => {
        if (!x.screens || !x.screens.length) return;
        columns.push({
          id: x.id,
          label: (x.name || "").trim() || "Exploration " + "ABCDEFGHIJ"[i],
          intent: x.intent || "",
          screens: x.screens,
          angles: x.angles || [],
          exploration: true,
        });
      });
    }
    review = today(saved) ? saved : { challengeId: challenge.id, verdicts: {}, filledBy: {}, notes: {}, summary: null };

    // Your original design was already judged in Compare (when Claude could see it).
    if (analysis && columns[0] && columns[0].id === "original" && !review.verdicts.original) {
      const fromCompare = analysis.observations.map((o) => FROM_COMPARE[o.yourDesign] || null);
      if (fromCompare.some(Boolean)) {
        review.verdicts.original = fromCompare;
        review.filledBy.original = "claude";
      }
    }
  }

  // Changes when the screens or Compare's observations change, so Claude looks again.
  function signature() {
    return JSON.stringify([
      analysis ? analysis.observations.map((o) => o.title) : [],
      columns.map((c) => [c.id, c.screens.map((s) => s.id), c.angles || []]),
    ]);
  }

  function save() {
    window.DTCStore.set(reviewKey, review);
  }

  function verdictsFor(col) {
    const v = review.verdicts[col.id] || [];
    return analysis.observations.map((_, i) => v[i] || null);
  }

  // ---------- Rendering ----------
  function renderTable() {
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [];

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    const corner = document.createElement("th");
    corner.scope = "col";
    corner.className = "rv-obs-head";
    corner.textContent = "Observation";
    headRow.append(corner);
    columns.forEach((col) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.className = "rv-col" + (col.exploration ? "" : " rv-col--original");
      const thumb = document.createElement("img");
      const url = URL.createObjectURL(col.screens[0].blob);
      urls.push(url);
      thumb.src = url;
      thumb.alt = "";
      const name = document.createElement("span");
      name.className = "rv-col__name";
      name.textContent = col.label;
      const by = document.createElement("span");
      by.className = "rv-col__by";
      by.textContent = review.filledBy[col.id] === "claude" ? "Checked by Claude" : "Checked by you";
      th.append(thumb, name, by);
      headRow.append(th);
    });
    thead.append(headRow);

    const tbody = document.createElement("tbody");
    analysis.observations.forEach((o, i) => {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.scope = "row";
      th.className = "rv-obs";
      th.innerHTML = '<span class="rv-obs__num"></span><span class="rv-obs__title"></span>';
      th.children[0].textContent = String(i + 1).padStart(2, "0");
      th.children[1].textContent = o.title;
      if (isChoice(o)) {
        const kind = document.createElement("span");
        kind.className = "obs__kind";
        kind.textContent = "Brand choice";
        th.children[1].append(" ", kind);
      }
      tr.append(th);
      columns.forEach((col) => {
        const td = document.createElement("td");
        const value = verdictsFor(col)[i];
        const labels = isChoice(o) ? CHOICE_LABELS : LABELS;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "rv-cell" + (value ? " rv-cell--" + (isChoice(o) ? "choice" : value) : "");
        btn.textContent = value ? labels[value] : "—";
        btn.setAttribute("aria-label", col.label + ", " + o.title + ": " + (value ? labels[value] : "not checked") + ". Click to change.");
        btn.addEventListener("click", () => cycle(col, i));
        td.append(btn);
        tr.append(td);
      });
      tbody.append(tr);
    });

    // Claude's one-line notes per column, when it wrote them.
    const notes = columns.filter((c) => review.notes[c.id]);
    const tfoot = document.createElement("tfoot");
    if (notes.length) {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.scope = "row";
      th.className = "rv-obs";
      th.textContent = "Claude's note";
      tr.append(th);
      columns.forEach((col) => {
        const td = document.createElement("td");
        td.className = "rv-note";
        td.textContent = review.notes[col.id] || "";
        tr.append(td);
      });
      tfoot.append(tr);
    }

    table.replaceChildren(thead, tbody, tfoot);
    renderTally();
    renderRange();
    renderCritique();
  }

  function renderTally() {
    const tally = $("rv-tally");
    tally.replaceChildren(...columns.map((col) => {
      // Only principles count; brand choices are options.
      const v = verdictsFor(col).filter((_, i) => !isChoice(analysis.observations[i]));
      const applied = v.filter((x) => x === "applied").length;
      const partly = v.filter((x) => x === "partly").length;
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.className = "rv-tally__name";
      name.textContent = col.label;
      const score = document.createElement("span");
      score.className = "rv-tally__score";
      score.textContent = applied + " of " + v.length + " principles" + (partly ? " · " + partly + " partly" : "");
      const bar = document.createElement("span");
      bar.className = "rv-tally__bar";
      bar.innerHTML = '<span class="rv-tally__fill"></span><span class="rv-tally__part"></span>';
      const total = Math.max(1, v.length);
      bar.children[0].style.width = (applied / total) * 100 + "%";
      bar.children[1].style.width = (partly / total) * 100 + "%";
      li.append(name, score, bar);
      return li;
    }));
  }

  // ---------- Range ----------
  const VERDICTS = { wide: "Wide range", some: "Some range", narrow: "Narrow range" };
  const RELATIONS = { new_direction: "New direction", variation: "Variation", reskin: "Reskin" };
  const DELIVERED = { yes: "", partly: " (partly)", no: " (not really)" };

  function renderRangeState(state, text) {
    const section = $("rv-range");
    const box = $("rv-range-state");
    if (!state) {
      box.hidden = true;
      return;
    }
    section.hidden = false;
    $("rv-range-content").hidden = true;
    box.hidden = false;
    $("rv-range-state-text").textContent = state === "loading"
      ? text || "Checking how far you explored…"
      : "Claude couldn't finish the range check.";
    $("rv-range-retry").hidden = state !== "error";
  }

  function renderRange() {
    const section = $("rv-range");
    const r = review.range;
    if (!hasRange(r)) {
      // checkRange() shows its own loading and error states.
      if (!rangeBusy && $("rv-range-retry").hidden) section.hidden = true;
      return;
    }
    section.hidden = false;
    $("rv-range-content").hidden = false;
    $("rv-range-state").hidden = true;

    const verdict = $("rv-range-verdict");
    verdict.hidden = !r.verdict;
    verdict.textContent = VERDICTS[r.verdict] || "";
    verdict.className = "range__verdict range__verdict--" + (r.verdict || "some");
    $("rv-range-summary").textContent = r.summary;

    $("rv-range-list").replaceChildren(...r.explorations.map((e) => {
      const col = columns.find((c) => c.id === e.colId);
      if (!col) return document.createComment("");
      const li = document.createElement("li");
      li.className = "range__item";
      const img = document.createElement("img");
      img.src = screenUrl(col.screens[0]);
      img.alt = "";
      const text = document.createElement("div");
      text.className = "range__text";
      const top = document.createElement("p");
      top.className = "range__name";
      top.textContent = col.label;
      if (e.relation) {
        const rel = document.createElement("span");
        rel.className = "range__rel range__rel--" + e.relation;
        rel.textContent = RELATIONS[e.relation];
        top.append(" ", rel);
      }
      const bet = document.createElement("p");
      bet.className = "range__bet";
      bet.textContent = e.bet;
      text.append(top, bet);
      if (e.angles.length) {
        const angles = document.createElement("p");
        angles.className = "range__angles";
        e.angles.forEach((a) => {
          const chip = document.createElement("span");
          chip.className = "range__angle range__angle--" + (a.delivered || "yes");
          chip.textContent = ANGLE_NAMES[a.angle].replace(/^./, (c) => c.toUpperCase()) + (DELIVERED[a.delivered] || "");
          angles.append(chip);
        });
        text.append(angles);
      }
      li.append(img, text);
      return li;
    }));

    $("rv-range-shared-wrap").hidden = !r.shared;
    $("rv-range-shared").textContent = r.shared;
    $("rv-range-untried-wrap").hidden = !r.untried;
    $("rv-range-untried").textContent = r.untried;
  }

  // ---------- Design review cards ----------
  // Points are numbered across a design: strengths first, then improvements.
  function numberedPoints(c) {
    return [
      ...(c.strengths || []).map((p) => ({ ...(typeof p === "string" ? { text: p } : p), kind: "good" })),
      ...(c.improvements || []).map((p) => ({ ...(typeof p === "string" ? { text: p } : p), kind: "improve" })),
    ].map((p, n) => ({ ...p, n: n + 1 }));
  }

  function screenUrl(screen) {
    const url = URL.createObjectURL(screen.blob);
    urls.push(url);
    return url;
  }

  function renderCritique() {
    const section = $("rv-critique");
    const cols = columns.filter((c) => {
      const crit = c.exploration && review.critique && review.critique[c.id];
      return crit && (crit.overall || (crit.strengths || []).length || (crit.improvements || []).length);
    });
    section.hidden = !cols.length;
    if (!cols.length) return;
    $("rv-critique-list").replaceChildren(...cols.map((col) => {
      const c = review.critique[col.id];
      const points = numberedPoints(c);
      const card = document.createElement("article");
      card.className = "crit";

      const head = document.createElement("header");
      head.className = "crit__head";
      const name = document.createElement("h3");
      name.className = "crit__name";
      name.textContent = col.label;
      head.append(name);
      if (col.intent) {
        const intent = document.createElement("p");
        intent.className = "crit__intent";
        intent.textContent = "Intent: " + col.intent;
        head.append(intent);
      }
      card.append(head);

      const layout = document.createElement("div");
      layout.className = "crit__layout";

      // Screens, each opening the annotated view.
      const shots = document.createElement("div");
      shots.className = "crit__shots";
      col.screens.forEach((screen, si) => {
        const pins = points.filter((p) => p.screenId === screen.id && p.x !== null && p.x !== undefined).length;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "crit__shot";
        btn.setAttribute("aria-label", "Open " + col.label + " screen " + (si + 1) + " with annotations");
        const img = document.createElement("img");
        img.src = screenUrl(screen);
        img.alt = "";
        btn.append(img);
        if (pins) {
          const badge = document.createElement("span");
          badge.className = "crit__badge";
          badge.textContent = pins + (pins === 1 ? " note" : " notes");
          btn.append(badge);
        }
        btn.addEventListener("click", () => openAnnotations(col, si));
        shots.append(btn);
      });
      const hint = document.createElement("p");
      hint.className = "crit__hint";
      hint.textContent = "Click a screen to see the notes on it";
      shots.append(hint);

      const text = document.createElement("div");
      text.className = "crit__text";
      if (c.overall) {
        const overall = document.createElement("p");
        overall.className = "crit__overall";
        overall.textContent = c.overall;
        text.append(overall);
      }
      const body = document.createElement("div");
      body.className = "crit__body";
      [["What's working", "good"], ["What to improve", "improve"]].forEach(([label, kind]) => {
        const colEl = document.createElement("div");
        colEl.className = "crit__col crit__col--" + kind;
        const h = document.createElement("h4");
        h.textContent = label;
        const ul = document.createElement("ul");
        points.filter((p) => p.kind === kind).forEach((p) => {
          const li = document.createElement("li");
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "crit__point";
          const num = document.createElement("span");
          num.className = "pin pin--" + kind;
          num.textContent = p.n;
          const t = document.createElement("span");
          t.textContent = p.text;
          btn.append(num, t);
          const si = Math.max(0, col.screens.findIndex((sc) => sc.id === p.screenId));
          btn.addEventListener("click", () => openAnnotations(col, si, p.n));
          li.append(btn);
          ul.append(li);
        });
        colEl.append(h, ul);
        body.append(colEl);
      });
      text.append(body);

      layout.append(shots, text);
      card.append(layout);
      return card;
    }));
  }

  // ---------- Annotated screen view ----------
  const annot = $("annot");
  let annotState = null; // { col, index, active }

  function openAnnotations(col, index, active) {
    annotState = { col, index, active: active || null };
    renderAnnotations();
    if (!annot.open) annot.showModal();
  }

  function renderAnnotations() {
    const { col, index, active } = annotState;
    const screen = col.screens[index];
    const points = numberedPoints(review.critique[col.id] || {});
    $("annot-title").textContent = col.label;
    $("annot-img").src = screenUrl(screen);
    $("annot-img").alt = col.label + ", screen " + (index + 1);
    $("annot-count").textContent = "Screen " + (index + 1) + " of " + col.screens.length;
    $("annot-prev").disabled = index === 0;
    $("annot-next").disabled = index === col.screens.length - 1;
    $("annot-nav").hidden = col.screens.length < 2;
    if (overallFor(col)) {
      $("annot-overall").textContent = overallFor(col);
      $("annot-overall").hidden = false;
    } else {
      $("annot-overall").hidden = true;
    }

    const pins = $("annot-pins");
    pins.replaceChildren(...points
      .filter((p) => p.screenId === screen.id && p.x !== null && p.x !== undefined)
      .map((p) => {
        const pin = document.createElement("button");
        pin.type = "button";
        pin.className = "pin pin--" + p.kind + " annot__pin" + (p.n === active ? " is-active" : "");
        pin.style.left = p.x + "%";
        pin.style.top = p.y + "%";
        pin.textContent = p.n;
        pin.setAttribute("aria-label", "Note " + p.n);
        pin.addEventListener("click", () => { annotState.active = p.n; renderAnnotations(); });
        return pin;
      }));

    const list = $("annot-list");
    list.replaceChildren(...points.map((p) => {
      const li = document.createElement("li");
      const onThis = p.screenId === screen.id;
      li.className = "annot__item" + (p.n === active ? " is-active" : "") + (onThis ? "" : " is-elsewhere");
      const btn = document.createElement("button");
      btn.type = "button";
      const num = document.createElement("span");
      num.className = "pin pin--" + p.kind;
      num.textContent = p.n;
      const t = document.createElement("span");
      t.className = "annot__text";
      t.textContent = p.text;
      const where = document.createElement("span");
      where.className = "annot__where";
      const si = col.screens.findIndex((sc) => sc.id === p.screenId);
      where.textContent = (p.kind === "good" ? "Working" : "To improve") +
        (!onThis && si >= 0 ? " · on screen " + (si + 1) : p.x === null || p.x === undefined ? " · whole screen" : "");
      t.append(where);
      btn.append(num, t);
      btn.addEventListener("click", () => {
        annotState.active = p.n;
        if (!onThis && si >= 0) annotState.index = si;
        renderAnnotations();
      });
      li.append(btn);
      return li;
    }));
  }

  function overallFor(col) {
    const c = review.critique && review.critique[col.id];
    return c && c.overall;
  }

  $("annot-close").addEventListener("click", () => annot.close());
  annot.addEventListener("click", (e) => { if (e.target === annot) annot.close(); });
  $("annot-prev").addEventListener("click", () => { annotState.index--; annotState.active = null; renderAnnotations(); });
  $("annot-next").addEventListener("click", () => { annotState.index++; annotState.active = null; renderAnnotations(); });

  function cycle(col, i) {
    const v = verdictsFor(col);
    const current = v[i];
    v[i] = current === null ? "applied" : current === "not_yet" ? null : VALUES[VALUES.indexOf(current) + 1];
    review.verdicts[col.id] = v;
    review.filledBy[col.id] = "you";
    save();
    renderTable();
    updateSummaryButton();
  }

  function complete(col) {
    return verdictsFor(col).every(Boolean);
  }

  function updateSummaryButton() {
    const ready = columns.some((c) => c.exploration && complete(c));
    const manual = review.mode === "manual";
    summaryBtn.hidden = !manual;
    summaryBtn.disabled = busy || !ready;
    summaryBtn.textContent = review.summary ? "Rewrite summary" : "Write my summary";
    $("rv-summary-hint").hidden = !manual || ready || !!review.summary;
  }

  function renderSummary() {
    const s = review.summary;
    summaryEl.hidden = !s;
    if (!s) return;
    $("rv-strongest").textContent = s.strongest || "—";
    $("rv-why").textContent = s.why || "";
    $("rv-improved").textContent = s.improved || "";
    $("rv-next").textContent = s.next || "";
    $("rv-summary-source").textContent =
      review.mode === "images" ? "Written by Claude after looking at your screens."
      : review.mode === "read" ? "Written by Claude from the page's reading of your screenshots."
      : "Written by Claude from your answers in the grid. It didn't see your screens.";
  }

  // ---------- Asking Claude ----------
  async function getSample() {
    try {
      return window.claude && window.claude.use ? await window.claude.use("sample") : null;
    } catch (_) {
      return null;
    }
  }

  async function imageLimitsFor(sample) {
    if (typeof sample.limits !== "function") return ASSUMED_IMAGE_LIMITS;
    try {
      const limits = await sample.limits();
      return (limits && limits.images) || null;
    } catch (_) {
      return ASSUMED_IMAGE_LIMITS;
    }
  }

  const isChoice = (o) => o.kind === "choice";

  function observationList() {
    return analysis.observations
      .map((o, i) => (i + 1) + ". [" + (isChoice(o) ? "brand choice" : "principle") + "] " + o.title + ": " + o.body)
      .join("\n");
  }

  const SUMMARY_SHAPE =
    '"summary": {"strongest": "<the exploration label, exactly as given>", ' +
    '"why": "1–2 sentences on why it is strongest", ' +
    '"improved": "1–2 sentences on what improved compared with the original design (or what to compare it with if there is no original)", ' +
    '"next": "1–2 sentences: the one visual design skill to practice next time"}';

  // Pick screens within the image budget: one per column first, then extras.
  function pickImages(limits) {
    // Returns screen objects (not just blobs) so critique points can point at them.
    const usable = columns.map((c) =>
      c.screens.filter((s) => s.blob && limits.mediaTypes.includes(s.blob.type) && s.blob.size <= limits.maxInputBytes)
    );
    const picked = columns.map(() => []);
    let left = limits.maxCount;
    for (let round = 0; left > 0; round++) {
      let added = false;
      for (let c = 0; c < columns.length && left > 0; c++) {
        if (usable[c][round]) {
          picked[c].push(usable[c][round]);
          left--;
          added = true;
        }
      }
      if (!added) break;
    }
    return picked;
  }

  const ANGLE_NAMES = {
    hero: "hero and priority",
    structure: "structure",
    components: "components and interaction",
    tone: "visual tone",
  };

  function describeColumn(col) {
    const angles = (col.angles || []).map((a) => ANGLE_NAMES[a]).filter(Boolean);
    return '"' + col.label + '"' +
      (col.exploration ? " (a redesign exploration)" : " (the learner's original design, before studying references)") +
      (col.intent ? ', intent: "' + col.intent.slice(0, 140) + '"' : "") +
      (angles.length ? ", the learner says it changes: " + angles.join(", ") : "");
  }

  // The part of the prompt both routes share: what to judge and the reply shape.
  function reviewTask(basis, reading) {
    return [
      "For each design:",
      "1. Judge every observation: \"applied\", \"partly\" or \"not_yet\", based only on " + basis + ". " +
        "For a brand choice, the verdict only records whether the design uses it (applied = uses it). " +
        "Not using a brand choice is a valid decision, never a weakness.",
      "2. Write a one-sentence note on what it does best.",
      '3. Write "overall": your general take in 2–3 sentences, the way a design lead opens a critique: ' +
        "its visual direction, what it gets right and its biggest opportunity.",
      "4. Critique its visual design strategy as a senior UI/UX designer in a design critique: the look and feel and whether it " +
        "suits the brief, the colour direction, the typographic character, how sections are visually designed and grouped, how the " +
        "visual hierarchy guides the eye, whether spacing and rhythm feel deliberate and consistent" +
        (reading ? "" : ", imagery and iconography") +
        ", and whether the stated intent comes through visually. Talk about design decisions, not specs: no measurements, " +
        "pixel or point values, contrast ratios or exact fixes. Say \"the spacing works: related details sit together and the " +
        "action has room to breathe\", not \"increase the gap to 24pt\". Treat brand choices as options, not rules.",
      "   Give 2–3 strengths and 2–3 improvements. Each point is one or two sentences, at most 35 words. " +
        "Each improvement suggests a direction to explore.",
      '   For each point give where it applies: "screen" is the design\'s screen number (1 = its first screen), and "x" and "y" ' +
        "are the approximate position of the element the point is about, as a percentage (0–100) of that screen's width and height" +
        (reading ? " (work it out from the positions and the screen size in the reading)" : "") +
        '. Use null for x and y when the point is about the whole screen.',
      ...rangeTask(),
            "Then compare the explorations and write a short summary.",
      "",
      "Reply with only JSON:",
      '{"columns": [{"label": "<label exactly as given>", "verdicts": [' + analysis.observations.length +
        ' values in observation order], "note": string, "overall": string, ' +
        '"strengths": [{"text": string, "screen": number, "x": number|null, "y": number|null}], ' +
        '"improvements": [{"text": string, "screen": number, "x": number|null, "y": number|null}]}], ' +
        '"range": {"verdict", "summary", "shared", "untried", "explorations": [{"label", "bet", "relation", "angles"}]}, ' +
        SUMMARY_SHAPE + "}",
    ];
  }

  // How far the explorations range: shared by the full review and the range-only check.
  function rangeTask() {
    return [
      "Judge the range of the exploration as a whole. In product design, exploring mostly means making different bets " +
        "about what matters most on the screen: a different hero and hierarchy, a different structure, or different components " +
        "and interaction. Visual tone usually varies less because the brand and the category set it; count tone as range only " +
        "where this brief leaves room for it, and say so when it doesn't.",
      '   For each exploration: "bet": one short line naming what it prioritizes; "relation" to the original and the other ' +
        'explorations: "new_direction" (a different bet), "variation" (the same bet, rearranged or with different components) ' +
        'or "reskin" (the same structure and hierarchy with different styling); "angles": for each change the learner says it ' +
        'makes, whether it really does: [{"angle": "hero"|"structure"|"components"|"tone", "delivered": "yes"|"partly"|"no"}].',
      '   Overall: "verdict": "wide", "some" or "narrow"; "summary": 1–2 sentences on how far the learner explored; ' +
        '"shared": the assumption every exploration keeps, in one sentence ("" if there is none); "untried": one concrete ' +
        "direction for this brief that none of them tried, as a different bet, in 1–2 sentences.",
    ];
  }

  function reviewIntro() {
    return [
      "You are a senior product designer reviewing a learner's redesign in a visual design practice exercise.",
      "",
      "Today's brief: " + challenge.brief,
      "",
      "Earlier, the learner studied reference screens and got these " + analysis.observations.length + " observations:",
      observationList(),
      "",
    ];
  }

  // Store Claude's answer: verdicts (unless you set them by hand), notes, critique, summary.
  // `seen` lists, per design Claude looked at, the column and the screens it saw (in order).
  function applyReview(raw, seen, mode) {
    if (!raw || !Array.isArray(raw.columns)) return false;
    const pct = (v) => (typeof v === "number" && isFinite(v) ? Math.max(2, Math.min(98, v)) : null);
    const points = (list, screens) =>
      (Array.isArray(list) ? list : [])
        .map((p) => (typeof p === "string" ? { text: p } : p))
        .filter((p) => p && typeof p.text === "string" && p.text.trim())
        .slice(0, 4)
        .map((p) => {
          const screen = screens[(Number(p.screen) || 1) - 1] || screens[0];
          const x = pct(p.x), y = pct(p.y);
          return { text: p.text.trim(), screenId: screen ? screen.id : null, x: x !== null && y !== null ? x : null, y: x !== null && y !== null ? y : null };
        });
    review.critique = review.critique || {};
    raw.columns.forEach((c, i) => {
      const entry = seen[i];
      const target = entry && entry.col;
      if (!target || !c) return;
      review.critique[target.id] = {
        overall: typeof c.overall === "string" ? c.overall.trim() : "",
        strengths: points(c.strengths, entry.screens),
        improvements: points(c.improvements, entry.screens),
      };
      if (typeof c.note === "string") review.notes[target.id] = c.note.trim();
      if (!Array.isArray(c.verdicts) || review.filledBy[target.id] === "you") return;
      review.verdicts[target.id] = analysis.observations.map((_, j) =>
        VALUES.includes(c.verdicts[j]) ? c.verdicts[j] : null
      );
      review.filledBy[target.id] = "claude";
    });
    review.range = cleanRange(raw.range);
    review.summary = cleanSummary(raw.summary);
    review.mode = mode;
    return true;
  }

  function cleanRange(r) {
    if (!r || typeof r !== "object") return null;
    const str = (x) => (typeof x === "string" ? x.trim() : "");
    const explorationCols = columns.filter((c) => c.exploration);
    const byLabel = new Map(explorationCols.map((c) => [c.label.toLowerCase(), c]));
    const explorations = (Array.isArray(r.explorations) ? r.explorations : [])
      .map((e, i) => {
        // Match by label; if Claude spelled it differently, fall back to order.
        const col = e && (byLabel.get(str(e.label).toLowerCase()) || explorationCols[i]);
        if (!col) return null;
        return {
          colId: col.id,
          bet: str(e.bet),
          relation: ["new_direction", "variation", "reskin"].includes(e.relation) ? e.relation : null,
          angles: (Array.isArray(e.angles) ? e.angles : [])
            .filter((a) => a && ANGLE_NAMES[a.angle])
            .map((a) => ({ angle: a.angle, delivered: ["yes", "partly", "no"].includes(a.delivered) ? a.delivered : null })),
        };
      })
      .filter(Boolean);
    return {
      verdict: ["wide", "some", "narrow"].includes(r.verdict) ? r.verdict : null,
      summary: str(r.summary),
      shared: str(r.shared),
      untried: str(r.untried),
      explorations,
    };
  }

  async function reviewWithImages(sample, limits, refresh) {
    const picked = pickImages(limits);
    const seen = columns.map((c, i) => ({ col: c, screens: picked[i] })).filter((x) => x.screens.length);
    if (!seen.some((x) => x.col.exploration)) return null;

    let n = 0;
    const mapping = seen.map(({ col, screens }) => {
      const first = n + 1;
      n += screens.length;
      const range = screens.length === 1 ? "Image " + first : "Images " + first + "–" + n + " (its screens 1–" + screens.length + ")";
      return "- " + range + ": " + describeColumn(col);
    });

    const prompt = [
      ...reviewIntro(),
      "Attached images, in order:",
      ...mapping,
      "",
      ...reviewTask("what is visible", false),
    ].join("\n");

    setStatus("Claude is reviewing " + seen.filter((x) => x.col.exploration).length + " exploration(s)…");
    const raw = await sample.json(prompt, {
      images: seen.flatMap((x) => x.screens.map((s) => s.blob)),
      modelTier: "default",
      cache: refresh ? { ...CACHE, refresh: true } : CACHE,
      onText: () => setStatus("Writing the review…"),
    });
    return applyReview(raw, seen, "images");
  }

  // When this view can't send images: the page reads each screenshot (text,
  // sizes, colours, layout) and Claude reviews that reading.
  const SCREENS_PER_DESIGN = 3;
  // The page's reading of each design's first screens: colId -> [text].
  async function collectReadings(onProgress) {
    const jobs = [];
    columns.forEach((col) => col.screens.slice(0, SCREENS_PER_DESIGN).forEach((s, i) => jobs.push({ col, s, i })));
    const readings = new Map();
    for (let k = 0; k < jobs.length; k++) {
      const { col, s, i } = jobs[k];
      (onProgress || setStatus)("Reading your screens (" + (k + 1) + " of " + jobs.length + ")…");
      const text = await window.DTCReader.describe("screen:" + s.id, s.blob, challenge.platform);
      if (!readings.has(col.id)) readings.set(col.id, []);
      readings.get(col.id).push("Screen " + (i + 1) + (s.name ? ' ("' + s.name + '")' : "") + ":\n" + text);
    }
    return readings;
  }

  const READING_NOTE =
    "You can't see the screens. Instead, the page read each screenshot for you: the text on screen (by OCR, so a word " +
    "may be misread), its position, height, colour, contrast and a rough weight, plus background bands, palette, " +
    "picture areas, left edges and vertical gaps. Measurements are approximate. Reconstruct each layout from these readings.";

  // ---------- Range-only check ----------
  const hasRange = (r) => !!(r && (r.summary || (r.explorations && r.explorations.length)));
  let rangeBusy = false;

  async function checkRange(refresh) {
    if (rangeBusy) return;
    rangeBusy = true;
    renderRangeState("loading");
    try {
      const sample = await getSample();
      if (!sample) throw { code: "not_granted" };
      const intro = [
        "You are a senior product designer reviewing how widely a learner explored in a visual design practice exercise.",
        "",
        "Today's brief: " + challenge.brief,
        "",
      ];
      const task = [...rangeTask(), "", 'Reply with only JSON: {"range": {"verdict", "summary", "shared", "untried", ' +
        '"explorations": [{"label": "<label exactly as given>", "bet", "relation", "angles"}]}}'];
      let raw;
      const limits = review.mode === "images" ? await imageLimitsFor(sample) : null;
      if (limits) {
        const picked = pickImages(limits);
        const seen = columns.map((c, i) => ({ col: c, screens: picked[i] })).filter((x) => x.screens.length);
        let n = 0;
        const mapping = seen.map(({ col, screens }) => {
          const first = n + 1;
          n += screens.length;
          return "- " + (screens.length === 1 ? "Image " + first : "Images " + first + "–" + n) + ": " + describeColumn(col);
        });
        raw = await sample.json([...intro, "Attached images, in order:", ...mapping, "", ...task].join("\n"), {
          images: seen.flatMap((x) => x.screens.map((sc) => sc.blob)),
          modelTier: "default",
          cache: refresh ? { ...CACHE, refresh: true } : CACHE,
        });
      } else {
        if (!window.DTCReader) throw { code: "reader_unavailable" };
        const readings = await collectReadings((t) => renderRangeState("loading", t));
        renderRangeState("loading");
        raw = await sample.json([
          ...intro,
          READING_NOTE,
          "",
          ...columns.map((col) => "### " + describeColumn(col) + "\n" + (readings.get(col.id) || []).join("\n\n")),
          "",
          ...task,
        ].join("\n"), {
          modelTier: "default",
          cache: refresh ? { ...CACHE, refresh: true } : CACHE,
        });
      }
      const range = cleanRange(raw && raw.range ? raw.range : raw);
      if (!hasRange(range)) throw { code: "invalid_json" };
      review.range = range;
      save();
      renderRangeState(null);
      renderRange();
    } catch (err) {
      if (err && err.code === "cancelled") return;
      renderRangeState("error");
    } finally {
      rangeBusy = false;
    }
  }

  async function reviewWithReading(sample, refresh) {
    if (!window.DTCReader) return null;
    const readings = await collectReadings();

    const prompt = [
      ...reviewIntro(),
      "You can't see the screens. Instead, the page read each screenshot for you: the text on screen (by OCR, so a word " +
        "may be misread), its position, height, colour, contrast and a rough weight, plus background bands, palette, " +
        "picture areas, left edges and vertical gaps. Measurements are approximate. Reconstruct each layout from these " +
        "readings. Judge only what the reading supports; icons and imagery only show up as picture areas, so don't " +
        "critique their content.",
      "",
      ...columns.map((col) => "### " + describeColumn(col) + "\n" + (readings.get(col.id) || []).join("\n\n")),
      "",
      ...reviewTask("what the readings show", true),
    ].join("\n");

    setStatus("Claude is reviewing " + columns.filter((c) => c.exploration).length + " exploration(s)…");
    const raw = await sample.json(prompt, {
      modelTier: "default",
      cache: refresh ? { ...CACHE, refresh: true } : CACHE,
      onText: () => setStatus("Writing the review…"),
    });
    return applyReview(raw, columns.map((col) => ({ col, screens: col.screens.slice(0, SCREENS_PER_DESIGN) })), "read");
  }

  async function summaryFromAnswers(sample) {
    const rows = columns.map((col) => {
      const v = verdictsFor(col);
      return "- " + col.label + (col.exploration ? "" : " (original design)") +
        (col.intent ? ', intent: "' + col.intent.slice(0, 140) + '"' : "") + ": " +
        v.map((x, i) => (i + 1) + "=" + (x ? LABELS[x] : "not checked")).join(", ");
    });
    const prompt = [
      "You are a senior product designer coaching a learner in a visual design practice exercise.",
      "You cannot see their screens. Work only from their self-assessment below.",
      "",
      "Today's brief: " + challenge.brief,
      "",
      "Observations from their study of reference screens:",
      observationList(),
      "",
      "How the learner rated each design against those observations:",
      ...rows,
      "",
      "Write a short summary. Reply with only JSON: {" + SUMMARY_SHAPE + "}",
    ].join("\n");
    setStatus("Claude is writing your summary…");
    const raw = await sample.json(prompt, {
      modelTier: "default",
      cache: false,
      onText: () => setStatus("Writing your summary…"),
    });
    const summary = cleanSummary(raw && raw.summary);
    if (!summary) return null;
    review.summary = summary;
    review.mode = "text";
    return true;
  }

  function cleanSummary(s) {
    if (!s || typeof s !== "object") return null;
    const str = (x) => (typeof x === "string" ? x.trim() : "");
    const out = { strongest: str(s.strongest), why: str(s.why), improved: str(s.improved), next: str(s.next) };
    return out.strongest || out.why || out.next ? out : null;
  }

  const ERRORS = {
    not_granted: "This page isn't allowed to ask Claude. Reload and choose Allow when Claude asks.",
    sampling_disabled: "Claude isn't available for this account.",
    image_rejected: "Claude couldn't read one of your screens. Try uploading it as PNG or JPG.",
    rate_limited: "Claude is busy or you've hit your usage limit. Try again in a few minutes.",
    session_expired: "Your Claude session expired. Sign in again, then reload.",
    invalid_json: "Claude's answer came back in a form the page couldn't read.",
    refused: "Claude declined to review these screens.",
    empty_completion: "Claude didn't return a review.",
    prompt_too_large: "Too much to send at once. Remove a few screens and try again.",
  };
  const RETRYABLE = new Set(["rate_limited", "invalid_json", "empty_completion", "upstream_error"]);

  // ---------- When neither images nor the screen reader work ----------
  const noImages = $("rv-noimg");
  const manualBtn = $("rv-manual");
  manualBtn.addEventListener("click", () => {
    review.mode = "manual";
    save();
    showBody();
  });

  function showBody() {
    const manual = review.mode === "manual";
    const byClaude = review.mode === "images" || review.mode === "read";
    $("rv-body").hidden = !(byClaude || manual);
    $("rv-read-note").hidden = review.mode !== "read";
    $("rv-cell-hint").hidden = $("rv-body").hidden;
    manualBtn.hidden = manual;
    $("rv-manual-note").hidden = !manual;
    updateSummaryButton();
  }

  // ---------- Running ----------
  async function run(kind, refresh) {
    if (busy) return;
    busy = true;
    updateSummaryButton();
    rerunBtn.hidden = true;
    try {
      const sample = await getSample();
      if (!sample) {
        setStatus("Claude reviews your screens only when this site is open inside Claude.", {
          label: "Fill in the grid myself",
          onClick: () => { setStatus(""); review.mode = "manual"; save(); showBody(); },
        });
        return;
      }
      if (kind === "images") {
        const limits = await imageLimitsFor(sample);
        let ok = false;
        if (limits) {
          setStatus("Claude is looking at your screens…");
          try {
            ok = await reviewWithImages(sample, limits, refresh);
          } catch (err) {
            if (!err || err.code !== "images_unavailable") throw err;
          }
        }
        if (!ok) {
          try {
            ok = await reviewWithReading(sample, refresh);
          } catch (err) {
            if (err && err.code) throw err; // a Claude error, handled below
            ok = false; // the reader itself failed to load or run
          }
        }
        if (!ok) {
          setStatus("");
          noImages.hidden = false;
          showBody();
          return;
        }
        noImages.hidden = true;
      } else {
        const ok = await summaryFromAnswers(sample);
        if (!ok) throw { code: "invalid_json" };
        review.mode = "manual";
      }
      review.signature = signature();
      save();
      setStatus("");
      showBody();
      renderTable();
      renderSummary();
      if (review.mode === "images" || review.mode === "read") {
        rerunBtn.hidden = false;
        if (!hasRange(review.range)) checkRange(refresh);
      }
    } catch (err) {
      const code = (err && err.code) || "upstream_error";
      if (code === "cancelled") return;
      setStatus(ERRORS[code] || "Claude couldn't finish (" + code + ").",
        RETRYABLE.has(code) || !ERRORS[code] ? { label: "Try again", onClick: () => run(kind, true) } : null);
    } finally {
      busy = false;
      updateSummaryButton();
    }
  }

  summaryBtn.addEventListener("click", () => run("text"));
  $("rv-range-retry").addEventListener("click", () => checkRange(true));
  rerunBtn.addEventListener("click", () => {
    columns.forEach((c) => {
      if (review.filledBy[c.id] === "claude") delete review.verdicts[c.id];
    });
    run("images", true);
  });

  // ---------- Entering the round ----------
  window.DTCPages.on("review", async () => {
    await loadAll();
    noImages.hidden = true;
    if (!analysis) {
      $("rv-body").hidden = true;
      setStatus("Review checks your redesign against today's analysis, so finish Compare first.", { label: "Open Compare", href: "#compare" });
      return;
    }
    if (!columns.some((c) => c.exploration)) {
      $("rv-body").hidden = true;
      setStatus("Upload at least one exploration in Redesign first.", { label: "Open Redesign", href: "#redesign" });
      return;
    }
    if (review.mode === "text") review.mode = "manual"; // older saves
    setStatus("");
    renderTable();
    renderSummary();
    showBody();

    if (review.mode === "images" || review.mode === "read") {
      // Look again only when the explorations changed since Claude's last look.
      const needsClaude = columns.some((c) => c.exploration && !review.verdicts[c.id]) ||
        // Reviews from before the overall take and annotated points.
        columns.some((c) => c.exploration && !(review.critique && review.critique[c.id] && "overall" in review.critique[c.id]));
      if (needsClaude || review.signature !== signature()) run("images", true);
      else {
        rerunBtn.hidden = false;
        // Reviews from before the range check, or where Claude left it out.
        if (!hasRange(review.range)) checkRange(false);
      }
    } else {
      // Claude hasn't seen the screens yet: try now. Falls back to the
      // open-in-browser panel when this view can't send images.
      run("images", false);
    }
  });
})();

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

  function signature() {
    return JSON.stringify(columns.map((c) => [c.id, c.screens.map((s) => s.id)]));
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
      tr.append(th);
      columns.forEach((col) => {
        const td = document.createElement("td");
        const value = verdictsFor(col)[i];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "rv-cell" + (value ? " rv-cell--" + value : "");
        btn.textContent = value ? LABELS[value] : "—";
        btn.setAttribute("aria-label", col.label + ", " + o.title + ": " + (value ? LABELS[value] : "not checked") + ". Click to change.");
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
    renderCritique();
  }

  function renderTally() {
    const tally = $("rv-tally");
    tally.replaceChildren(...columns.map((col) => {
      const v = verdictsFor(col);
      const applied = v.filter((x) => x === "applied").length;
      const partly = v.filter((x) => x === "partly").length;
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.className = "rv-tally__name";
      name.textContent = col.label;
      const score = document.createElement("span");
      score.className = "rv-tally__score";
      score.textContent = applied + " applied" + (partly ? " · " + partly + " partly" : "");
      const bar = document.createElement("span");
      bar.className = "rv-tally__bar";
      bar.innerHTML = '<span class="rv-tally__fill"></span><span class="rv-tally__part"></span>';
      const total = analysis.observations.length;
      bar.children[0].style.width = (applied / total) * 100 + "%";
      bar.children[1].style.width = (partly / total) * 100 + "%";
      li.append(name, score, bar);
      return li;
    }));
  }

  function renderCritique() {
    const section = $("rv-critique");
    const cols = columns.filter((c) => c.exploration && review.critique && review.critique[c.id] &&
      (review.critique[c.id].strengths.length || review.critique[c.id].improvements.length));
    section.hidden = !cols.length;
    if (!cols.length) return;
    $("rv-critique-list").replaceChildren(...cols.map((col) => {
      const c = review.critique[col.id];
      const card = document.createElement("article");
      card.className = "crit";

      const head = document.createElement("header");
      head.className = "crit__head";
      const thumb = document.createElement("img");
      const url = URL.createObjectURL(col.screens[0].blob);
      urls.push(url);
      thumb.src = url;
      thumb.alt = "";
      const titles = document.createElement("div");
      const name = document.createElement("h3");
      name.className = "crit__name";
      name.textContent = col.label;
      titles.append(name);
      if (col.intent) {
        const intent = document.createElement("p");
        intent.className = "crit__intent";
        intent.textContent = "Intent: " + col.intent;
        titles.append(intent);
      }
      head.append(thumb, titles);

      const body = document.createElement("div");
      body.className = "crit__body";
      [["What's working", c.strengths, "good"], ["What to improve", c.improvements, "improve"]].forEach(([label, items, kind]) => {
        const col2 = document.createElement("div");
        col2.className = "crit__col crit__col--" + kind;
        const h = document.createElement("h4");
        h.textContent = label;
        const ul = document.createElement("ul");
        items.forEach((t) => {
          const li = document.createElement("li");
          li.textContent = t;
          ul.append(li);
        });
        col2.append(h, ul);
        body.append(col2);
      });

      card.append(head, body);
      return card;
    }));
  }

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

  function observationList() {
    return analysis.observations
      .map((o, i) => (i + 1) + ". " + o.title + ": " + o.body)
      .join("\n");
  }

  const SUMMARY_SHAPE =
    '"summary": {"strongest": "<the exploration label, exactly as given>", ' +
    '"why": "1–2 sentences on why it is strongest", ' +
    '"improved": "1–2 sentences on what improved compared with the original design (or what to compare it with if there is no original)", ' +
    '"next": "1–2 sentences: the one thing to practice next time"}';

  // Pick screens within the image budget: one per column first, then extras.
  function pickImages(limits) {
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

  function describeColumn(col) {
    return '"' + col.label + '"' +
      (col.exploration ? " (a redesign exploration)" : " (the learner's original design, before studying references)") +
      (col.intent ? ', intent: "' + col.intent.slice(0, 140) + '"' : "");
  }

  // The part of the prompt both routes share: what to judge and the reply shape.
  function reviewTask(basis) {
    return [
      "For each design:",
      "1. Judge every observation: \"applied\", \"partly\" or \"not_yet\", based only on " + basis + ".",
      "2. Write a one-sentence note on what it does best.",
      "3. Then critique it as a senior UI/UX designer in a design review: beyond the observations, look at visual hierarchy, " +
        "typography, spacing and alignment, color and contrast, accessibility, copy, affordances and platform conventions. " +
        "Give 2–3 strengths and 2–3 improvements. Each point is one sentence, at most 30 words, names the specific element on screen, " +
        "and each improvement says concretely what to change. Be direct and kind; no generic advice.",
      "Then compare the explorations and write a short summary.",
      "",
      "Reply with only JSON:",
      '{"columns": [{"label": "<label exactly as given>", "verdicts": [' + analysis.observations.length +
        ' values in observation order], "note": string, "strengths": [string], "improvements": [string]}], ' +
        SUMMARY_SHAPE + "}",
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
  function applyReview(raw, seenCols, mode) {
    if (!raw || !Array.isArray(raw.columns)) return false;
    const points = (x) => (Array.isArray(x) ? x.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim()).slice(0, 4) : []);
    review.critique = review.critique || {};
    raw.columns.forEach((c, i) => {
      const target = seenCols[i];
      if (!target || !c) return;
      review.critique[target.id] = { strengths: points(c.strengths), improvements: points(c.improvements) };
      if (typeof c.note === "string") review.notes[target.id] = c.note.trim();
      if (!Array.isArray(c.verdicts) || review.filledBy[target.id] === "you") return;
      review.verdicts[target.id] = analysis.observations.map((_, j) =>
        VALUES.includes(c.verdicts[j]) ? c.verdicts[j] : null
      );
      review.filledBy[target.id] = "claude";
    });
    review.summary = cleanSummary(raw.summary);
    review.mode = mode;
    return true;
  }

  async function reviewWithImages(sample, limits, refresh) {
    const picked = pickImages(limits);
    const seen = columns.map((c, i) => ({ col: c, blobs: picked[i] })).filter((x) => x.blobs.length);
    if (!seen.some((x) => x.col.exploration)) return null;

    let n = 0;
    const mapping = seen.map(({ col, blobs }) => {
      const first = n + 1;
      n += blobs.length;
      const range = blobs.length === 1 ? "Image " + first : "Images " + first + "–" + n;
      return "- " + range + ": " + describeColumn(col);
    });

    const prompt = [
      ...reviewIntro(),
      "Attached images, in order:",
      ...mapping,
      "",
      ...reviewTask("what is visible"),
    ].join("\n");

    setStatus("Claude is reviewing " + seen.filter((x) => x.col.exploration).length + " exploration(s)…");
    const raw = await sample.json(prompt, {
      images: seen.flatMap((x) => x.blobs),
      modelTier: "default",
      cache: refresh ? { ...CACHE, refresh: true } : CACHE,
      onText: () => setStatus("Writing the review…"),
    });
    return applyReview(raw, seen.map((x) => x.col), "images");
  }

  // When this view can't send images: the page reads each screenshot (text,
  // sizes, colours, layout) and Claude reviews that reading.
  const SCREENS_PER_DESIGN = 3;
  async function reviewWithReading(sample, refresh) {
    if (!window.DTCReader) return null;
    const jobs = [];
    columns.forEach((col) => col.screens.slice(0, SCREENS_PER_DESIGN).forEach((s, i) => jobs.push({ col, s, i })));
    const readings = new Map();
    for (let k = 0; k < jobs.length; k++) {
      const { col, s, i } = jobs[k];
      setStatus("Reading your screens (" + (k + 1) + " of " + jobs.length + ")…");
      const text = await window.DTCReader.describe("screen:" + s.id, s.blob, challenge.platform);
      if (!readings.has(col.id)) readings.set(col.id, []);
      readings.get(col.id).push("Screen " + (i + 1) + (s.name ? ' ("' + s.name + '")' : "") + ":\n" + text);
    }

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
      ...reviewTask("what the readings show"),
    ].join("\n");

    setStatus("Claude is reviewing " + columns.filter((c) => c.exploration).length + " exploration(s)…");
    const raw = await sample.json(prompt, {
      modelTier: "default",
      cache: refresh ? { ...CACHE, refresh: true } : CACHE,
      onText: () => setStatus("Writing the review…"),
    });
    return applyReview(raw, columns, "read");
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
      if (review.mode === "images" || review.mode === "read") rerunBtn.hidden = false;
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
      const needsClaude = columns.some((c) => c.exploration && !review.verdicts[c.id]);
      if (needsClaude || review.signature !== signature()) run("images", true);
      else rerunBtn.hidden = false;
    } else {
      // Claude hasn't seen the screens yet: try now. Falls back to the
      // open-in-browser panel when this view can't send images.
      run("images", false);
    }
  });
})();

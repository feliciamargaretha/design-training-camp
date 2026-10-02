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
    summaryBtn.disabled = busy || !ready;
    summaryBtn.textContent = review.summary ? "Rewrite summary" : "Write my summary";
    $("rv-summary-hint").hidden = ready || !!review.summary;
  }

  function renderSummary() {
    const s = review.summary;
    summaryEl.hidden = !s;
    if (!s) return;
    $("rv-strongest").textContent = s.strongest || "—";
    $("rv-why").textContent = s.why || "";
    $("rv-improved").textContent = s.improved || "";
    $("rv-next").textContent = s.next || "";
    $("rv-summary-source").textContent = review.mode === "images"
      ? "Written by Claude after looking at your screens."
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

  async function reviewWithImages(sample, limits, refresh) {
    const picked = pickImages(limits);
    const seen = columns.map((c, i) => ({ col: c, blobs: picked[i] })).filter((x) => x.blobs.length);
    if (!seen.some((x) => x.col.exploration)) return null;

    let n = 0;
    const mapping = seen.map(({ col, blobs }) => {
      const first = n + 1;
      n += blobs.length;
      const range = blobs.length === 1 ? "Image " + first : "Images " + first + "–" + n;
      return "- " + range + ': "' + col.label + '"' +
        (col.exploration ? " (a redesign exploration)" : " (the learner's original design, before studying references)") +
        (col.intent ? ', intent: "' + col.intent.slice(0, 140) + '"' : "");
    });

    const prompt = [
      "You are a senior product designer reviewing a learner's redesign in a visual design practice exercise.",
      "",
      "Today's brief: " + challenge.brief,
      "",
      "Earlier, the learner studied reference screens and got these " + analysis.observations.length + " observations:",
      observationList(),
      "",
      "Attached images, in order:",
      ...mapping,
      "",
      "For each design, judge every observation: \"applied\", \"partly\" or \"not_yet\", based only on what is visible.",
      "Add a one-sentence note per design on what it does best.",
      "Then compare the explorations and write a short summary.",
      "",
      "Reply with only JSON:",
      '{"columns": [{"label": "<label exactly as given>", "verdicts": [' + analysis.observations.length +
        ' values in observation order], "note": string}], ' + SUMMARY_SHAPE + "}",
    ].join("\n");

    setStatus("Claude is reviewing " + seen.filter((x) => x.col.exploration).length + " exploration(s)…");
    const raw = await sample.json(prompt, {
      images: seen.flatMap((x) => x.blobs),
      modelTier: "default",
      cache: refresh ? { ...CACHE, refresh: true } : CACHE,
      onText: () => setStatus("Writing the review…"),
    });
    if (!raw || !Array.isArray(raw.columns)) return null;

    raw.columns.forEach((c, i) => {
      const target = seen[i] && seen[i].col;
      if (!target || !Array.isArray(c.verdicts)) return;
      // Keep what you set by hand.
      if (review.filledBy[target.id] === "you") return;
      review.verdicts[target.id] = analysis.observations.map((_, j) =>
        VALUES.includes(c.verdicts[j]) ? c.verdicts[j] : null
      );
      review.filledBy[target.id] = "claude";
      if (typeof c.note === "string") review.notes[target.id] = c.note.trim();
    });
    review.summary = cleanSummary(raw.summary);
    review.mode = "images";
    return true;
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

  const MANUAL_NOTE =
    "This view of Claude can't send images, so mark each cell yourself: Applied, Partly or Not yet. " +
    "Then ask Claude for a summary of your answers.";

  async function run(kind, refresh) {
    if (busy) return;
    busy = true;
    updateSummaryButton();
    rerunBtn.hidden = true;
    try {
      const sample = await getSample();
      if (!sample) {
        setStatus("Claude only helps here when this site is open inside Claude. Mark each cell yourself to see how your explorations compare.");
        return;
      }
      if (kind === "images") {
        const limits = await imageLimitsFor(sample);
        let ok = false;
        if (limits) {
          try {
            ok = await reviewWithImages(sample, limits, refresh);
          } catch (err) {
            if (!err || err.code !== "images_unavailable") throw err;
          }
        }
        if (!ok) {
          review.mode = "text";
          save();
          setStatus(MANUAL_NOTE);
          return;
        }
      } else {
        const ok = await summaryFromAnswers(sample);
        if (!ok) throw { code: "invalid_json" };
      }
      review.signature = signature();
      save();
      setStatus(review.mode === "text" ? MANUAL_NOTE : "");
      renderTable();
      renderSummary();
      if (review.mode === "images") rerunBtn.hidden = false;
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
    const body = $("rv-body");
    if (!analysis) {
      body.hidden = true;
      setStatus("Review checks your redesign against today's analysis, so finish Compare first.", { label: "Open Compare", href: "#compare" });
      return;
    }
    if (!columns.some((c) => c.exploration)) {
      body.hidden = true;
      setStatus("Upload at least one exploration in Redesign first.", { label: "Open Redesign", href: "#redesign" });
      return;
    }
    body.hidden = false;
    setStatus(review.mode === "text" ? MANUAL_NOTE : "");
    renderTable();
    renderSummary();
    updateSummaryButton();

    // Ask Claude to review when the explorations changed since its last look.
    const needsClaude = columns.some((c) => c.exploration && !review.verdicts[c.id]);
    if (review.mode !== "text" && (needsClaude || review.signature !== signature())) {
      run("images", review.signature && review.signature !== signature());
    } else if (review.mode === "images") {
      rerunBtn.hidden = false;
    } else if (review.mode === "text") {
      // Filled by hand in a view without images: let Claude check once a view can send them.
      const sample = await getSample();
      const limits = sample && typeof sample.limits === "function"
        ? await sample.limits().catch(() => null)
        : null;
      if (limits && limits.images) {
        review.mode = undefined;
        run("images", true);
      }
    }
  });
})();

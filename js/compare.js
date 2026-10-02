// Compare round: Claude's analysis of today's references (and your design),
// set against what you noticed in Study.
(function () {
  const $ = (id) => document.getElementById(id);
  const challenge = window.DTC.today();
  const analysisKey = window.DTCStore.key("analysis");
  const compareKey = window.DTCStore.key("compare");
  const COUNT = 10;
  const CACHE = { gcTime: 86400000 };

  const timer = window.DTCTimer.create({
    el: $("cmp-timer"),
    stateEl: $("cmp-timer-state"),
    round: "compare",
    label: "Round 3 of 4",
    minutes: 10,
  });

  const list = $("cmp-list");
  const status = $("cmp-status");
  const statusText = $("cmp-status-text");
  const statusAction = $("cmp-status-action");
  const rerun = $("cmp-rerun");

  let analysis = null; // { challengeId, headline, observations, refCount, designCount }
  let noticed = new Set();
  let running = false;

  // ---------- Rendering ----------
  function setStatus(text, action) {
    status.hidden = !text;
    statusText.textContent = text || "";
    statusAction.hidden = !action;
    if (action) {
      statusAction.textContent = action.label;
      statusAction.href = action.href || "#compare";
      statusAction.onclick = action.onClick
        ? (e) => { e.preventDefault(); action.onClick(); }
        : null;
    }
  }

  function renderSkeleton() {
    list.replaceChildren(...Array.from({ length: 4 }, (_, i) => {
      const li = document.createElement("li");
      li.className = "obs obs--loading";
      li.setAttribute("aria-hidden", "true");
      li.innerHTML = '<span class="obs__num">' + String(i + 1).padStart(2, "0") +
        '</span><div class="obs__text"><p class="obs__title"></p><p class="obs__body"></p></div>';
      return li;
    }));
  }

  const VERDICT = { yes: "Already in your design", partly: "Partly in your design", no: "Missing from your design" };

  function renderAnalysis() {
    $("cmp-headline").textContent = analysis.headline;
    $("cmp-meta").textContent = "Claude's analysis · " + analysis.refCount + " reference screens · " +
      analysis.observations.length + " observations";
    list.replaceChildren(...analysis.observations.map((o, i) => {
      const li = document.createElement("li");
      li.className = "obs";
      li.classList.toggle("is-noticed", noticed.has(i));

      const num = document.createElement("span");
      num.className = "obs__num";
      num.textContent = String(i + 1).padStart(2, "0");

      const text = document.createElement("div");
      text.className = "obs__text";
      const title = document.createElement("h3");
      title.className = "obs__title";
      title.textContent = o.title;
      const body = document.createElement("p");
      body.className = "obs__body";
      body.textContent = o.body;
      text.append(title, body);

      if (o.yourDesign && VERDICT[o.yourDesign]) {
        const yours = document.createElement("p");
        yours.className = "obs__yours obs__yours--" + o.yourDesign;
        const chip = document.createElement("span");
        chip.className = "obs__chip";
        chip.textContent = VERDICT[o.yourDesign];
        yours.append(chip);
        if (o.yourDesignNote) yours.append(" " + o.yourDesignNote);
        text.append(yours);
      }

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "obs__toggle";
      toggle.setAttribute("aria-pressed", String(noticed.has(i)));
      toggle.setAttribute("aria-label", "I noticed this too: " + o.title);
      toggle.textContent = noticed.has(i) ? "✓" : "+";
      toggle.addEventListener("click", () => toggleNoticed(i));

      li.append(num, text, toggle);
      return li;
    }));
    renderCount();
  }

  function renderCount() {
    const total = analysis ? analysis.observations.length : COUNT;
    $("cmp-count").textContent = noticed.size + " of " + total + " observations noticed";
  }

  function toggleNoticed(i) {
    noticed.has(i) ? noticed.delete(i) : noticed.add(i);
    window.DTCStore.set(compareKey, { challengeId: challenge.id, noticed: [...noticed] });
    renderAnalysis();
  }

  async function renderNotes() {
    const saved = await window.DTCStore.get(window.DTCStore.key("study"));
    const notes = saved && saved.challengeId === challenge.id ? saved : {};
    [["patterns", "cmp-patterns"], ["dos", "cmp-dos"], ["donts", "cmp-donts"]].forEach(([kind, id]) => {
      const items = [1, 2, 3].map((n) => (notes[kind + "-" + n] || "").trim()).filter(Boolean);
      const ul = $(id);
      if (!items.length) {
        ul.innerHTML = '<li class="is-empty">No notes yet. <a href="#study">Add yours in Study.</a></li>';
        return;
      }
      ul.replaceChildren(...items.map((t) => {
        const li = document.createElement("li");
        li.textContent = t;
        return li;
      }));
    });
  }

  // ---------- Asking Claude ----------
  function buildPrompt(refs, designCount, intent) {
    const lines = [
      "You are a senior product designer coaching someone who is training their visual design eye.",
      "",
      "Today's brief: " + challenge.brief,
      "",
      "Attached images, in order:",
      ...refs.map((r, i) => "- Image " + (i + 1) + ": " + r.appName + " (a real " + challenge.name.toLowerCase() + " screen from Mobbin)"),
    ];
    if (designCount) {
      const first = refs.length + 1;
      const last = refs.length + designCount;
      lines.push(
        (designCount === 1 ? "- Image " + first : "- Images " + first + "–" + last) +
          ": the learner's own design for the brief" +
          (intent ? ' (their stated intent: "' + intent.slice(0, 140) + '")' : "")
      );
    }
    lines.push(
      "",
      "Write exactly " + COUNT + " observations about the reference screens: the design decisions that make them work, " +
        "and the occasional one that doesn't. Base every observation on what is visible in the images and name the apps that show it. " +
        "Cover layout and hierarchy, typography, spacing, color, copy and interaction, not only one of them. No generic advice.",
      "",
      "Each observation has:",
      '- "title": an imperative of at most 7 words, e.g. "Make the next step unmistakable"',
      '- "body": 1–2 sentences, at most 40 words, citing specific apps and visible details',
      designCount
        ? '- "yourDesign": "yes", "partly" or "no": whether the learner\'s design already does this\n' +
          '- "yourDesignNote": one short sentence pointing at the specific part of their design'
        : '- "yourDesign": null\n- "yourDesignNote": null',
      "",
      'Also write "headline": "A closer look at <the screen type>." in sentence case, e.g. "A closer look at checkout."',
      "",
      'Reply with only JSON: {"headline": string, "observations": [{"title", "body", "yourDesign", "yourDesignNote"}]}'
    );
    return lines.join("\n");
  }

  function clean(raw, refCount, designCount) {
    if (!raw || !Array.isArray(raw.observations)) return null;
    const observations = raw.observations
      .filter((o) => o && typeof o.title === "string" && typeof o.body === "string")
      .slice(0, COUNT)
      .map((o) => ({
        title: o.title.trim(),
        body: o.body.trim(),
        yourDesign: designCount && ["yes", "partly", "no"].includes(o.yourDesign) ? o.yourDesign : null,
        yourDesignNote: designCount && typeof o.yourDesignNote === "string" ? o.yourDesignNote.trim() : "",
      }));
    if (!observations.length) return null;
    return {
      challengeId: challenge.id,
      headline: typeof raw.headline === "string" && raw.headline.trim()
        ? raw.headline.trim()
        : "A closer look at " + challenge.name.toLowerCase() + ".",
      observations,
      refCount,
      designCount,
    };
  }

  const ERRORS = {
    not_granted: "This page isn't allowed to ask Claude. Reload and choose Allow when Claude asks.",
    sampling_disabled: "Claude isn't available for this account, so the analysis can't run.",
    images_unavailable: "Claude can't look at images in this view, so it can't analyze the screens.",
    image_rejected: "Claude couldn't read one of the screens. Try uploading your design as PNG or JPG.",
    rate_limited: "Claude is busy or you've hit your usage limit. Try again in a few minutes.",
    session_expired: "Your Claude session expired. Sign in again, then reload.",
    invalid_json: "Claude's answer came back in a form the page couldn't read.",
    refused: "Claude declined to analyze these screens.",
    empty_completion: "Claude didn't return an analysis.",
    prompt_too_large: "Too much to send at once. Remove a few design screens and try again.",
  };
  const RETRYABLE = new Set(["rate_limited", "invalid_json", "empty_completion", "upstream_error"]);

  async function runAnalysis(refresh) {
    if (running) return;
    running = true;
    rerun.hidden = true;
    renderSkeleton();
    $("cmp-meta").textContent = "Claude's analysis";
    setStatus("Getting today's Mobbin references…");

    try {
      const refsRes = await window.DTCRefs.load(challenge);
      if (refsRes.status !== "ok") {
        list.replaceChildren();
        setStatus(refsRes.message, { label: "Open Study", href: "#study" });
        return;
      }

      let sample = null;
      try {
        sample = window.claude && window.claude.use ? await window.claude.use("sample") : null;
      } catch (_) {}
      if (!sample) {
        list.replaceChildren();
        setStatus("The analysis is written by Claude, so it only runs when this site is open inside Claude. " +
          "Compare your design with the references in Study for now.", { label: "Back to Study", href: "#study" });
        return;
      }

      const limits = await sample.limits().catch(() => null);
      const imageLimits = limits && limits.images;
      if (!imageLimits) {
        list.replaceChildren();
        setStatus(ERRORS.images_unavailable);
        return;
      }

      const design = await window.DTCStore.get(window.DTCStore.key("design"));
      const designScreens = design && design.challengeId === challenge.id ? design.screens || [] : [];
      const usable = designScreens
        .map((s) => s.blob)
        .filter((b) => b && imageLimits.mediaTypes.includes(b.type) && b.size <= imageLimits.maxInputBytes);
      const designBudget = Math.min(usable.length, 3, Math.max(0, imageLimits.maxCount - 1));
      const refs = refsRes.screens.slice(0, Math.max(1, imageLimits.maxCount - designBudget));
      const designBlobs = usable.slice(0, Math.min(designBudget, imageLimits.maxCount - refs.length));
      const images = [...refs.map((r) => window.DTCRefs.toBlob(r.image)), ...designBlobs];

      setStatus("Claude is looking at " + refs.length + " reference screens" +
        (designBlobs.length ? " and your design" : "") + "…");

      const prompt = buildPrompt(refs, designBlobs.length, design && design.intent);
      const raw = await sample.json(prompt, {
        images,
        modelTier: "default",
        cache: refresh ? { ...CACHE, refresh: true } : CACHE,
        onText: () => setStatus("Writing the analysis…"),
      });

      const result = clean(raw, refs.length, designBlobs.length);
      if (!result) {
        list.replaceChildren();
        setStatus(ERRORS.invalid_json, { label: "Try again", onClick: () => runAnalysis(true) });
        return;
      }
      analysis = result;
      noticed = new Set();
      await window.DTCStore.set(compareKey, { challengeId: challenge.id, noticed: [] });
      await window.DTCStore.set(analysisKey, analysis);
      setStatus("");
      renderAnalysis();
      rerun.hidden = false;
    } catch (err) {
      const code = (err && err.code) || "upstream_error";
      if (code === "cancelled") return;
      list.replaceChildren();
      const text = ERRORS[code] || "The analysis couldn't finish (" + code + ").";
      setStatus(text, RETRYABLE.has(code) || !ERRORS[code]
        ? { label: "Try again", onClick: () => runAnalysis(true) }
        : null);
    } finally {
      running = false;
    }
  }

  rerun.addEventListener("click", () => runAnalysis(true));

  // ---------- Entering the round ----------
  let started = false;
  window.DTCPages.on("compare", async () => {
    timer.start();
    renderNotes();
    if (started) return;
    started = true;

    const [saved, marks] = await Promise.all([
      window.DTCStore.get(analysisKey),
      window.DTCStore.get(compareKey),
    ]);
    if (marks && marks.challengeId === challenge.id) noticed = new Set(marks.noticed || []);
    if (saved && saved.challengeId === challenge.id && saved.observations && saved.observations.length) {
      analysis = saved;
      renderAnalysis();
      rerun.hidden = false;
    } else {
      runAnalysis(false);
    }
  });
})();

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
    label: "Round 3 of 5",
    minutes: 10,
  });

  const list = $("cmp-list");
  const status = $("cmp-status");
  const statusText = $("cmp-status-text");
  const statusAction = $("cmp-status-action");
  const rerun = $("cmp-rerun");

  let analysis = null; // { challengeId, headline, observations, mode, refCount, designCount }
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

  function countLabel(observations) {
    const choices = observations.filter((o) => o.kind === "choice").length;
    const principles = observations.length - choices;
    return principles + (principles === 1 ? " principle" : " principles") +
      (choices ? " · " + choices + (choices === 1 ? " brand choice" : " brand choices") : "");
  }

  function renderAnalysis() {
    $("cmp-headline").textContent = analysis.headline;
    $("cmp-meta").textContent = "Claude's analysis · " +
      (analysis.mode === "text" ? "Written from the brief"
        : analysis.refCount + " reference screens" + (analysis.mode === "read" ? ", read by the page" : "")) +
      " · " + countLabel(analysis.observations);
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
      if (o.kind === "choice") {
        const kind = document.createElement("span");
        kind.className = "obs__kind";
        kind.textContent = "Brand choice";
        title.append(" ", kind);
      }
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
  // Used when the view doesn't say what it supports: try sending images anyway.
  const ASSUMED_IMAGE_LIMITS = {
    maxCount: 6,
    maxInputBytes: 20000000,
    mediaTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  };

  // Principles hold for almost any good screen of this type; brand choices are
  // patterns some brands use and others deliberately don't.
  const FORMAT = [
    "Separate principles from brand choices. A principle holds for almost any good " + window.DTC.refNoun(challenge) +
      " because it serves a clear user need. A brand choice is a pattern some brands use and others deliberately " +
      "don't (a stylistic, brand or business decision, or a trade-off), so it is an option, not a rule. " +
      "Write at least 7 principles and at most 3 brand choices.",
    "",
    "Each observation has:",
    '- "kind": "principle" or "choice"',
    '- "title": at most 7 words. For a principle, an imperative, e.g. "Make the next step unmistakable". ' +
      'For a choice, an option, e.g. "Consider showing the total on the button"',
    '- for a choice, the body names the trade-off and when the option fits',
  ];
  const JSON_SHAPE =
    'Reply with only JSON: {"headline": string, "observations": [{"kind", "title", "body", "yourDesign", "yourDesignNote"}]}';
  const HEADLINE =
    'Also write "headline": "A closer look at <the screen type>." in sentence case, e.g. "A closer look at checkout."';

  function promptWithImages(refs, designCount, intent) {
    const lines = [
      "You are a senior product designer coaching someone who is training their visual design eye.",
      "",
      "Today's brief: " + window.DTC.briefLine(challenge),
      "",
      "Attached images, in order:",
      ...refs.map((r, i) => "- Image " + (i + 1) + ": " + r.appName + " (a real " + window.DTC.refNoun(challenge) + " from Mobbin)"),
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
      ...FORMAT,
      '- "body": 1–2 sentences, at most 40 words, citing specific apps and visible details',
      designCount
        ? '- "yourDesign": "yes", "partly" or "no": whether the learner\'s design already does this\n' +
          '- "yourDesignNote": one short sentence pointing at the specific part of their design'
        : '- "yourDesign": null\n- "yourDesignNote": null',
      "",
      HEADLINE,
      "",
      JSON_SHAPE
    );
    return lines.join("\n");
  }

  // Fallback when this view can't send images: Claude can't see the screens,
  // so it writes what strong screens of this type do, for the learner to check
  // against the references they just studied.
  function promptWithoutImages(refs) {
    return [
      "You are a senior product designer coaching someone who is training their visual design eye.",
      "",
      "Today's brief: " + window.DTC.briefLine(challenge),
      "The learner has just studied real " + window.DTC.refNoun(challenge) + "s on Mobbin from: " +
        refs.map((r) => r.appName).join(", ") + ".",
      "You cannot see those screens or the learner's design.",
      "",
      "Write exactly " + COUNT + " observations: the design decisions that make strong " + window.DTC.refNoun(challenge) +
        "s work, phrased so the learner can check each one against the screens they studied. " +
        "Be concrete about layout and hierarchy, typography, spacing, color, copy and interaction. " +
        "Do not claim what any specific app's screen shows.",
      "",
      ...FORMAT,
      '- "body": 1–2 sentences, at most 40 words, specific enough to check against a screen',
      '- "yourDesign": null',
      '- "yourDesignNote": null',
      "",
      HEADLINE,
      "",
      JSON_SHAPE,
    ].join("\n");
  }

  function clean(raw, meta) {
    if (!raw || !Array.isArray(raw.observations)) return null;
    const judged = (meta.mode === "images" || meta.mode === "read") && meta.designCount > 0;
    const observations = raw.observations
      .filter((o) => o && typeof o.title === "string" && typeof o.body === "string")
      .slice(0, COUNT)
      .map((o) => ({
        kind: o.kind === "choice" ? "choice" : "principle",
        title: o.title.trim(),
        body: o.body.trim(),
        yourDesign: judged && ["yes", "partly", "no"].includes(o.yourDesign) ? o.yourDesign : null,
        yourDesignNote: judged && typeof o.yourDesignNote === "string" ? o.yourDesignNote.trim() : "",
      }));
    if (!observations.length) return null;
    return {
      challengeId: challenge.id,
      headline: typeof raw.headline === "string" && raw.headline.trim()
        ? raw.headline.trim()
        : "A closer look at " + challenge.name.toLowerCase() + ".",
      observations,
      ...meta,
    };
  }

  const READ_NOTE =
    "Claude can't see images in your Claude account, so the page read each screenshot (the text, sizes, positions, " +
    "colours and contrast) and Claude analyzed that reading. It can misread a word, and it can't judge icons or imagery.";

  const TEXT_ONLY_NOTE =
    "This view of Claude can't send images, so Claude wrote this from today's brief without seeing the screens or your design. " +
    "Check each point against the references in Study. Opening this page at claude.ai in a web browser may let Claude analyze the screens themselves.";

  const ERRORS = {
    not_granted: "This page isn't allowed to ask Claude. Reload and choose Allow when Claude asks.",
    sampling_disabled: "Claude isn't available for this account, so the analysis can't run.",
    image_rejected: "Claude couldn't read one of the screens. Try uploading your design as PNG or JPG.",
    rate_limited: "Claude is busy or you've hit your usage limit. Try again in a few minutes.",
    session_expired: "Your Claude session expired. Sign in again, then reload.",
    invalid_json: "Claude's answer came back in a form the page couldn't read.",
    refused: "Claude declined to analyze these screens.",
    empty_completion: "Claude didn't return an analysis.",
    prompt_too_large: "Too much to send at once. Remove a few design screens and try again.",
  };
  const RETRYABLE = new Set(["rate_limited", "invalid_json", "empty_completion", "upstream_error"]);

  async function getSample() {
    try {
      return window.claude && window.claude.use ? await window.claude.use("sample") : null;
    } catch (_) {
      return null;
    }
  }

  // The view's image limits; ASSUMED_IMAGE_LIMITS when it can't say; null when it says no.
  async function imageLimitsFor(sample) {
    if (typeof sample.limits !== "function") return ASSUMED_IMAGE_LIMITS;
    try {
      const limits = await sample.limits();
      return (limits && limits.images) || null;
    } catch (_) {
      return ASSUMED_IMAGE_LIMITS;
    }
  }

  async function askWithImages(sample, imageLimits, refsAll, design, cache) {
    const designScreens = design && design.challengeId === challenge.id ? design.screens || [] : [];
    const usable = designScreens
      .map((s) => s.blob)
      .filter((b) => b && imageLimits.mediaTypes.includes(b.type) && b.size <= imageLimits.maxInputBytes);
    const designBudget = Math.min(usable.length, 3, Math.max(0, imageLimits.maxCount - 1));
    const refs = refsAll.slice(0, Math.max(1, imageLimits.maxCount - designBudget));
    const designBlobs = usable.slice(0, Math.min(designBudget, imageLimits.maxCount - refs.length));
    const images = [...refs.map((r) => window.DTCRefs.toBlob(r.image)), ...designBlobs];

    setStatus("Claude is looking at " + refs.length + " reference screens" +
      (designBlobs.length ? " and your design" : "") + "…");
    const raw = await sample.json(promptWithImages(refs, designBlobs.length, design && design.intent), {
      images,
      modelTier: "default",
      cache,
      onText: () => setStatus("Writing the analysis…"),
    });
    return clean(raw, { mode: "images", refCount: refs.length, designCount: designBlobs.length });
  }

  // When this view can't send images: the page reads each screenshot (text,
  // sizes, colours, layout) and Claude analyzes that reading.
  async function askWithReading(sample, refs, design, cache) {
    if (!window.DTCReader) return null;
    const designScreens = design && design.challengeId === challenge.id ? (design.screens || []).slice(0, 3) : [];
    const jobs = [
      ...refs.map((r) => ({ key: "ref:" + r.id, blob: window.DTCRefs.toBlob(r.image), label: r.appName, ref: true })),
      ...designScreens.map((s, i) => ({ key: "screen:" + s.id, blob: s.blob, label: "Learner's design, screen " + (i + 1) })),
    ];
    const readings = [];
    for (let k = 0; k < jobs.length; k++) {
      setStatus("Reading the screens (" + (k + 1) + " of " + jobs.length + ")…");
      readings.push("### " + jobs[k].label + (jobs[k].ref ? " (a real " + window.DTC.refNoun(challenge) + " from Mobbin)" : "") +
        "\n" + (await window.DTCReader.describe(jobs[k].key, jobs[k].blob, challenge.platform)));
    }
    const intent = design && design.intent;
    const prompt = [
      "You are a senior product designer coaching someone who is training their visual design eye.",
      "",
      "Today's brief: " + window.DTC.briefLine(challenge),
      "",
      "You can't see the screens. Instead, the page read each screenshot for you: the text on screen (by OCR, so a word " +
        "may be misread), its position, height, colour, contrast and a rough weight, plus background bands, palette, " +
        "picture areas, left edges and vertical gaps. Measurements are approximate, and the Mobbin screens are small " +
        "previews, so their readings are rougher. Reconstruct each layout from the readings.",
      designScreens.length && intent ? 'The learner\'s stated intent: "' + intent.slice(0, 140) + '"' : "",
      "",
      ...readings,
      "",
      "Write exactly " + COUNT + " observations about the reference screens: the design decisions that make them work, " +
        "and the occasional one that doesn't. Base every observation on what the readings show and name the apps that show it. " +
        "Cover layout and hierarchy, typography, spacing, color, copy and interaction. Don't comment on icons or imagery. No generic advice.",
      "",
      ...FORMAT,
      '- "body": 1–2 sentences, at most 40 words, citing specific apps and details from the readings',
      designScreens.length
        ? '- "yourDesign": "yes", "partly" or "no": whether the learner\'s design already does this\n' +
          '- "yourDesignNote": one short sentence pointing at the specific part of their design'
        : '- "yourDesign": null\n- "yourDesignNote": null',
      "",
      HEADLINE,
      "",
      JSON_SHAPE,
    ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");

    setStatus("Claude is analyzing the screens…");
    const raw = await sample.json(prompt, {
      modelTier: "default",
      cache,
      onText: () => setStatus("Writing the analysis…"),
    });
    return clean(raw, { mode: "read", refCount: refs.length, designCount: designScreens.length });
  }

  async function askWithoutImages(sample, refs, cache) {
    setStatus("Claude is writing an analysis from today's brief…");
    const raw = await sample.json(promptWithoutImages(refs), {
      modelTier: "default",
      cache,
      onText: () => setStatus("Writing the analysis…"),
    });
    return clean(raw, { mode: "text", refCount: refs.length, designCount: 0 });
  }

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

      const sample = await getSample();
      if (!sample) {
        list.replaceChildren();
        setStatus("The analysis is written by Claude, so it only runs when this site is open inside Claude. " +
          "Compare your design with the references in Study for now.", { label: "Back to Study", href: "#study" });
        return;
      }

      const cache = refresh ? { ...CACHE, refresh: true } : CACHE;
      const design = await window.DTCStore.get(window.DTCStore.key("design"));
      const imageLimits = await imageLimitsFor(sample);

      let canSendImages = !!imageLimits;
      let result = null;
      if (canSendImages) {
        try {
          result = await askWithImages(sample, imageLimits, refsRes.screens, design, cache);
        } catch (err) {
          if (!err || err.code !== "images_unavailable") throw err;
          canSendImages = false; // the view refused images after all
        }
      }
      if (!canSendImages) {
        try {
          result = await askWithReading(sample, refsRes.screens, design, cache);
        } catch (err) {
          if (err && err.code) throw err; // a Claude error, handled below
          result = null; // the reader itself failed: fall back to the brief
        }
        if (!result) result = await askWithoutImages(sample, refsRes.screens, cache);
      }

      if (!result) {
        list.replaceChildren();
        setStatus(ERRORS.invalid_json, { label: "Try again", onClick: () => runAnalysis(true) });
        return;
      }
      analysis = result;
      noticed = new Set();
      await window.DTCStore.set(compareKey, { challengeId: challenge.id, noticed: [] });
      await window.DTCStore.set(analysisKey, analysis);
      showAnalysis();
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

  function showAnalysis() {
    setStatus(analysis.mode === "text" ? TEXT_ONLY_NOTE : analysis.mode === "read" ? READ_NOTE : "");
    renderAnalysis();
    rerun.hidden = false;
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
    if (!(saved && saved.challengeId === challenge.id && saved.observations && saved.observations.length)) {
      runAnalysis(false);
      return;
    }
    analysis = saved;
    showAnalysis();

    // Redo it once when it was written from the brief only (before the page
    // could read screenshots, or when reading failed), or before principles
    // and brand choices were told apart.
    if (saved.mode === "text" || !saved.observations.some((o) => o.kind)) runAnalysis(true);
  });
})();

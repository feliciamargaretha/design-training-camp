// Palette Drill: Claude's analysis. Claude gets only measured values, already
// formatted, and must quote them. Every number in its answer is checked
// against the data it was given; a line with a number that isn't there is
// asked for again once, then dropped.
(function () {
  const CACHE = { gcTime: 86400000 };

  async function getSample() {
    try { return window.claude && window.claude.use ? await window.claude.use("sample") : null; } catch (_) { return null; }
  }

  function dataBlock({ brief, feel, bases, colors, checks, refs }) {
    const lines = [];
    lines.push("BRIEF: " + brief.what + " " + brief.positioning + " Personality: " + brief.personality + " " + brief.avoid + " Mode: " + brief.mode + ". Screen: " + brief.where);
    lines.push("", "FEEL WORDS (each with the color decision the learner made for it):");
    feel.forEach((f) => lines.push("- " + f.word + ": " + f.decision));
    lines.push("", "BASE COLORS the learner picked (exact hex; OKLCH measured):");
    bases.forEach((b) => lines.push("- " + b.label + " (" + b.kind + "): " + b.hex + " · L " + b.fmt.L + " · C " + b.fmt.C + " · H " + b.fmt.H));
    lines.push("", "THE LEARNER'S SCREEN, each color used (scale and stop, hex, OKLCH, share of the screen) and the elements using it:");
    colors.forEach((c) => lines.push("- " + c.label + ": " + c.hex + " · L " + c.fmt.L + " · C " + c.fmt.C + " · H " + c.fmt.H + " · share " + c.fmt.share + " · used for: " + c.roles.join(", ")));
    lines.push("", "MEASURED CHECKS:");
    checks.forEach((c) => lines.push("- " + c.name + ": " + (c.result === "clear" ? "Clear" : c.result === "look" ? "Look again" : "Not run") + (c.value ? " (" + c.value + ")" : "") + ". " + (c.detail || "") + (c.rule ? " Rule: " + c.rule : "")));
    lines.push("", "REAL PRODUCTS (palettes read from one screenshot's pixels; include photos and illustrations; hex is approximate; the role of each color is unknown):");
    refs.forEach((p) => {
      if (!p.found) { lines.push("- " + p.name + (p.role === "product" ? " (the product this brief is written from)" : "") + ": no screen available."); return; }
      const s = p.summary;
      lines.push("- " + p.name + (p.role === "product" ? " (the product this brief is written from)" : "") + ": lightness range L " + s.lightMin + " to " + s.lightMax +
        (s.owner ? "; most saturated " + s.owner.hex + " (C " + s.owner.C + ", H " + s.owner.H + ") covering " + s.owner.share : "") +
        "; colors: " + s.colors.map((c) => c.hex + " L " + c.L + " C " + c.C + " " + c.share).join(", "));
    });
    return lines.join("\n");
  }

  const SHAPE = '{"real":{"products":[{"name":"","line":""}],"shared":"","split":""},"right":[""],"harmony":{"verdict":"harmonious|not yet","why":"","color":"","change":""},"feel":[{"word":"","verdict":"held|broke","line":""}],"next":""}';

  function prompt(data, note) {
    return [
      "You are a senior brand and UI designer coaching a learner in a 20-minute color palette drill. You cannot see any screen.",
      "Work ONLY from the measured values below. Quote numbers exactly as written there. Never estimate, round, convert or invent a number; if a value isn't below, say it in words.",
      "",
      data,
      "",
      "Write five parts, short and specific, plain words:",
      "1. real: for each real product with a screen, one line on its lightness range, which color owns saturation, and that color's share. Then 'shared': what they have in common; 'split': where they differ. If a product has no screen, line: \"No screen to measure.\"",
      "2. right: up to 3 things the learner got right, each tied to one measured value from the table or checks.",
      "3. harmony: verdict \"harmonious\" or \"not yet\" with one line why. If not yet, name the ONE color to change in 'color' and in 'change' the dimension (lightness, chroma or hue) and direction (up/down, warmer/cooler), no new numbers.",
      "4. feel: one line per feel word saying whether the palette held or broke it, using the decision the learner wrote.",
      "5. next: one line, the one thing to practice next.",
      "Hex codes count as numbers: only use hex codes that appear above.",
      note || "",
      "Reply with only JSON: " + SHAPE,
    ].join("\n");
  }

  // Numbers and hex codes in the data Claude got.
  function allowed(data) {
    const hex = new Set((data.match(/#[0-9a-f]{6}\b/gi) || []).map((h) => h.toLowerCase()));
    const nums = new Set((data.replace(/#[0-9a-f]{6}\b/gi, " ").match(/\d+(?:\.\d+)?/g) || []).map(Number));
    [1, 2, 3, 4, 5].forEach((n) => nums.add(n));
    return { hex, nums };
  }

  function badTokens(text, ok) {
    const bad = [];
    (text.match(/#[0-9a-f]{3,8}\b/gi) || []).forEach((h) => { if (!ok.hex.has(h.toLowerCase())) bad.push(h); });
    (text.replace(/#[0-9a-f]{3,8}\b/gi, " ").match(/\d+(?:\.\d+)?/g) || []).forEach((n) => { if (!ok.nums.has(Number(n))) bad.push(n); });
    return bad;
  }

  const str = (x) => (typeof x === "string" ? x.trim() : "");

  function clean(raw) {
    if (!raw || typeof raw !== "object") return null;
    const real = raw.real || {};
    const h = raw.harmony || {};
    return {
      real: { products: (Array.isArray(real.products) ? real.products : []).map((p) => ({ name: str(p && p.name), line: str(p && p.line) })).filter((p) => p.line), shared: str(real.shared), split: str(real.split) },
      right: (Array.isArray(raw.right) ? raw.right : []).map(str).filter(Boolean).slice(0, 3),
      harmony: { verdict: /not/i.test(str(h.verdict)) ? "not yet" : "harmonious", why: str(h.why), color: str(h.color), change: str(h.change) },
      feel: (Array.isArray(raw.feel) ? raw.feel : []).map((f) => ({ word: str(f && f.word), verdict: /broke/i.test(str(f && f.verdict)) ? "broke" : "held", line: str(f && f.line) })).filter((f) => f.line),
      next: str(raw.next),
    };
  }

  // Every string in the answer, with a way to blank it.
  function strings(a) {
    const out = [];
    a.real.products.forEach((p) => out.push([p, "line"]));
    out.push([a.real, "shared"], [a.real, "split"]);
    a.right.forEach((_, i) => out.push([a.right, i]));
    out.push([a.harmony, "why"], [a.harmony, "color"], [a.harmony, "change"]);
    a.feel.forEach((f) => out.push([f, "line"]));
    out.push([a, "next"]);
    return out;
  }

  function audit(a, ok) {
    const bad = [];
    strings(a).forEach(([o, k]) => { const b = badTokens(String(o[k] || ""), ok); if (b.length) bad.push({ o, k, b }); });
    return bad;
  }

  async function analyze(input, onStatus) {
    const sample = await getSample();
    if (!sample) return { status: "unavailable" };
    const data = dataBlock(input);
    const ok = allowed(data);
    try {
      onStatus && onStatus("Claude is reading your numbers…");
      let a = clean(await sample.json(prompt(data), { modelTier: "default", cache: CACHE, onText: () => onStatus && onStatus("Writing the analysis…") }));
      if (!a) throw { code: "invalid_json" };
      let bad = audit(a, ok);
      if (bad.length) {
        onStatus && onStatus("Checking the numbers again…");
        const note = "Your last answer used numbers that are not in the data (" + [...new Set(bad.flatMap((x) => x.b))].join(", ") + "). Use only numbers written above.";
        const again = clean(await sample.json(prompt(data, note), { modelTier: "default", cache: { ...CACHE, refresh: true } }));
        if (again) { a = again; bad = audit(a, ok); }
      }
      let dropped = 0;
      bad.forEach(({ o, k }) => { o[k] = ""; dropped++; });
      a.right = a.right.filter(Boolean);
      a.real.products = a.real.products.filter((p) => p.line);
      a.feel = a.feel.filter((f) => f.line);
      return { status: "ok", analysis: a, dropped };
    } catch (err) {
      return { status: (err && err.code) || "upstream_error" };
    }
  }

  window.PDAnalysis = { analyze, dataBlock, allowed, badTokens };
})();

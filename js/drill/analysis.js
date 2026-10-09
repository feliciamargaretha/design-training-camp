// Palette Drill: Claude's analysis. Claude gets the measurements already
// turned into words (color names, how light, how vivid, how much of the
// screen) and writes what they mean, never the numbers themselves. An answer
// with numbers, percentages, ratios or hex codes in it is asked for again
// once, then the lines that still have them are dropped.
(function () {
  const CACHE = { gcTime: 86400000 };
  const VERSION = 2;

  async function getSample() {
    try { return window.claude && window.claude.use ? await window.claude.use("sample") : null; } catch (_) { return null; }
  }

  const N = (hex) => window.PDColor.name(hex);
  const light = (L) => (L > 0.9 ? "very light" : L > 0.75 ? "light" : L > 0.55 ? "mid-light" : L > 0.4 ? "mid-dark" : L > 0.25 ? "dark" : "very dark");
  const vivid = (C) => (C < 0.03 ? "neutral, no real color" : C < 0.08 ? "soft" : C < 0.14 ? "medium" : "vivid");
  const amount = (x) => (x >= 60 ? "most of the screen" : x >= 30 ? "a large part of the screen" : x >= 12 ? "a good part of the screen" : x >= 4 ? "a small part of the screen" : x >= 1 ? "a touch" : "tiny specks");
  const avgL = (pal) => { const t = pal.reduce((a, c) => a + c.share, 0) || 1; return pal.reduce((a, c) => a + c.L * c.share, 0) / t; };
  const loudest = (pal, skip) => pal.filter((c) => c.share >= 1 && !(skip && skip(c))).sort((a, b) => b.C - a.C)[0];

  function dataBlock({ brief, feel, why, bases, colors, checks, refs }) {
    const lines = [];
    lines.push("BRIEF: " + brief.what + " " + brief.positioning + " Personality: " + brief.personality + " " + brief.avoid + " Mode: " + brief.mode + ". Screen: " + brief.where);
    lines.push("", "FEEL WORDS the learner chose: " + (feel.length ? feel.join(", ") : "none written"));
    lines.push("THE LEARNER'S OWN EXPLANATION of how these words shape the colors: " + (why ? '"' + why.replace(/\s+/g, " ") + '"' : "none written"));
    lines.push("", "PALETTE the learner picked (their own tags; \"color\" means untagged):");
    bases.forEach((b) => lines.push("- " + b.label + " (" + b.kind + "): " + N(b.hex) + "; " + light(b.L) + ", " + vivid(b.C)));
    lines.push("", "THE LEARNER'S SCREEN, each color used, largest first:");
    colors.forEach((c) => lines.push("- " + c.label + " (" + N(c.hex) + "; " + light(c.L) + ", " + vivid(c.C) + "): covers " + amount(c.share) + "; used for " + c.roles.join(", ")));
    lines.push("", "MEASURED CHECKS (what each result means):");
    checks.forEach((c) => lines.push("- " + c.name + ": " + (c.result === "clear" ? "Clear" : c.result === "look" ? "Look again" : "Not run") + ". " + (c.meaning || "")));
    const mine = loudest(colors, (c) => c.kind === "status");
    const myL = avgL(colors);
    lines.push("", "REAL PRODUCTS (each read from one screenshot's pixels, so photos and illustrations count; what each color is used for isn't known):");
    refs.forEach((p) => {
      const who = p.name + (p.role === "product" ? " (the product this brief is written from)" : "");
      if (!p.found) { lines.push("- " + who + ": no screen available."); return; }
      lines.push("- " + who + ": " + window.PDRefs.describe(p.palette));
      lines.push("  Its colors, largest first: " + p.palette.filter((c) => c.share >= 0.5).slice(0, 6).map((c) => N(c.hex) + " (" + amount(c.share) + ")").join(", ") + ".");
      const theirs = loudest(p.palette.map((c) => ({ ...c, ...window.PDColor.hexToOklch(c.hex) })), (c) => /white|gray|black/.test(N(c.hex)));
      const pl = avgL(p.palette.map((c) => ({ ...c, ...window.PDColor.hexToOklch(c.hex) })));
      const cmp = [];
      cmp.push("overall their screen is " + (Math.abs(pl - myL) < 0.08 ? "about as light as the learner's" : pl > myL ? "lighter than the learner's" : "darker than the learner's"));
      if (theirs && mine) {
        cmp.push("their loudest color, " + N(theirs.hex) + ", is " + (Math.abs(theirs.C - mine.C) < 0.03 ? "about as vivid as" : theirs.C > mine.C ? "more vivid than" : "softer than") + " the learner's loudest, " + N(mine.hex) +
          ", and covers " + (Math.abs(theirs.share - mine.share) < 2 ? "about the same amount of the screen" : theirs.share > mine.share ? "more of the screen" : "less of the screen"));
      }
      lines.push("  Compared with the learner: " + cmp.join("; ") + ".");
    });
    return lines.join("\n");
  }

  const SHAPE = '{"real":{"products":[{"name":"","line":""}],"shared":"","split":""},"right":[""],"harmony":{"verdict":"harmonious|not yet","why":"","color":"","change":""},"feel":[{"word":"","verdict":"held|broke","line":""}],"next":""}';

  function prompt(data, note) {
    return [
      "You are a senior brand and UI designer coaching a learner in a 20-minute color palette drill. You cannot see any screen.",
      "The page measured everything and turned it into words below. Your job is to say what it MEANS for how the screen looks and feels, the way you'd explain it to a junior designer at their desk.",
      "NEVER write numbers, percentages, ratios, degrees, hex codes or lightness/chroma/hue values. Name colors in words (\"deep forest green\", \"bright lime\").",
      "Bad: \"Lightness runs from L 0.20 to 0.29; the most saturated color is #9fe572, covering 1.1%.\"",
      "Good: \"Everything sits in a narrow band of darks, so the only thing that pops is one small bright lime, which makes it feel like a signal light.\"",
      "Only say what the data supports. Stick to what each finding means and why it matters.",
      "",
      data,
      "",
      "Write five parts, short and specific:",
      "1. real: for each real product with a screen, one line on what it did with color and what that achieves: light or dark, what the base is, what carries the brand, how much the loud color is used and what that does. Then 'shared': what they have in common; 'split': where they differ. If a product has no screen, line: \"No screen to measure.\"",
      "2. right: up to 3 things the learner got right, each saying what the choice achieves.",
      "3. harmony: verdict \"harmonious\" or \"not yet\" with one line why. If not yet, name the ONE color to change in 'color' and in 'change' say how in words (lighter or darker, softer or more vivid, warmer or cooler) and what that would fix.",
      "4. feel: one line per feel word saying whether the palette held or broke it, judged against the learner's own explanation where it covers that word.",
      "5. next: one line, the one thing to practice next.",
      note || "",
      "Reply with only JSON: " + SHAPE,
    ].join("\n");
  }

  // Numbers that shouldn't be in the answer. Plain counts and names like
  // "Neutral 50" or "version 2" are fine.
  const FORBIDDEN = /#[0-9a-f]{3,8}\b|\d+\.\d+|\d+\s?%|\d+\s?:\s?1\b|\d+\s?°|\b[LCH]\s?\d/gi;
  function badTokens(text) { return text.match(FORBIDDEN) || []; }

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

  function audit(a) {
    const bad = [];
    strings(a).forEach(([o, k]) => { const b = badTokens(String(o[k] || "")); if (b.length) bad.push({ o, k, b }); });
    return bad;
  }

  async function analyze(input, onStatus) {
    const sample = await getSample();
    if (!sample) return { status: "unavailable" };
    const data = dataBlock(input);
    try {
      onStatus && onStatus("Claude is reading your palette…");
      let a = clean(await sample.json(prompt(data), { modelTier: "default", cache: CACHE, onText: () => onStatus && onStatus("Writing the analysis…") }));
      if (!a) throw { code: "invalid_json" };
      let bad = audit(a);
      if (bad.length) {
        onStatus && onStatus("Rewriting without numbers…");
        const note = "Your last answer still had numbers or codes in it (" + [...new Set(bad.flatMap((x) => x.b))].join(", ") + "). Rewrite it with none: say what they mean instead.";
        const again = clean(await sample.json(prompt(data, note), { modelTier: "default", cache: { ...CACHE, refresh: true } }));
        if (again) { a = again; bad = audit(a); }
      }
      let dropped = 0;
      bad.forEach(({ o, k }) => { o[k] = ""; dropped++; });
      a.right = a.right.filter(Boolean);
      a.real.products = a.real.products.filter((p) => p.line);
      a.feel = a.feel.filter((f) => f.line);
      return { status: "ok", analysis: a, dropped, v: VERSION };
    } catch (err) {
      return { status: (err && err.code) || "upstream_error" };
    }
  }

  window.PDAnalysis = { analyze, dataBlock, badTokens, VERSION };
})();

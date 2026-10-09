// Palette Drill: measures the colored screen and runs the eight checks.
// Every number shown on the page comes from here, already formatted, so the
// table, the checks and Claude's analysis all quote the same strings.
(function () {
  const C = window.PDColor;
  const ROLES = window.PDTemplates.ROLES;

  // Thresholds. Contrast is WCAG 2 AA; the rest are starting values.
  const T = {
    text: 4.5, control: 3, surfaceMin: 0.02, surfaceMax: 0.10, lead: 0.04, accentShare: 10,
    sameL: 0.04, diffL: 0.15, sameC: 0.02, diffC: 0.08, sameH: 10, diffH: 40, hueMinC: 0.04,
    statusL: 0.06, statusH: 40, restraint: 12,
  };
  const INK = { text: 0.3, icon: 0.25 };

  const f = {
    L: (x) => x.toFixed(2),
    C: (x) => x.toFixed(3),
    H: (x) => Math.round(x) + "°",
    ratio: (x) => x.toFixed(2) + ":1",
    share: (x) => (x < 10 ? x.toFixed(1) : String(Math.round(x))) + "%",
    d: (x) => x.toFixed(2),
    dC: (x) => x.toFixed(3),
  };

  function kindOf(el) {
    const def = ROLES[el.dataset.r];
    return def ? def.kind : "fill";
  }

  // The nearest colored fill behind an element.
  function backdrop(el, root) {
    let p = el.parentElement;
    while (p && p !== root.parentElement) {
      if (p.dataset && p.dataset.r && kindOf(p) === "fill") return p;
      p = p.parentElement;
    }
    return root;
  }

  // colorOf(el) -> { key, hex, scaleId, stop } for the element's assigned stop.
  function measure(root, colorOf, scales) {
    const scaleBy = Object.fromEntries(scales.map((s) => [s.id, s]));
    const rootRect = root.getBoundingClientRect();
    const k = rootRect.width / root.offsetWidth || 1;
    const els = [root, ...root.querySelectorAll("[data-r]")].filter((el) => el.getClientRects().length);
    const area = new Map();
    const rectArea = (el) => { const r = el.getBoundingClientRect(); return (r.width * r.height) / (k * k); };
    const lineArea = (el) => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      const w = r.width / k, h = r.height / k;
      return w * (parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)) + h * (parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth));
    };
    // What each element covers, and what it takes from the fill behind it.
    els.forEach((el) => {
      const kind = kindOf(el);
      const own = kind === "fill" ? rectArea(el) : kind === "line" ? lineArea(el) : rectArea(el) * (INK[kind] || 0.3);
      area.set(el, (area.get(el) || 0) + own);
      if (el !== root) {
        const back = backdrop(el, root);
        area.set(back, (area.get(back) || 0) - (kind === "fill" ? rectArea(el) : own));
      }
    });
    const total = rootRect.width * rootRect.height / (k * k);

    // Colors and their share of the screen.
    const colors = new Map();
    els.forEach((el) => {
      const c = colorOf(el);
      if (!c) return;
      const a = Math.max(0, area.get(el) || 0);
      const entry = colors.get(c.key) || { ...c, area: 0, ...C.hexToOklch(c.hex) };
      entry.area += a;
      colors.set(c.key, entry);
    });
    const list = [...colors.values()].map((c) => {
      const s = scaleBy[c.scaleId];
      const share = (100 * c.area) / total;
      return { ...c, scale: s ? s.label : c.scaleId, kind: s ? s.kind : "neutral", share, fmt: { L: f.L(c.L), C: f.C(c.C), H: c.C < 0.002 ? "—" : f.H(c.H), share: f.share(share) } };
    }).sort((a, b) => b.share - a.share);

    // Pairs for contrast.
    const textPairs = [], controlPairs = [];
    els.forEach((el) => {
      if (el === root) return;
      const def = ROLES[el.dataset.r];
      const fg = colorOf(el);
      const back = backdrop(el, root);
      const bg = colorOf(back);
      if (!def || !fg || !bg) return;
      if (def.kind === "text") textPairs.push({ el, role: el.dataset.r, fg, bg, ratio: C.contrast(fg.hex, bg.hex) });
      if (def.control) {
        const behind = def.kind === "fill" ? colorOf(backdrop(el, root)) : bg;
        controlPairs.push({ el, role: el.dataset.r, fg, bg: behind, ratio: C.contrast(fg.hex, behind.hex) });
      }
    });

    const roleColor = (role) => {
      const hits = list.filter((c) => els.some((el) => el.dataset.r === role && colorOf(el) && colorOf(el).key === c.key));
      return hits.sort((a, b) => b.area - a.area)[0];
    };

    return { colors: list, textPairs, controlPairs, roleColor, scales };
  }

  const verdict = (ok) => (ok ? "clear" : "look");
  const nm = (hex) => C.name(hex);
  const nameOf = (c) => c.scale + " " + c.stop;

  function run(m, bases, roleLabel) {
    const checks = [];
    const worst = (pairs) => pairs.slice().sort((a, b) => a.ratio - b.ratio)[0];

    const t = worst(m.textPairs);
    checks.push(t ? {
      id: "text", name: "Text contrast", rule: "Every text color on its background is at least 4.5:1.",
      result: verdict(t.ratio >= T.text), value: f.ratio(t.ratio),
      detail: "Lowest: " + roleLabel(t.role) + " (" + t.fg.label + ") on " + t.bg.label + " · " + f.ratio(t.ratio) + ".",
      meaning: t.ratio >= T.text ? "All text is easy to read on its background."
        : roleLabel(t.role) + " (" + nm(t.fg.hex) + " on " + nm(t.bg.hex) + ") is too faint to read comfortably.",
    } : { id: "text", name: "Text contrast", result: "skip", detail: "No text on the screen." });

    const c = worst(m.controlPairs);
    checks.push(c ? {
      id: "control", name: "Control contrast", rule: "Buttons, input borders and icons are at least 3:1 against what's behind them.",
      result: verdict(c.ratio >= T.control), value: f.ratio(c.ratio),
      detail: "Lowest: " + roleLabel(c.role) + " (" + c.fg.label + ") on " + c.bg.label + " · " + f.ratio(c.ratio) + ".",
      meaning: c.ratio >= T.control ? "Buttons, input borders and icons stand out enough to find and use."
        : roleLabel(c.role) + " (" + nm(c.fg.hex) + " on " + nm(c.bg.hex) + ") nearly disappears, so people may miss it.",
    } : { id: "control", name: "Control contrast", result: "skip", detail: "No controls on the screen." });

    const bg = m.roleColor("bg"), card = m.roleColor("surface");
    if (bg && card) {
      const d = Math.abs(bg.L - card.L);
      checks.push({
        id: "surface", name: "Surface step", rule: "Background and card differ by 0.02–0.10 in lightness.",
        result: verdict(d >= T.surfaceMin - 1e-9 && d <= T.surfaceMax + 1e-9), value: f.d(d),
        detail: "Background " + nameOf(bg) + " (L " + bg.fmt.L + ") vs card " + nameOf(card) + " (L " + card.fmt.L + "): " + f.d(d) + (d < T.surfaceMin ? ", too close to see." : d > T.surfaceMax ? ", a hard jump." : "."),
        meaning: d < T.surfaceMin - 1e-9 ? "Cards and background are almost the same, so cards barely separate from the page."
          : d > T.surfaceMax + 1e-9 ? "Cards jump hard off the background, which makes the screen feel heavy and boxy."
          : "Cards sit a gentle step off the background: clearly separate, but calm.",
      });
    }

    // Saturation lead, per scale; status scales aside.
    const nonStatus = m.colors.filter((x) => x.kind !== "status" && x.share > 0);
    const byScale = {};
    nonStatus.forEach((x) => { if (!byScale[x.scaleId] || x.C > byScale[x.scaleId].C) byScale[x.scaleId] = x; });
    const tops = Object.values(byScale).sort((a, b) => b.C - a.C);
    const lead = tops[0];
    if (lead) {
      const next = tops[1];
      const gap = lead.C - (next ? next.C : 0);
      checks.push({
        id: "lead", name: "Saturation lead", rule: "One color is clearly the most saturated: 0.04 chroma above the next (status colors aside).",
        result: verdict(gap >= T.lead - 1e-9), value: f.dC(gap),
        detail: nameOf(lead) + " leads at C " + lead.fmt.C + (next ? "; next is " + nameOf(next) + " at C " + next.fmt.C + ", a gap of " + f.dC(gap) + "." : "; nothing else is saturated."),
        meaning: lead.C < 0.04 ? "Nothing on the screen is really colorful yet, so no color leads the eye."
          : gap >= T.lead - 1e-9 ? "Your " + nm(lead.hex) + " is clearly the loudest color, so the eye knows where to go."
          : "Your " + nm(lead.hex) + " and " + nm(next.hex) + " are almost equally loud, so they compete for attention.",
      });
      checks.push({
        id: "accent", name: "Accent share", rule: "The most saturated color covers 10% of the screen or less.",
        result: verdict(lead.share <= T.accentShare + 1e-9), value: lead.fmt.share,
        detail: nameOf(lead) + " covers " + lead.fmt.share + " of the screen.",
        meaning: lead.C < 0.04 ? "There's no loud color to measure yet."
          : lead.share <= T.accentShare + 1e-9 ? "Your loudest color, " + nm(lead.hex) + ", is used sparingly, so it stays special."
          : "Your loudest color, " + nm(lead.hex) + ", covers a lot of the screen, so it stops feeling like an accent and starts to tire the eye.",
      });
    }

    // Same or decisively different, per dimension, for non-neutral base pairs.
    const chroma = bases.filter((b) => b.kind !== "neutral");
    const muddy = [], pairs = [], muddyWords = [];
    for (let i = 0; i < chroma.length; i++) for (let j = i + 1; j < chroma.length; j++) {
      const a = chroma[i], b = chroma[j];
      const dL = Math.abs(a.L - b.L), dC = Math.abs(a.C - b.C);
      const hue = a.C >= T.hueMinC && b.C >= T.hueMinC;
      const dH = hue ? C.hueDiff(a.H, b.H) : null;
      const cls = (v, s, d) => (v <= s + 1e-9 ? "same" : v >= d - 1e-9 ? "different" : "in between");
      const r = { an: nm(a.hex), bn: nm(b.hex), a: a.label, b: b.label, L: cls(dL, T.sameL, T.diffL), C: cls(dC, T.sameC, T.diffC), H: hue ? cls(dH, T.sameH, T.diffH) : "skipped", dL: f.d(dL), dC: f.dC(dC), dH: hue ? f.H(dH) : "—" };
      pairs.push(r);
      ["L", "C", "H"].forEach((dim) => { if (r[dim] === "in between") { muddy.push(r.a + " / " + r.b + " " + dim + " " + (dim === "L" ? r.dL : dim === "C" ? r.dC : r.dH)); muddyWords.push(r.a + " (" + r.an + ") and " + r.b + " (" + r.bn + ") are close in " + ({ L: "lightness", C: "saturation", H: "hue" })[dim] + " but not the same"); } });
    }
    if (pairs.length) checks.push({
      id: "same", name: "Same or decisively different", rule: "For each pair of non-neutral base colors, lightness, chroma and hue are either the same or clearly different.",
      result: verdict(!muddy.length), value: muddy.length ? muddy.length + " in between" : "all decisive", pairs,
      detail: muddy.length ? "In between: " + muddy.join("; ") + "." : "Every pair is decisively same or different on each dimension.",
      meaning: muddy.length ? muddyWords.join("; ") + ". Near-misses like this read as accidents rather than choices; make them match or push them clearly apart."
        : "Your colors are either clearly related or clearly different, so the palette looks intentional.",
    });

    const statuses = bases.filter((b) => b.kind === "status");
    if (statuses.length >= 2) {
      const bad = [];
      let maxL = 0, minH = 360;
      for (let i = 0; i < statuses.length; i++) for (let j = i + 1; j < statuses.length; j++) {
        const dL = Math.abs(statuses[i].L - statuses[j].L), dH = C.hueDiff(statuses[i].H, statuses[j].H);
        maxL = Math.max(maxL, dL); minH = Math.min(minH, dH);
        if (dL > T.statusL + 1e-9 || dH < T.statusH - 1e-9) bad.push(statuses[i].label + " / " + statuses[j].label);
      }
      checks.push({
        id: "status", name: "Status tier", rule: "Status colors sit within 0.06 lightness of each other and at least 40° of hue apart.",
        result: verdict(!bad.length), value: "ΔL " + f.d(maxL) + " · ΔH " + f.H(minH),
        detail: "Lightness apart " + f.d(maxL) + ", hue apart " + f.H(minH) + ".",
        meaning: !bad.length ? "Your status colors feel like one set: the same weight, with hues far enough apart to tell them apart."
          : "Your status colors don't feel like one set: some are heavier than others, or too close in hue to tell apart at a glance.",
      });
    }

    const stops = m.colors.filter((x) => x.share > 0).length;
    checks.push({
      id: "restraint", name: "Restraint", rule: "The screen uses 12 distinct stops or fewer.",
      result: verdict(stops <= T.restraint), value: String(stops),
      detail: stops + " distinct stops on the screen.",
      meaning: stops <= T.restraint ? "You kept to a small set of shades, so the screen feels controlled."
        : "So many shades are in play that the screen starts to feel uncontrolled.",
    });

    return checks;
  }

  window.PDChecks = { measure, run, fmt: f, T };
})();

// Palette Drill: one real screen per product from the viewer's Mobbin
// connector, and its palette read from the screenshot's pixels. Pixel
// palettes include photos and illustrations, and hex values are approximate.
(function () {
  const SERVER = "Mobbin";
  const HINT = {
    "mobile-list": "home screen", "mobile-detail": "detail screen", "mobile-form": "form screen", "mobile-onboarding": "welcome onboarding screen",
    "desktop-table": "list view", "desktop-dashboard": "dashboard", "landing-hero": "homepage", pricing: "pricing page",
  };
  const C = window.PDColor;

  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const matches = (app, name) => { const a = norm(app), n = norm(name); return a === n || a.startsWith(n) || n.startsWith(a); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function getMcp() {
    try { return window.claude && window.claude.use ? await window.claude.use("mcp") : null; } catch (_) { return null; }
  }

  async function call(mcp, tool, input) {
    const opts = { cache: { staleTime: 86400000, gcTime: 7 * 86400000 } };
    try {
      return await mcp.callTool(SERVER, tool, input, opts);
    } catch (err) {
      if (!err || !err.retryable) throw err;
      await wait((err.retryAfterMs || 1500) + Math.random() * 1000);
      return mcp.callTool(SERVER, tool, input, opts);
    }
  }
  const base = { image_format: "jpg", output_destination: "code", task_intent: "Compare a learner's palette with real products in a color practice drill." };

  // First screen that belongs to the named app, as a data URL. Looks in
  // several places: the brief's kind of screen, the app's home screen, the
  // other platform, then the product's marketing site.
  async function screenFor(mcp, name, template, platform) {
    const other = platform === "ios" ? "web" : "ios";
    // Mobbin's quick search can come back empty for "<app> home screen" while
    // the plain app name or a deep search finds it, so try several.
    const site = template === "landing-hero" || template === "pricing";
    const tries = [
      site ? ["search_sections", { query: name + (template === "pricing" ? " pricing plans" : " homepage hero"), limit: 10 }] : null,
      ["search_screens", { query: name + " " + HINT[template], platform, mode: "deep", limit: 10 }],
      ["search_screens", { query: name, platform, mode: "standard", limit: 10 }],
      ["search_screens", { query: name, platform: other, mode: "standard", limit: 10 }],
      site ? null : ["search_sections", { query: name + " homepage hero", limit: 10 }],
    ].filter(Boolean);
    for (const [tool, input] of tries) {
      let res;
      try { res = await call(mcp, tool, { ...base, ...input }); }
      catch (err) { if (err && err.code === "tool_error") continue; throw err; }
      const payload = res.payload || {};
      const images = (res.content || []).filter((b) => b.type === "image");
      const list = payload.screens || payload.sections || [];
      const i = list.findIndex((s, n) => images[n] && matches(s.app_name || s.site_name, name));
      if (i >= 0) return { appName: list[i].app_name || list[i].site_name, url: list[i].mobbin_url, platform: tool === "search_sections" ? "web" : input.platform, image: "data:" + images[i].mimeType + ";base64," + images[i].data };
    }
    return null;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // Palette from pixels: bucket in OKLab, merge near buckets, keep the main ones.
  async function readPalette(src, platform) {
    const img = await loadImage(src);
    // Mobbin adds a dark "curated by" strip at the bottom; leave it out.
    const crop = platform === "web" ? 0.1 : 0.06;
    const w = Math.min(220, img.naturalWidth);
    const h = Math.round((img.naturalHeight * (1 - crop) * w) / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight * (1 - crop), 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const k = (data[i] >> 3) + "," + (data[i + 1] >> 3) + "," + (data[i + 2] >> 3);
      const b = buckets.get(k) || { n: 0, r: 0, g: 0, b: 0 };
      b.n++; b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2];
      buckets.set(k, b);
    }
    const total = w * h;
    const lab = (b) => {
      const o = C.hexToOklch(toHex(b));
      const hr = (o.H * Math.PI) / 180;
      return [o.L, o.C * Math.cos(hr), o.C * Math.sin(hr)];
    };
    const toHex = (b) => "#" + [b.r / b.n, b.g / b.n, b.b / b.n].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
    const clusters = [];
    [...buckets.values()].sort((a, b) => b.n - a.n).forEach((b) => {
      const p = lab(b);
      const near = clusters.find((c) => Math.hypot(c.p[0] - p[0], c.p[1] - p[1], c.p[2] - p[2]) < 0.07);
      if (near) { near.n += b.n; near.r += b.r; near.g += b.g; near.b += b.b; }
      else clusters.push({ p, n: b.n, r: b.r, g: b.g, b: b.b });
    });
    return clusters
      .map((c) => { const hex = toHex(c); const o = C.hexToOklch(hex); return { hex, L: o.L, C: o.C, H: o.H, share: (100 * c.n) / total }; })
      .filter((c) => c.share >= 0.5)
      .sort((a, b) => b.share - a.share)
      .slice(0, 8);
  }

  // Lightness range, who owns saturation, and how much of the screen it takes.
  function summarize(palette) {
    const f = window.PDChecks.fmt;
    const big = palette.filter((c) => c.share >= 2);
    const Ls = (big.length ? big : palette).map((c) => c.L);
    // Ignore specks like a logo in a list row: the owner must cover at least 1%.
    const owner = (palette.some((c) => c.share >= 1) ? palette.filter((c) => c.share >= 1) : palette).slice().sort((a, b) => b.C - a.C)[0];
    return {
      lightMin: f.L(Math.min(...Ls)), lightMax: f.L(Math.max(...Ls)),
      owner: owner ? { hex: owner.hex, L: f.L(owner.L), C: f.C(owner.C), H: owner.C < 0.002 ? "—" : f.H(owner.H), share: f.share(owner.share) } : null,
      colors: palette.map((c) => ({ hex: c.hex, L: f.L(c.L), C: f.C(c.C), H: c.C < 0.002 ? "—" : f.H(c.H), share: f.share(c.share) })),
    };
  }

  async function thumb(src) {
    const img = await loadImage(src);
    const w = 260, h = Math.round((img.naturalHeight * w) / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.8);
  }

  // When no live screen comes back: the palette measured from a Mobbin screen
  // when the brief library was written (js/drill/ref-palettes.js).
  function stored(n) {
    const r = (window.PDRefPalettes || {})[n.name] || (window.PDRefPalettes || {})[n.label];
    if (!r) return { name: n.label, role: n.role, found: false };
    const palette = r.palette.map(([hex, share]) => { const o = C.hexToOklch(hex); return { hex, share, L: o.L, C: o.C, H: o.H }; });
    return { name: n.label, role: n.role, found: true, source: "stored", url: r.url, palette, summary: summarize(palette) };
  }

  // { status, products: [{ name, role: "product"|"competitor", found, url, thumb, palette, summary }] }
  async function load(brief, onProgress) {
    const cacheKey = "refs:" + brief.id;
    const saved = await window.PDStore.get(cacheKey);
    if (saved && saved.products && saved.products.some((p) => p.source === "live")) return { status: "ok", products: saved.products };

    const names = [{ name: brief.mobbin, label: brief.product, role: "product" }, ...brief.competitors.map((n) => ({ name: n, label: n, role: "competitor" }))];
    const empty = names.map(stored);
    const mcp = await getMcp();
    if (!mcp) return { status: "unavailable", products: empty };
    const platform = window.PDTemplates.TEMPLATES[brief.template].platform;
    const products = [];
    let error = null;
    for (const n of names) {
      if (onProgress) onProgress(n.label);
      try {
        const s = await screenFor(mcp, n.name, brief.template, platform);
        if (!s) { products.push(stored(n)); continue; }
        const palette = await readPalette(s.image, s.platform);
        products.push({ name: n.label, role: n.role, found: true, source: "live", url: s.url, thumb: await thumb(s.image), palette, summary: summarize(palette) });
      } catch (err) {
        error = (err && err.code) || "upstream_error";
        products.push(stored(n));
        if (["not_granted", "server_not_connected", "needs_reauth", "not_in_manifest", "blocked_by_policy"].includes(error)) {
          return { status: error, products: [...products, ...names.slice(products.length).map(stored)] };
        }
      }
    }
    if (products.some((p) => p.source === "live")) await window.PDStore.set(cacheKey, { products });
    return { status: products.some((p) => p.source === "live") ? "ok" : error || "empty", products };
  }

  // What a palette does, in words: base, supporting colors, the loud one.
  function describe(palette) {
    const pal = palette.filter((c) => c.share >= 0.5).slice().sort((a, b) => b.share - a.share);
    if (!pal.length) return "";
    const amount = (x) => (x >= 60 ? "mostly" : x >= 30 ? "a large share of" : x >= 12 ? "a good portion of" : x >= 4 ? "some" : "a touch of");
    const total = pal.reduce((a, c) => a + c.share, 0);
    const dark = pal.reduce((a, c) => a + c.L * c.share, 0) / total < 0.5;
    // Merge colors with the same name so the sentence doesn't repeat itself.
    const named = [];
    pal.forEach((c) => {
      const n = C.name(c.hex);
      const hit = named.find((x) => x.n === n);
      if (hit) hit.share += c.share; else named.push({ n, share: c.share, C: c.C, hex: c.hex });
    });
    named.sort((a, b) => b.share - a.share);
    const rest = named.slice(1, 4).map((x) => amount(x.share) + " " + x.n);
    // The loud color is a real hue, not a gray or a tinted black.
    const GRAYS = /white|gray|black/;
    const big = named.filter((x) => x.share >= 1 && !GRAYS.test(x.n));
    const loud = (big.length ? big : named.filter((x) => !GRAYS.test(x.n))).slice().sort((a, b) => b.C - a.C)[0];
    let s = (dark ? "A dark screen: " : "A light screen: ") + "mostly " + named[0].n + (rest.length ? ", with " + rest.join(", ").replace(/, ([^,]*)$/, " and $1") : "") + ".";
    if (loud && loud.C >= 0.06 && loud !== named[0]) {
      s += " The loudest color is " + loud.n + (loud.share < 5 ? ", kept small." : loud.share < 15 ? ", used in a few places." : ", used generously.");
    } else if (loud && loud.C >= 0.06) {
      s += " The main color is also the loudest.";
    } else {
      s += " Almost no saturated color at all.";
    }
    return s;
  }

  window.PDRefs = { load, readPalette, summarize, describe };
})();

// Palette Drill: color maths. OKLCH conversions, the ten-stop scales and
// WCAG 2 contrast. Nothing here touches the page.
(function () {
  const STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
  // One lightness ladder for every scale, so stop 500 of any scale has the
  // same lightness as stop 500 of any other.
  const LADDER = [0.97, 0.93, 0.87, 0.78, 0.68, 0.58, 0.49, 0.40, 0.31, 0.22];

  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

  function parseHex(hex) {
    const m = String(hex || "").trim().replace(/^#/, "").match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  }

  function toHex(rgb) {
    return "#" + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0")).join("");
  }

  function rgbToOklab([r, g, b]) {
    r = toLinear(r); g = toLinear(g); b = toLinear(b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    ];
  }

  // Linear (not gamma) RGB, may fall outside 0..1.
  function oklabToLinear([L, a, b]) {
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    const s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ];
  }

  function hexToOklch(hex) {
    const rgb = parseHex(hex);
    if (!rgb) return null;
    const [L, a, b] = rgbToOklab(rgb);
    const C = Math.sqrt(a * a + b * b);
    let H = (Math.atan2(b, a) * 180) / Math.PI;
    if (H < 0) H += 360;
    return { L, C, H: C < 0.002 ? 0 : H };
  }

  const inGamut = (lin) => lin.every((c) => c >= -0.0001 && c <= 1.0001);

  function oklchLinear(L, C, H) {
    const h = (H * Math.PI) / 180;
    return oklabToLinear([L, C * Math.cos(h), C * Math.sin(h)]);
  }

  // Keeps lightness and hue; lowers chroma until the color fits on screen.
  function oklchToHex(L, C, H) {
    let lin = oklchLinear(L, C, H);
    if (!inGamut(lin)) {
      let lo = 0, hi = C;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (inGamut(oklchLinear(L, mid, H))) lo = mid; else hi = mid;
      }
      lin = oklchLinear(L, lo, H);
    }
    return toHex(lin.map((c) => toGamma(Math.min(1, Math.max(0, c)))));
  }

  // Ten stops on the shared ladder. Hue holds; chroma is the base's at the
  // base's lightness and tapers toward both ends. The exact base hex replaces
  // the stop nearest to it.
  function scale(baseHex) {
    const base = hexToOklch(baseHex);
    if (!base) return null;
    let baseIndex = 0;
    LADDER.forEach((L, i) => {
      if (Math.abs(L - base.L) < Math.abs(LADDER[baseIndex] - base.L)) baseIndex = i;
    });
    const stops = LADDER.map((L, i) => {
      if (i === baseIndex) {
        return { stop: STOPS[i], hex: normHex(baseHex), base: true, offset: base.L - L, ...base };
      }
      const edge = L > base.L ? 1.0 : 0.12;
      const t = Math.min(1, Math.abs(L - base.L) / Math.max(0.05, Math.abs(edge - base.L)));
      const C = base.C * Math.max(0.12, 1 - t * t);
      const hex = oklchToHex(L, C, base.H);
      return { stop: STOPS[i], hex, base: false, ...hexToOklch(hex) };
    });
    return { base: { hex: normHex(baseHex), ...base }, baseIndex, stops };
  }

  function normHex(hex) {
    const rgb = parseHex(hex);
    return rgb ? toHex(rgb) : null;
  }

  function luminance(hex) {
    const [r, g, b] = parseHex(hex).map(toLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrast(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  // A plain gray on the ladder, for the uncolored screen.
  const gray = (i) => oklchToHex(LADDER[i], 0, 0);

  function hueDiff(a, b) {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  // HSL, rounded, for comparing picks the way design tools show them.
  function hexToHsl(hex) {
    const rgb = parseHex(hex);
    if (!rgb) return null;
    const [r, g, b] = rgb;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = Math.round(h * 60); if (h < 0) h += 360;
    return { h: h % 360, s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  window.PDColor = { STOPS, LADDER, parseHex, normHex, hexToOklch, oklchToHex, scale, contrast, gray, hueDiff, hexToHsl };
})();

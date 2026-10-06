// History: every brief so far, newest first. Opening one loads all
// its rounds as they were left.
(function () {
  const $ = (id) => document.getElementById(id);
  const ROUNDS = [
    ["design", "Design"],
    ["study", "Study"],
    ["compare", "Compare"],
    ["redesign", "Redesign"],
    ["review", "Review"],
  ];
  const VERDICTS = { wide: "Wide range", some: "Some range", narrow: "Narrow range" };
  let urls = [];

  async function loadDay(dateKey) {
    const get = (round) => window.DTCStore.get(dateKey + ":" + round);
    const [design, study, analysis, redesign, review] = await Promise.all(
      ["design", "study", "analysis", "redesign", "review"].map(get)
    );
    const date = window.DTC.parseKey(dateKey);
    const challenge = window.DTC.forDate(date);
    const same = (x) => x && x.challengeId === challenge.id;
    const explorations = same(redesign)
      ? (redesign.explorations || []).filter((x) => x.screens && x.screens.length)
      : [];
    const done = {
      design: same(design) && (design.screens || []).length > 0,
      study: same(study) && Object.keys(study).some((k) => k !== "challengeId" && String(study[k] || "").trim()),
      compare: same(analysis) && (analysis.observations || []).length > 0,
      redesign: explorations.length > 0,
      review: same(review) && !!(review.summary || review.range),
    };
    return { dateKey, date, challenge, design: same(design) ? design : null, explorations, review: same(review) ? review : null, done };
  }

  function thumb(blob, label) {
    const fig = document.createElement("figure");
    fig.className = "hist__thumb";
    const img = document.createElement("img");
    const url = URL.createObjectURL(blob);
    urls.push(url);
    img.src = url;
    img.alt = "";
    const cap = document.createElement("figcaption");
    cap.textContent = label;
    fig.append(img, cap);
    return fig;
  }

  function renderDay(day, isToday) {
    const li = document.createElement("li");
    li.className = "hist__day";

    const head = document.createElement("div");
    head.className = "hist__head";
    const date = document.createElement("p");
    date.className = "hist__date";
    // Named, not dated: "Week 3" (or "#006" for the early daily briefs).
    date.textContent = window.DTC.label(day.challenge);
    if (isToday) {
      const now = document.createElement("span");
      now.className = "hist__state hist__state--now";
      now.textContent = "This week";
      date.append(" ", now);
    }
    const current = window.DTC.mode() === "carried" && window.DTC.dateKey() === day.dateKey;
    const started = Object.values(day.done).some(Boolean);
    if (current || !started) {
      const chip = document.createElement("span");
      chip.className = "hist__state" + (current ? " hist__state--current" : "");
      chip.textContent = current ? "Your current brief" : "Not started";
      date.append(" ", chip);
    }
    const brief = document.createElement("p");
    brief.className = "hist__brief";
    brief.textContent = day.challenge.brief;
    const meta = document.createElement("div");
    window.DTC.renderMeta(meta, { ...day.challenge, context: "", scope: "" });
    head.append(date, brief, meta);

    // Rounds done
    const progress = document.createElement("ol");
    progress.className = "hist__rounds";
    progress.setAttribute("aria-label", "Rounds");
    ROUNDS.forEach(([key, label]) => {
      const r = document.createElement("li");
      r.className = "hist__round" + (day.done[key] ? " is-done" : "");
      r.textContent = (day.done[key] ? "✓ " : "") + label;
      progress.append(r);
    });

    // Screens: your first design and each exploration
    const thumbs = document.createElement("div");
    thumbs.className = "hist__thumbs";
    if (day.design && day.design.screens && day.design.screens[0]) thumbs.append(thumb(day.design.screens[0].blob, "Original"));
    day.explorations.slice(0, 4).forEach((x, i) =>
      thumbs.append(thumb(x.screens[0].blob, (x.name || "").trim() || "Exploration " + "ABCDEFGHIJ"[i]))
    );

    const side = document.createElement("div");
    side.className = "hist__side";
    if (day.review && day.review.summary && day.review.summary.strongest) {
      const t = document.createElement("p");
      t.className = "hist__takeaway";
      t.innerHTML = "<span>Strongest</span> ";
      t.append(day.review.summary.strongest);
      side.append(t);
    }
    if (day.review && day.review.range && VERDICTS[day.review.range.verdict]) {
      const v = document.createElement("span");
      v.className = "range__verdict range__verdict--" + day.review.range.verdict;
      v.textContent = VERDICTS[day.review.range.verdict];
      side.append(v);
    }
    if (day.review && day.review.summary && day.review.summary.next) {
      const n = document.createElement("p");
      n.className = "hist__next";
      n.textContent = "Practice next: " + day.review.summary.next;
      side.append(n);
    }

    // Open: the review if it's done, otherwise the first unfinished round.
    const next = ROUNDS.find(([key]) => !day.done[key]);
    const open = document.createElement("button");
    open.type = "button";
    open.className = "btn btn--sm";
    open.textContent = day.done.review ? "Open review" : !started ? "Start this brief" : next ? "Continue at " + next[1] : "Open";
    if (!started) open.className = "btn btn--sm btn--ghost";
    open.addEventListener("click", () => {
      const hash = "#" + (day.done.review ? "review" : next ? next[0] : "review");
      const shownNow = window.DTC.dateKey() === day.dateKey;
      if (shownNow) {
        location.hash = hash;
      } else if (!window.DTC.openDay(day.dateKey, hash)) {
        open.textContent = "Can't open past days in this browser";
        open.disabled = true;
      }
    });
    side.append(open);

    const body = document.createElement("div");
    body.className = "hist__body";
    body.append(thumbs, side);

    li.append(head, progress, body);
    if (!started) li.classList.add("hist__day--empty");
    return li;
  }

  async function render() {
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [];
    // Every brief so far, started or not, newest first.
    const keys = await window.DTCStore.keys();
    const todayKey = window.DTC.dateKey(new Date());
    const dates = [...new Set([
      ...window.DTC.allKeys(),
      ...keys.map((k) => k.split(":")[0]).filter((d) => window.DTC.parseKey(d) && d <= todayKey),
    ])].sort().reverse();
    const days = await Promise.all(dates.map(loadDay));
    days.forEach((d) => { if (d.done.review) window.DTC.markDone(d.dateKey); });
    const practised = days.filter((d) => Object.values(d.done).some(Boolean)).length;

    const list = $("hist-list");
    list.replaceChildren(...days.map((d) => renderDay(d, d.dateKey === todayKey)));
    $("hist-empty").hidden = days.length > 0;
    $("hist-count").textContent = practised + (practised === 1 ? " day practised" : " days practised");
  }

  window.DTCPages.on("history", render);
})();

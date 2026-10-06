// Says which brief is on screen when it isn't this week's, with a way back to it.
// Also, once: picks up a brief started on an earlier day and not finished.
(function () {
  const DTC = window.DTC;
  const mode = DTC.mode();
  const challenge = DTC.today();
  const num = (c) => DTC.label(c);

  if (mode !== "today") {
    const todays = DTC.forDate(new Date());
    const bar = document.createElement("div");
    bar.className = "day-banner";
    bar.setAttribute("role", "status");
    const text = document.createElement("p");
    text.textContent = mode === "carried"
      ? "You're still on " + num(challenge) + " · " + challenge.name + ". It stays until you finish its Review."
      : "You're looking at " + num(challenge) + " · " + challenge.name;
    const links = document.createElement("div");
    links.className = "day-banner__links";
    const history = document.createElement("a");
    history.href = "#history";
    history.textContent = "History";
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = mode === "carried" ? "Switch to this week's brief (" + num(todays) + ")" : "Back to this week";
    back.addEventListener("click", () => DTC.useToday(""));
    links.append(history, back);
    bar.append(text, links);
    document.body.prepend(bar);
    return;
  }

  // One-time: briefs started before pinning existed. Finished days are marked
  // done; the latest unfinished one with a design becomes the current brief.
  const FLAG = "dtc:pin-migrated";
  let migrated = true;
  try { migrated = !!localStorage.getItem(FLAG); localStorage.setItem(FLAG, "1"); } catch (_) {}
  if (migrated || DTC.pinnedRaw()) return;

  (async () => {
    const todayKey = DTC.dateKey(new Date());
    const dates = [...new Set((await window.DTCStore.keys()).map((k) => k.split(":")[0]))]
      .filter((d) => DTC.parseKey(d) && d < todayKey)
      .sort()
      .reverse();
    let carry = null;
    for (const d of dates) {
      const id = DTC.forDate(DTC.parseKey(d)).id;
      const [design, review] = await Promise.all([
        window.DTCStore.get(d + ":design"),
        window.DTCStore.get(d + ":review"),
      ]);
      if (review && review.challengeId === id && review.summary) DTC.markDone(d);
      else if (!carry && design && design.challengeId === id && (design.screens || []).length) carry = d;
    }
    if (carry) {
      DTC.pin(carry);
      location.reload();
    }
  })();
})();

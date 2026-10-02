(function () {
  const challenge = window.DTC.today();
  const status = document.getElementById("brief-status");
  const past = window.DTC.isPast();

  document.getElementById("brief-label").textContent = past ? "This day's brief" : "Today's brief";
  document.getElementById("brief-number").textContent = "#" + String(challenge.id).padStart(3, "0");
  document.getElementById("brief-text").textContent = challenge.brief;
  window.DTC.renderMeta(document.getElementById("brief-meta"), challenge);
  document.getElementById("brief").hidden = false;
  if (past) document.getElementById("start").textContent = "Open this day's challenge";

  // Fetch the Mobbin references in the background so Study opens with them
  // ready. They stay hidden until then.
  const canUseClaude = !!(window.claude && window.claude.use);
  if (canUseClaude) {
    status.textContent = "Getting Mobbin references ready…";
    status.hidden = false;
    window.DTCRefs.load(challenge).then((res) => {
      status.textContent = res.status === "ok"
        ? res.screens.length + (res.screens.length === 1 ? " Mobbin reference" : " Mobbin references") + " ready for Study"
        : res.message;
    });
  }
})();

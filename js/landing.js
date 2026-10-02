(function () {
  const challenge = window.DTC.today();
  const status = document.getElementById("brief-status");

  document.getElementById("brief-name").textContent = challenge.name;
  document.getElementById("brief-link").href = window.DTC.mobbinUrl(challenge);
  document.getElementById("brief").hidden = false;

  // Fetch today's Mobbin references in the background so Study opens with
  // them ready. They stay hidden until then.
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

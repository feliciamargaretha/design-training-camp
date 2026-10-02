(function () {
  const challenge = window.DTC.today();
  const start = document.getElementById("start");
  const status = document.getElementById("brief-status");

  document.getElementById("brief-name").textContent = challenge.name;
  document.getElementById("brief-link").href = window.DTC.mobbinUrl(challenge);
  document.getElementById("brief").hidden = false;

  // Fetch today's Mobbin references now, while this page has the connector,
  // and keep them for the Study round. They stay hidden until then.
  let pending = null;
  const canUseClaude = !!(window.claude && window.claude.use);
  if (canUseClaude) {
    status.textContent = "Getting Mobbin references ready…";
    status.hidden = false;
    pending = window.DTCRefs.load(challenge).then((res) => {
      status.textContent = res.status === "ok"
        ? res.screens.length + (res.screens.length === 1 ? " Mobbin reference" : " Mobbin references") + " ready for Study"
        : res.message;
      pending = null;
      return res;
    });
  }

  start.addEventListener("click", (e) => {
    try {
      sessionStorage.setItem("dtc:challenge", JSON.stringify(challenge));
    } catch (_) { /* storage unavailable; the next page falls back to today() */ }

    // Leaving now would drop an in-flight Mobbin search, so wait for it
    // (up to 30 s) before moving on.
    if (!pending) return;
    e.preventDefault();
    start.textContent = "Getting references ready…";
    start.setAttribute("aria-busy", "true");
    const go = () => (location.href = start.href);
    Promise.race([pending, new Promise((r) => setTimeout(r, 30000))]).then(go, go);
  });
})();

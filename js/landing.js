(function () {
  const challenge = window.DTC.today();

  document.getElementById("brief-name").textContent = challenge.name;
  document.getElementById("brief-link").href = window.DTC.mobbinUrl(challenge);
  document.getElementById("brief").hidden = false;

  document.getElementById("start").addEventListener("click", () => {
    try {
      sessionStorage.setItem("dtc:challenge", JSON.stringify(challenge));
    } catch (_) { /* storage unavailable; the next page falls back to today() */ }
  });
})();

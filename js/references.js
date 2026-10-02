// Reference screens for today's brief, from the viewer's Mobbin connector.
// Only works when the site runs as a claude.ai artifact (that's where the
// connector lives). Everywhere else the page falls back to a Mobbin link.
//
// Every screen has the same shape so Study and Compare don't care where it
// came from: { id, appName, image, url }. `image` is a data: URL, because the
// artifact frame can't load images from mobbin.com.
(function () {
  const SERVER = "Mobbin";
  const TOOL = "search_screens";
  const COUNT = 5;

  const MESSAGES = {
    unavailable: "Mobbin references load from the start page when this site runs inside Claude. Open today's pattern on Mobbin and study 4–5 screens side by side.",
    server_not_connected: "Mobbin isn't connected to your Claude account. Add it in claude.ai Settings → Connectors, then reload.",
    selection_required: "You have more than one Mobbin connector. Choose one when Claude asks, then reload.",
    needs_reauth: "Your Mobbin connection expired. Reconnect Mobbin in claude.ai Settings → Connectors, then reload.",
    not_in_manifest: "This page isn't allowed to use Mobbin. Allow Mobbin for this page when Claude asks, then reload.",
    blocked_by_policy: "Your organization blocks Mobbin searches from pages like this one.",
    approval_required: "Your organization requires approval for each Mobbin search, which this page can't ask for.",
    server_unavailable: "Mobbin didn't answer. Reload in a minute to try again.",
    empty: "Mobbin found no screens for today's brief.",
  };

  function queryFor(challenge) {
    return challenge.brief.replace(/^Design (the |a |an )?/i, "").replace(/\.$/, "");
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function callMobbin(mcp, challenge) {
    const input = {
      query: queryFor(challenge),
      platform: challenge.platform,
      limit: COUNT,
      mode: "deep",
      image_format: "jpg",
      output_destination: "code",
      task_intent: "Show real reference screens for a daily UI design practice challenge.",
    };
    const opts = { cache: { staleTime: 300000, gcTime: 86400000 } };
    try {
      return await mcp.callTool(SERVER, TOOL, input, opts);
    } catch (err) {
      if (!err || !err.retryable) throw err;
      await wait((err.retryAfterMs || 1500) + Math.random() * 1000);
      return mcp.callTool(SERVER, TOOL, input, opts);
    }
  }

  function toScreens(result) {
    const payload = result.payload || {};
    const images = (result.content || []).filter((b) => b.type === "image");
    return (payload.screens || [])
      .map((s, i) => ({
        id: s.id,
        appName: s.app_name || "Unknown app",
        url: s.mobbin_url || "https://mobbin.com",
        image: images[i] ? "data:" + images[i].mimeType + ";base64," + images[i].data : null,
      }))
      .filter((s) => s.image);
  }

  async function load(challenge) {
    const storeKey = window.DTCStore.key("refs");
    const saved = await window.DTCStore.get(storeKey);
    if (saved && saved.challengeId === challenge.id && saved.screens.length) {
      return { status: "ok", screens: saved.screens, notice: saved.notice };
    }

    let mcp = null;
    try {
      mcp = window.claude && window.claude.use ? await window.claude.use("mcp") : null;
    } catch (_) {}
    if (!mcp) return { status: "unavailable", message: MESSAGES.unavailable, screens: [] };

    try {
      const result = await callMobbin(mcp, challenge);
      const screens = toScreens(result);
      if (!screens.length) return { status: "empty", message: MESSAGES.empty, screens: [] };
      const notice = (result.payload && result.payload.ai_usage_notice) || "";
      await window.DTCStore.set(storeKey, { challengeId: challenge.id, screens, notice });
      return { status: "ok", screens, notice };
    } catch (err) {
      const code = (err && err.code) || "upstream_error";
      if (code === "not_granted" || code === "capability_disabled" || code === "capability_removed") {
        return { status: "unavailable", message: MESSAGES.unavailable, screens: [] };
      }
      const message = MESSAGES[code] ||
        (code === "tool_error"
          ? "Mobbin couldn't run the search: " + (err.message || "no details given") + "."
          : "Mobbin references couldn't load (" + code + "). Reload to try again.");
      return { status: code, message, screens: [] };
    }
  }

  window.DTCRefs = { load };
})();

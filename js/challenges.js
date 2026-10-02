// Daily briefs. Each one maps to a Mobbin screen pattern so the Study and
// Compare rounds can pull real-world references for the same problem.
// Mobbin has no public API, so we deep-link into its search instead.
(function () {
  const MOBBIN_SEARCH = "https://mobbin.com/search/apps/";

  const CHALLENGES = [
    { id: 1,  name: "Onboarding",    pattern: "Onboarding",    platform: "ios", brief: "Design the first onboarding screen for a habit-tracking app." },
    { id: 2,  name: "Sign up",       pattern: "Signup",        platform: "ios", brief: "Design a sign-up screen for a mobile banking app." },
    { id: 3,  name: "Paywall",       pattern: "Paywall",       platform: "ios", brief: "Design a paywall for a premium meditation plan." },
    { id: 4,  name: "Empty state",   pattern: "Empty State",   platform: "ios", brief: "Design the empty inbox of a team chat app." },
    { id: 5,  name: "Checkout",      pattern: "Checkout",      platform: "ios", brief: "Design a checkout screen for a food delivery app." },
    { id: 6,  name: "Settings",      pattern: "Settings",      platform: "ios", brief: "Design the notification settings for a news app." },
    { id: 7,  name: "Profile",       pattern: "Profile",       platform: "ios", brief: "Design a user profile for a running community." },
    { id: 8,  name: "Pricing",       pattern: "Pricing",       platform: "web", brief: "Design a pricing page for a design-collaboration tool." },
    { id: 9,  name: "Search",        pattern: "Search",        platform: "ios", brief: "Design the search results screen for a recipe app." },
    { id: 10, name: "Dashboard",     pattern: "Dashboard",     platform: "web", brief: "Design the home dashboard for a personal finance tool." },
    { id: 11, name: "Error",         pattern: "Error",         platform: "ios", brief: "Design a payment-failed screen that keeps the user calm." },
    { id: 12, name: "Notifications", pattern: "Notifications", platform: "ios", brief: "Design the activity feed for a photo-sharing app." },
  ];

  function mobbinUrl(challenge) {
    const params = new URLSearchParams({
      content_type: "screens",
      sort: "publishedAt",
      filter: "screenPatterns." + challenge.pattern,
    });
    return MOBBIN_SEARCH + challenge.platform + "?" + params.toString();
  }

  // Same brief for everyone on a given calendar day.
  function today(date = new Date()) {
    const dayNumber = Math.floor(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
    );
    return CHALLENGES[dayNumber % CHALLENGES.length];
  }

  function dateKey(date = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  // Where this site runs inside Claude (Mobbin and Claude only work there).
  const ARTIFACT_URL = "https://claude.ai/artifact/1hhHv5iohQzNfcs4mwJ9nS";

  window.DTC = { CHALLENGES, mobbinUrl, today, dateKey, ARTIFACT_URL };
})();

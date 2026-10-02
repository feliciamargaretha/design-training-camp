// Daily briefs. Each one maps to a Mobbin screen pattern so the Study and
// Compare rounds can pull real-world references for the same problem.
// Mobbin has no public API, so we deep-link into its search instead.
(function () {
  const MOBBIN_SEARCH = "https://mobbin.com/search/apps/";

  const CHALLENGES = [
    { name: "Onboarding",        pattern: "Onboarding",        platform: "ios", brief: "Welcome a first-time user to a habit-tracking app." },
    { name: "Sign up",           pattern: "Signup",            platform: "ios", brief: "Create an account screen for a banking app." },
    { name: "Paywall",           pattern: "Paywall",           platform: "ios", brief: "Convince someone to upgrade to a premium meditation plan." },
    { name: "Empty state",       pattern: "Empty State",       platform: "ios", brief: "An empty inbox for a team chat app." },
    { name: "Checkout",          pattern: "Checkout",          platform: "web", brief: "Checkout for a small independent coffee roaster." },
    { name: "Settings",          pattern: "Settings",          platform: "ios", brief: "Notification settings for a news app." },
    { name: "Profile",           pattern: "Profile",           platform: "ios", brief: "A user profile for a running community." },
    { name: "Pricing",           pattern: "Pricing",           platform: "web", brief: "A pricing page for a design-collaboration tool." },
    { name: "Search",            pattern: "Search",            platform: "ios", brief: "Search results for a recipe app." },
    { name: "Dashboard",         pattern: "Dashboard",         platform: "web", brief: "A home dashboard for a personal finance tool." },
    { name: "Error",             pattern: "Error",             platform: "ios", brief: "A payment failed screen that keeps the user calm." },
    { name: "Notifications",     pattern: "Notifications",     platform: "ios", brief: "An activity feed for a photo-sharing app." },
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

  window.DTC = { CHALLENGES, mobbinUrl, today };
})();

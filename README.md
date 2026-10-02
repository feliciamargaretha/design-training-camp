# Design Training Camp

A little practice, every day. A static site for training your visual design eye in four rounds:

1. **Design** (no timer). Get the daily brief, design it in Figma and upload a screenshot.
2. **Study** (10 min). Look at real interfaces for the same pattern on Mobbin and take notes.
3. **Compare** (10 min). Put your design next to the references and find your blind spots.
4. **Redesign** (no timer). Upload the improved version.

## Run locally

No build step. Open `index.html` or serve the folder:

```sh
python3 -m http.server 8000
```

## Mobbin

Reference screens come from the Mobbin connector (`search_screens`), so they only
load when the site runs as a claude.ai artifact with Mobbin connected. The start
page fetches today's references and keeps them in the browser for Study and
Compare. Anywhere else, the Study round falls back to a link into Mobbin search
(`mobbinUrl()` in `js/challenges.js`).

Mobbin screenshots are only fetched at runtime and never committed to this repo.

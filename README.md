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

Mobbin has no public API, so each daily brief in `js/challenges.js` maps to a Mobbin
screen pattern and deep-links into Mobbin search (you need to be signed in to Mobbin).
Change the URL format in `mobbinUrl()` if Mobbin changes its links.

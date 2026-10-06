# Design Training Camp

A little practice, every week. A static site for training your visual design eye in five rounds:

1. **Design** (no timer). Get the daily brief, design it in Figma and upload a screenshot.
2. **Study** (10 min). Look at real screens for the same brief from Mobbin and take notes.
3. **Compare** (10 min). Read Claude's 10 observations and mark the ones you'd noticed too.
4. **Redesign** (no timer). Upload one or more explorations, each with its own screens.
5. **Review** (no timer). Check your original design and each exploration against the
   observations, then get a summary: strongest exploration, what improved, what to practice next.

## Weekly briefs

`js/challenges.js` builds one brief per week (Monday to Sunday), named Week 1, Week 2…,
from curated lists. Weeks rotate between a B2B desktop screen, a B2C mobile screen (1–2
screens) and a landing page section (hero, features, pricing, FAQ…), each with an industry,
light or dark mode and a visual style. Landing page sections pull references with Mobbin's
section search; screens use screen search. The first three briefs (2–4 Oct 2026) were daily
and keep their numbers (#005–#007).

A brief you start stays on screen, even into the next week, until you finish its Review.

## History

`#history` lists every brief so far, started or not. Opening an earlier one remembers it for
the browser tab and reloads, so every round shows its work; a banner leads back to this week.

## How it's built

One page (`index.html`) holds every round; the URL hash picks which one shows
(`#design`, `#study`, `#compare`, `#redesign`, `#review`, `#history`). Each round's code lives in `js/`. Your uploads,
notes and today's analysis stay in your browser (IndexedDB), never on a server.

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

## Claude's analysis

The Compare and Review rounds ask Claude (the artifact `sample` capability) to look at the
reference screens and your uploaded design and write 10 observations. Like the
Mobbin references, it only runs inside Claude; it uses your own Claude usage and
is kept for the day so reloading doesn't ask again.

Some Claude accounts and views can't send images to Claude. There, the page reads each
screenshot itself (`js/screen-reader.js`): the text via Tesseract.js OCR, plus positions,
text sizes, colours, contrast, background bands, picture areas, alignment and spacing. Claude
analyzes and reviews that reading instead of the image. Tesseract.js and its English data are
vendored in `vendor/tesseract/` (Apache-2.0) so nothing loads from other sites; the language
data is named `.gz.wasm` because Claude artifacts don't serve `.gz` files (`worker.js` maps the request). If the reader
can't start, Compare falls back to an analysis of the brief and Review lets you fill in the
grid yourself.

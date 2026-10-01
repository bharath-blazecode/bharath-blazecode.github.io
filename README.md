# Barry Sampath | Field Notes

[View the live portfolio](https://bharath-blazecode.github.io/)

[![Barry Sampath Field Notes title card](assets/og-portfolio.jpg)](https://bharath-blazecode.github.io/)

This repository contains the source for my portfolio, a static site built with HTML, CSS and JavaScript.

The website carries the professional story and project detail. This README is for people who want to inspect, run or maintain the code.

## Visit the work

- [ITDR Home Lab](https://bharath-blazecode.github.io/work/homelab/)
- [ClassQuest](https://bharath-blazecode.github.io/work/classquest/)
- [LUNA](https://bharath-blazecode.github.io/work/luna/)

Each case study separates project context, my contribution and the evidence available for inspection.

## Run locally

Node.js 22 or later is required. The source preview, static checks and build use Node's built-in modules, so they do not require an npm install.

| Command | Purpose |
|---|---|
| `npm start` | Serve the source at `http://127.0.0.1:48763` |
| `npm test` | Check routes, links, metadata, assets and factual safeguards |
| `npm run build` | Verify the site and copy public files into `dist/` |
| `npm run preview` | Serve the completed `dist/` build |

Run `npm run build` before `npm run preview`. Stop either server with Ctrl+C.

The browser test requires the development dependencies and Chromium:

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run test:browser
npm run test:classquest
npm run test:mobile
```

The browser suite exercises the homepage, three case studies and 404 page at 320, 390, 820 and 1440px widths. It also checks both themes, reduced-motion behavior, keyboard interaction, the scripted sequences, the terminal and the no-JavaScript path. Axe is included for automated accessibility checks, but an automated pass does not establish WCAG conformance or replace assistive-technology testing.

## Repository map

```text
index.html                  homepage
404.html                    missing-page response
work/homelab/index.html     ITDR Home Lab case study
work/classquest/index.html  ClassQuest case study
work/luna/index.html        LUNA case study
css/site.css                shared responsive, theme and print styles
css/home.css                Focused Field Notes homepage refinements
css/classquest.css          case-local upload-decision field notes
js/theme.js                 early theme restoration
js/site.js                  motion, navigation and terminal enhancements
js/classquest.js            progressive upload-decision controls
assets/                     project media, fonts and social preview
resume/                     Downloadable résumé PDF
tools/                      verification, build and preview scripts
tests/browser.cjs           Playwright browser checks
tests/classquest.cjs         decision states, keyboard, no-JS and print checks
tests/mobile.cjs            alignment, touch-target, wrap, responder and diagram checks
```

The HTML files are the editable source of truth. Shared navigation is repeated across the five pages, so a global navigation change must be applied to each one. `npm test` catches broken local links and fragments.

## Design and accessibility behavior

The primary content and navigation use ordinary HTML. The homepage interests line is immediately visible; project names lead their cards, with personal outcomes and editorial phrases underneath. JavaScript progressively adds the theme control, decorative sequences and terminal interaction.

Day and night themes follow the operating-system preference until the visitor makes a local choice. Most decorative sequences settle within five seconds. On wider screens, the telemetry flow repeats while visible, and the diagram itself can pause or resume it. All motion stops when the page is hidden; an interrupted sequence restarts if it is still in view. With `prefers-reduced-motion`, the page presents the complete static content instead. The homelab diagrams remain understandable without animation.

The terminal is a fixed-response text interface. It does not execute commands, scan systems, contact a backend or submit visitor data. User input is inserted as text rather than HTML.

The ClassQuest case has a Before / The change / What backs it explanation of the real upload-security PR #12. Its three ordinary buttons reveal existing HTML; they do not run tests, upload files or contact the application. Inactive panels are hidden from assistive technology and keyboard navigation. Desktop keeps a common panel height; smaller screens use each panel's natural height to avoid empty space. All explanations and source links are readable without JavaScript and in print. The focused browser suite checks every state at all four widths in both themes, including native keyboard/touch behavior, focus, no-JavaScript content and print.

### Mobile alignment

Small screens are designed rather than shrunk, and "no horizontal overflow" is only the minimum. `npm run test:mobile` measures what makes them feel deliberate at 320, 360, 390, 430, 768 and 820px in both themes, with a desktop contract at 1440px.

- **Margins are optical.** The responder sprite's idle frame has about 37px of transparent padding, so it is trimmed with a negative margin and placed in its own grid cell to meet the right margin. The large project numerals use negative tracking; on phones `right: .05em` compensates so the painted glyphs end at the margin.
- **Touch targets are 44px.** Standalone controls grow with padding plus an equal negative margin (or an absolutely positioned `::after`) so the visible spacing does not move. Rules are scoped to `(max-width: 850px), (pointer: coarse)`, so a mouse at desktop widths keeps the original layout. Inline links inside running text are exempt.
- **Phrases, not lines, control wraps.** Headlines that were broken with `<br>` use `.hl` blocks (`display: block; text-wrap: balance`), and `"&"` is bound to the next word with a non-breaking space. Project labels are `.seg` segments that stack on small screens while the `.sep` slash stays available to assistive technology. Running copy uses `text-wrap: pretty` up to 850px.
- **One disclosure language.** Off shift, Training / tools / community and Résumé use the same +/- row as the experience list; an arrow is reserved for links that leave the page.
- **Diagrams are drawn for the screen.** Below 600px the home-lab path is a second, vertical SVG (`.diagram-narrow`) instead of a 650px scroller; it keeps the same node classes and has no animated packets. The LUNA architecture image is drawn for a 680px canvas, so phones also get an "Open the diagram full size" link.
- **Known limit.** The ClassQuest code excerpt wraps inside its panel at 320px (about 200px of text width) rather than scrolling sideways.

Images have alternative text and explicit dimensions. Fonts are self-hosted, and the deployed site has no runtime dependencies, analytics script or remote font request.

## Content boundaries

Repository changes should preserve the distinction between completed work, shared work, teaching examples and future plans.

- ITDR Home Lab Phase 1 established endpoint telemetry collection. The lab is paused, and detection-rule development remains future work.
- The animated telemetry path and sample trace are explanatory visuals. They are not live telemetry, a recorded incident or evidence of response time.
- ClassQuest was built by a five-person team, and the People's Choice Award belongs to the team. My individual contribution is supported by the ten linked pull requests.
- ClassQuest PR #12 separated client filenames from server-generated storage names and bounded the application read. Its four added test cases are linked at the merged patch's commit; the existing compatibility test was retained. It did not add malware scanning, parser isolation, upstream request limits or comprehensive upload protection. The page explains historical evidence and does not claim to rerun the team's application tests.
- LUNA is shared work with Zhirui Lu. Individual, shared and vendor contributions should remain attributed.
- DissentKit is presented as an early experiment without a claim of independently established effectiveness.
- The downloadable résumé is stored in `resume/` and linked directly from every masthead, the homepage introduction and the Contact section.

## Build and deployment

GitHub Pages serves the site from the repository-root routes. The optional build validates the source and creates an allowlisted static copy in `dist/`. The `dist/` directory is ignored and is not the current hosting source.

Font licence files are included in `assets/fonts/`. The repository has no top-level licence, so no blanket reuse permission should be inferred for project screenshots, photographs, diagrams or responder artwork.

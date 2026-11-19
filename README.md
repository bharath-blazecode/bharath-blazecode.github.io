# Barry Sampath | Field Notes

[View the live portfolio](https://bharath-blazecode.github.io/)

[![Barry Sampath Field Notes title card](assets/og-portfolio.jpg)](https://bharath-blazecode.github.io/)

This repository contains the source for my portfolio, a static site built with HTML, CSS and JavaScript.

The website carries the professional story and project detail. This README is for people who want to inspect, run or maintain the code.

## Visit the work

- [ITDR Home Lab](https://bharath-blazecode.github.io/work/homelab/)
- [ClassQuest](https://bharath-blazecode.github.io/work/classquest/)
- [LUNA](https://bharath-blazecode.github.io/work/luna/)
- [Scoreboard: CTFs and hackathon results](https://bharath-blazecode.github.io/work/competitions/)

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
npm run test:projects
npm run test:field-notes
npm run test:desk
npm run test:journey
npm run test:gravity
npm run test:responder-tray
npm run test:experience
npm run test:homelab
npm run test:classquest
npm run test:mobile
```

The browser suite exercises the homepage, three case studies, the Scoreboard page and the 404 page at 320, 390, 820 and 1440px widths. It also checks both themes, reduced-motion behavior, keyboard interaction, the scripted sequences, the terminal and the no-JavaScript path. Axe is included for automated accessibility checks, but an automated pass does not establish WCAG conformance or replace assistive-technology testing.

The 3D desk is bundled in the repository, so serving or building the site does not require npm. After editing `src/desk-scene.js`, install the development dependencies and run `npm run bundle:desk` to regenerate its self-hosted bundle. Three.js 0.187.0 is MIT-licensed; its license is in `assets/desk/THREE-LICENSE.txt`.

## Repository map

```text
index.html                  homepage
404.html                    missing-page response
work/homelab/index.html     ITDR Home Lab case study
work/classquest/index.html  ClassQuest case study
work/luna/index.html        LUNA case study
work/competitions/index.html Scoreboard: CTF and hackathon results with evidence
css/site.css                shared responsive, theme and print styles
css/home.css                Focused Field Notes homepage refinements
css/investigation-desk.css  responsive homepage field map
css/signal-journey.css      scroll story and decorative desk signals
css/responder-tray.css      project guide and quick index
css/homelab.css             lab notebook and illustrative investigation styles
css/classquest.css          case-local upload-decision field notes
css/competitions.css        Scoreboard result blocks and evidence figures
js/theme.js                 early theme restoration
js/site.js                  motion, navigation and terminal enhancements
js/investigation-desk.js    progressive 3D desk loading and link handling
js/signal-journey.js        scroll progress and touch feedback
js/punctuation-gravity.js   decorative copies of opening text drawn toward the desk
js/responder-tray.js        contextual guide and quick-index motion
js/homelab.js               notebook pages and investigation enhancements
js/classquest.js            progressive upload-decision controls
assets/                     project media, competition evidence, fonts and social preview
src/desk-scene.js           source for the locally bundled Three.js scene
resume/                     Downloadable résumé PDF
tools/                      verification, build and preview scripts
tests/browser.cjs           Playwright browser checks
tests/projects.cjs          folder, summary, keyboard and fallback checks
tests/field-notes.cjs       opening, chapter thread and reduced-motion checks
tests/desk.cjs              3D desk, links, fallback and accessibility checks
tests/journey.cjs           scroll, touch and fallback checks
tests/punctuation-gravity.cjs  particle motion, source content and fallback checks
tests/responder-tray.cjs    guide, quick index, motion and accessibility checks
tests/experience.cjs        experience path, role detail and fallback checks
tests/homelab.cjs           notebook, evidence, investigation and fallback checks
tests/classquest.cjs         decision states, keyboard, no-JS and print checks
tests/mobile.cjs            alignment, touch-target, wrap, responder, diagram and scoreboard checks
past looks/                 dated, comparable screenshots of earlier and current designs
```

The HTML files are the editable source of truth. Shared navigation is repeated across the six pages, so a global navigation change must be applied to each one. `npm test` catches broken local links and fragments.

## Design and accessibility behavior

The primary content and navigation use ordinary HTML. The homepage interests line is immediately visible. The selected-work folders use each project's own evidence and reveal one existing summary at a time; the summary links to its full case study. Selecting the open folder again, choosing Close or pressing Escape closes the summary. JavaScript progressively adds this interaction, the theme control, decorative sequences and terminal interaction. Without JavaScript or when printing, all three project summaries remain available.

The folder papers fan out on hover and keyboard focus. A connector and summary transition make the selected case file clearer; its button also changes from “View summary” to “Close summary”. Reduced-motion visitors see the same folders and summaries without the movement. If a project thumbnail or summary image fails to load, JavaScript retries it once using a fresh URL; a persistent connection or hosting failure can still prevent it from loading. The focused project suite checks image decoding and recovery, as well as switching projects, keyboard and touch-sized controls, focus return, reduced motion, printing, and the no-JavaScript path. To check a deployed site instead of starting a local server, set `PROJECTS_ORIGIN` to its origin before running `npm run test:projects`.

The opening uses a hand-drawn underline and a brief responder gesture. Decorative chapter marks connect the homepage sections; a small rail also follows the current section on wide screens. These do not replace navigation or hide content. On smaller screens the in-page marks remain and the floating rail is omitted. The underline and marks are static for reduced motion and without JavaScript. Reproducible before-and-after captures are documented in [`past looks/`](past%20looks/README.md).

The homepage investigation desk is an original procedural 3D illustration, not a live system or dashboard. The monitor, notebook, folder and figures open the security lab, AI research, projects and experience. The same destinations are ordinary text links and work on touch and keyboard. The locally bundled 3D scene loads only when the desk is in view; a static illustration remains if JavaScript, the bundle or WebGL is unavailable. Reduced-motion visitors get a still scene, and rendering stops offscreen and in a background tab. Selecting the AI research link opens that role; no experience role is selected by default.

The question-to-evidence path uses normal scrolling and keeps every step readable without JavaScript. Its progress line, the project-folder entrance and the arrows in the illustrative field note add motion without hiding content. As a mouse approaches the desk, decorative copies of visible opening punctuation and the dots on letters move towards it. Inside the field map they turn yellow and merge into a small liquid drop; quick movements leave droplets which rejoin it. Leaving sends the copies home. When an unmodified mouse click selects a desk object or its link, the copies briefly scatter back before navigation; keyboard, touch, modified clicks and reduced-motion navigation remain immediate. The underlying text is never changed, and the approximate source positions of letter dots depend on the font. Touch retains a brief tap signal. Pointer coordinates stay in the browser and are not sent anywhere. Decorative movement stops in background tabs, and a pending selection still completes if the animation is interrupted.

Opening a project also gives the responder a short, project-specific cue. A compact quick index provides links to the work, experience, contact and résumé; on smaller screens it sits within the page. Closing the index briefly scatters decorative fragments, and Escape closes it and returns focus to its control. The gesture and fragments do not loop and are omitted for reduced motion. The index is a native disclosure, so its links remain usable without JavaScript; the original project summaries remain readable as well.

The experience path leads with AI and cybersecurity work, followed by technical leadership, placement, community and customer-service roles; the dates remain visible and may overlap. It starts with no role selected. Selecting a point or its name opens the role detail; selecting it again, choosing Close or pressing Escape closes it. The QUT research detail presents its question, work and concern as three connected notes, followed by the collaborators and project link. On phones the path scrolls horizontally and keeps the selected point in view. Without JavaScript the original disclosures remain available, and printing includes all roles. The HTML order determines the path order, and each role's `data-path-label` supplies its short name; the full name and description remain in the ordinary HTML disclosure.

Day and night themes follow the operating-system preference until the visitor makes a local choice. Most decorative sequences settle within five seconds. On wider screens, the telemetry flow repeats while visible, and the diagram itself can pause or resume it. All motion stops when the page is hidden; an interrupted sequence restarts if it is still in view. With `prefers-reduced-motion`, the page presents the complete static content instead. The homelab diagrams remain understandable without animation.

The home-lab notebook pairs the original Wazuh overview with a collection note, and a labelled illustration with a storage fault documented in the build log. The original image opens directly at full size. Previous and Next controls turn between notes; without JavaScript or when printing, both notes remain visible. The investigation graphic is an illustrative Word-to-PowerShell relationship, not a recorded incident. Its stage links open the corresponding explanations when JavaScript is available; otherwise they lead to the ordinary disclosures. Arrow and page-turn motion respect reduced-motion preferences.

The terminal is a fixed-response text interface. It does not execute commands, scan systems, contact a backend or submit visitor data. User input is inserted as text rather than HTML.

The ClassQuest case has a Before / The change / What backs it explanation of the real upload-security PR #12. Its three ordinary buttons reveal existing HTML; they do not run tests, upload files or contact the application. Inactive panels are hidden from assistive technology and keyboard navigation. Desktop keeps a common panel height; smaller screens use each panel's natural height to avoid empty space. All explanations and source links are readable without JavaScript and in print. The focused browser suite checks every state at all four widths in both themes, including native keyboard/touch behavior, focus, no-JavaScript content and print.

### Mobile alignment

Small screens are designed rather than shrunk, and "no horizontal overflow" is only the minimum. `npm run test:mobile` measures what makes them feel deliberate at 320, 360, 390, 430, 768 and 820px in both themes, with a desktop contract at 1440px.

- **Margins are optical.** The responder sprite's idle frame has about 37px of transparent padding, so it is trimmed with a negative margin and placed in its own grid cell to meet the right margin. The large project numerals use negative tracking; on phones `right: .05em` compensates so the painted glyphs end at the margin.
- **Touch targets are 44px.** Standalone controls grow with padding plus an equal negative margin (or an absolutely positioned `::after`) so the visible spacing does not move. Rules are scoped to `(max-width: 850px), (pointer: coarse)`, so a mouse at desktop widths keeps the original layout. Inline links inside running text are exempt.
- **Phrases, not lines, control wraps.** Headlines that were broken with `<br>` use `.hl` blocks (`display: block; text-wrap: balance`), and `"&"` is bound to the next word with a non-breaking space. Project labels are `.seg` segments that stack on small screens while the `.sep` slash stays available to assistive technology. Running copy uses `text-wrap: pretty` up to 850px.
- **One disclosure language.** Off shift, Training / tools / community and Résumé use the same +/- row as the experience details; an arrow is reserved for links that leave the page.
- **Diagrams are drawn for the screen.** Below 600px the home-lab path is a second, vertical SVG (`.diagram-narrow`) instead of a 650px scroller; it keeps the same node classes and has no animated packets. The LUNA architecture image is drawn for a 680px canvas, so phones also get an "Open the diagram full size" link.
- **The competition teaser stays small on purpose.** The homepage shows four headline results as one scoreboard strip (four across on desktop, 2 x 2 on tablets, one row each on phones) and links to the Scoreboard page for everything else. The mobile suite fails if the section grows past 840px, if a figure wraps or clips, or if a focused tile loses contrast on its lime fill.
- **Known limit.** The ClassQuest code excerpt wraps inside its panel at 320px (about 200px of text width) rather than scrolling sideways.

Images have alternative text and explicit dimensions. Fonts and the 3D scene are self-hosted; the deployed site makes no analytics or remote font requests.

## Content boundaries

Repository changes should preserve the distinction between completed work, shared work, teaching examples and future plans.

- ITDR Home Lab Phase 1 established endpoint telemetry collection. The lab is paused, and detection-rule development remains future work.
- The animated telemetry path and sample trace are explanatory visuals. They are not live telemetry, a recorded incident or evidence of response time.
- ClassQuest was built by a five-person team, and the People's Choice Award belongs to the team. My individual contribution is supported by the ten linked pull requests.
- ClassQuest PR #12 separated client filenames from server-generated storage names and bounded the application read. Its four added test cases are linked at the merged patch's commit; the existing compatibility test was retained. It did not add malware scanning, parser isolation, upstream request limits or comprehensive upload protection. The page explains historical evidence and does not claim to rerun the team's application tests.
- LUNA is shared work with Zhirui Lu. Individual, shared and vendor contributions should remain attributed.
- DissentKit is presented as an early experiment without a claim of independently established effectiveness.
- The VRES research placement began in November 2026. The description reflects the owner's update: exploring AI assessment against ASD Essentials and helping evaluate its trustworthiness with QUT and Flame Tree Cyber. The work is in progress; do not describe its aims as established results or claim an unpublished acceptance rate.
- Competition results are team results (Team SushiShield for the CTFs; the ClassQuest team for the hackathon), and the notes on the Scoreboard page describe my own work in the first person. ByteMe CTF is a participation certificate with no placement, and nothing may suggest one. Do not describe any event as unaided, solo or fully completed: the Holmes certificate records eight of 111 challenges, and the TryHackMe tabletop score (86% across 15 decisions) is not an overall event score. The "How I worked" note is deliberately general ("AI tools as a guide on some events"); keep it accurate if events are added. Event dates were checked against the organisers' pages (CSAW, TryHackMe, Hack The Box) and the certificates (Holmes, ByteMe) on 29 October 2026. `npm test` pins every result line, so a changed figure fails until it is re-checked against its source.
- Competition evidence in `assets/competitions/` is the owner's own certificates and result screenshots, recompressed. The leaderboard is cropped to its panel; nothing in them is edited. Teammates named on the Scoreboard page (Alan Nguyen, Akira Hasuo) are credited as in the public LinkedIn post.
- The downloadable résumé is stored in `resume/` and linked directly from every masthead, the homepage introduction and the Contact section.

## Build and deployment

GitHub Pages serves the site from the repository-root routes. The optional build validates the source and creates an allowlisted static copy in `dist/`. The `dist/` directory is ignored and is not the current hosting source.

Font licence files are included in `assets/fonts/`. The repository has no top-level licence, so no blanket reuse permission should be inferred for project screenshots, photographs, diagrams or responder artwork.

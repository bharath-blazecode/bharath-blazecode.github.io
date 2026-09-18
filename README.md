# Barry Sampath — Field Notes

A complete static portfolio about cybersecurity, identity controls, IT automation and practical systems work. This refinement builds on the Field Notes redesign merged in PR #16 at commit `928ab22e1a09f2084d45aec0d5b53981a4b5494f`. It retains the existing GitHub Pages routes.

## Run locally

Node.js 22 or later is sufficient. No dependency installation is needed for these commands:

```sh
npm test
npm run build
npm run preview
```

Open `http://127.0.0.1:48763`. The server binds only to the local loopback address. Stop it with Ctrl+C. `npm start` previews the source directly; `npm run preview` previews the complete static copy in `dist/`.

The production site has no runtime packages, backend, credentials, remote fonts, tracking or analytics. GitHub Pages can continue serving the source files at repository root; the optional build produces the same pages and assets for verification. No deployment configuration has been changed.

## Browser checks

Only browser testing requires development dependencies and an installed browser:

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run test:browser
```

Alternatively set `BROWSER_CHANNEL=chrome` or `msedge` to use an installed browser. In PowerShell: `$env:BROWSER_CHANNEL = 'chrome'`; then run the test command. The dependency lock pins Playwright 1.62.1 and axe-core 4.10.3. The test checks five routes at desktop and 320px in both themes, automated accessibility rules, theme persistence, bounded entry and re-entry motion, reduced-motion fallbacks, the telemetry and trace sequences, mobile layout, keyboard interaction, safe terminal command handling and a no-JavaScript path. Automated checks do not establish WCAG conformance or replace assistive-technology testing.

## Edit the site

```
index.html                 homepage and optional terminal
work/homelab/index.html     lab case study and illustrative learning example
work/classquest/index.html  collaborative work and ten merged PRs
work/luna/index.html        shared robot project and contribution boundaries
404.html                   missing-page experience
css/site.css               responsive styles, themes and print treatment
js/theme.js                early local theme restoration
js/site.js                 bounded viewport motion, theme and terminal behaviour
assets/                    inherited evidence, responder, fonts and social image
resume/                    original June 2026 PDF, explicitly flagged as stale
tools/                     dependency-free verification, build and preview
tests/browser.cjs          reproducible browser smoke test
```

HTML is the editable source of truth. Shared navigation is deliberately ordinary markup repeated across five small pages. Update all five when changing global navigation; `npm test` checks local links, fragments, assets, metadata and core factual boundaries. Image width and height attributes are required and should be updated when an image changes. The optional `dist/` build uses a public-file allowlist that excludes tests, dependencies and documentation. The current GitHub Pages configuration still serves the repository root, so that allowlist is a packaging boundary rather than the live hosting boundary.

## Reading and interaction

The homepage supplies a quick scan. Every project links directly to a complete case study with a summary, contribution boundary and evidence index. Native disclosures hold optional role detail, a structured training, tools and community ledger, off-shift material, the résumé notice and terminal. They work without scripting.

Day/Night follows the operating system until a local choice is saved. The role reel, inherited pixel responders, desktop telemetry packets and illustrative trace use short viewport-triggered sequences. Each settles in under five seconds and becomes eligible to replay only after fully leaving the viewport. A hidden tab interrupts motion, no motion preference is stored, and reduced-motion users receive complete static content. A blocked theme-preference store cannot prevent the page loading. No hover gesture is required.

The homelab example remains a manual four-step explanation. Its three moving packet markers and five-line illustrative trace are teaching aids, not live telemetry or a timed incident. They settle after one short sequence; the original nine-event autoplay stream remains removed. The terminal inserts only text; it cannot execute commands, scan systems or submit data. Its history exists only for the current page session and is bounded.

## Content boundaries

- ScienceGears is Barry's paid Cybersecurity & IT Automation Analyst contract.
- Code Network Event Officer is current as of September 2026. Engagement Officer starts in October; update this deliberately after confirmation.
- ITDR Phase 1 collected endpoint telemetry. The lab is paused and rule development is future work. The overview image is context, not proof of a production detection programme.
- ClassQuest is a five-person team achievement; Barry's ten linked contributions were independently checked. LUNA is shared with Zhirui Lu and uses vendor components.
- DissentKit is a secondary early-stage experiment, with attributed origins and no asserted model effectiveness. Ollama and Hermes are omitted for lack of useful project evidence.
- The June 2026 résumé remains byte-for-byte unchanged. Its GPA, completion date and lab claims are stale; the only download path explicitly warns readers. Replace it only with a verified owner-approved update.

## Assets and ownership

Archivo and Source Serif 4 are self-hosted WOFF2 Latin subsets provided by Google Fonts. Their OFL licences are in `assets/fonts/`. Optional font loading avoids late layout shifts on slow connections. The body and metadata use system fonts. The social preview is a local typographic composition, not fabricated project evidence. No AI-generated imagery was added.

Existing screenshots, robot photograph, diagram and responder sprite sheets are retained under the user's redesign authority. The baseline has no repository-wide licence, and the sprite creation/licence history was not supplied; no new ownership or blanket MIT claim is made. Confirm inherited artwork provenance before wider redistribution. The handoff package records evidence-specific attribution and all file hashes.

## Publication

This refinement is intended for one unmerged pull request for Barry's review. Test success does not approve a merge or deployment; the final publication decision remains with Barry.

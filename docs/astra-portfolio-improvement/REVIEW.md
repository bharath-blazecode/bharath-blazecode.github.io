# Design and verification review

The approved Incident File direction is implemented with the original portfolio's project narratives and evidence intact. The refinements make work easier to reach, distinguish illustrative detection material from completed lab work, and give readers stable controls and inspectable images.

## Rendered design experiments

The [packaged evidence index](evidence/README.md) links the comparison captures and verification records. The original comparison records remain in the task workspace at `work/captures/experiments.json`. These were actual browser renders, not proposed experiments.

| Experiment | Captures | Decision and reason |
| --- | --- | --- |
| Grain | `experiment-grain-original.png`, `experiment-grain-background-only.png`, `experiment-grain-none.png` | Remove grain. The original 0.055 overlay adds texture across reading and evidence surfaces; the 0.018 margin-only variant is quieter but contributes little to hierarchy. The untextured surface best serves the small metadata and genuine screenshots. |
| Case annotation rail | `experiment-rail-original150.png`, `experiment-rail-limited120.png` | Keep a 120px rail only at `#built`, with a 32px gap; other sections use a compact label and rule. The limited rail identifies the substantive build section while returning horizontal space to the rest of each narrative. It collapses on small screens. |
| Homepage evidence composition | `experiment-evidence-wide.png`, `experiment-evidence-split.png` | Keep the approximately 45/55 text/evidence split at wide sizes, stacking on small screens. The split keeps a project's contribution, status and evidence together; the wide variant increases vertical travel between that context and the next project. |

Images use their original files and colour, `object-fit: contain`, natural proportions and normal full-size links. The LUNA photograph retains the full frame at a maximum display height of 520px. The ClassQuest gallery aligns its differently shaped images at the top, so the shorter sign-in screenshot does not inherit the portrait hub's height.

The compact hero preserves the exact pixel responder identity and frames. Consistent heading weight, a deliberate line break before the emphasized phrase, a bounded incident sequence and explicit replay retain personality without continuously changing the reading surface.

## Perspective review

| Perspective | Result |
| --- | --- |
| Recruiter | Selected Work immediately follows the summary. The hero describes defensive security, identity/access and IT automation; the experience heading no longer unnecessarily frames every role through study. Résumé/contact wording and destinations remain available. |
| Security practitioner | The sample event, rule, alert and triage sequence are explicitly illustrative. ITDR remains Phase 1 complete and paused. The OpenSearch lineage, PowerShell sub-technique label and build-specific storage lesson use the approved accurate wording. |
| IT automation | Existing ScienceGears scope, identity controls and automation descriptions are unchanged. The redesign changes emphasis and access, not claimed responsibility or results. |
| Frontend/design | A shared palette and type hierarchy work across five pages. Evidence remains uncropped, rails are limited to where they help, and the site keeps its dependency-free static implementation. |
| Accessibility | Explicit selected states, repaired heading hierarchy, visible keyboard focus, functioning anchor focus, live reduced-motion response and no-JavaScript content were checked. No complete screen-reader or WCAG conformance claim is made. |
| Mobile use | All five pages reflow at 320px in both themes with zero recorded document overflow. The labelled faults table, contained technical blocks, stacked evidence and 44px controls support small-screen reading. Physical-device testing remains outstanding. |

## Browser and runtime evidence

The saved matrix contains **16 homepage configurations** and **24 case-study configurations** at four requested viewport sizes, plus **10 results at 320px** and **10 no-JavaScript results**. Matrix screenshots are viewport captures, with case top/evidence views; only the packaged original baseline capture is full-page. The results do not imply that every page was visually reviewed from top to bottom at every combination.

`interaction-browser.json` records an 81.77px anchor top beneath a 66px header, focus on the destination, near-identical section fractions before/after mode change (0.10739 → 0.10700), and visible 2px focus outlines for Day and the terminal input. `motion-browser.json` records a frozen CSS sprite position under manual Pause, an offscreen paused state, and live reduced motion showing a settled responder and all ten console rows including the alert.

The nine Node runtime tests supplement those browser checks with deterministic timing and DOM interactions. In particular, they cover hidden-document timing and the full replay/hold lifecycle without confusing those unit-level checks with physical browser/device testing. A second-tab browser attempt still reported `document.hidden=false`, so it did not validate the hidden-document state. Browser Replay was separately observed resetting to idle with the frame animation running. A Dark → case → homepage navigation check retained Dark and homepage Skim.

The initial homepage check identified a mobile Day button below 44px wide, which was corrected. After the minimum-width fix, gallery alignment and hero line-break polish, the complete 16-state homepage and 24-state case matrices were recaptured with the final stylesheet. The final records show zero page overflow, visible theme controls and mode/theme targets of at least 44×44px. The 320px checks also pass. The stale full-page after-capture is omitted from the packaged evidence. Use the final matrix captures and contact sheets to assess the final viewport state; the full-page baseline is retained only as original-context evidence.

The final small-screen audit also reproduced unreachable first rows in the detection console under `flex-end` alignment. The fix uses `flex-start` and makes the region keyboard-focusable with `tabindex="0"`. At 320px, [console reflow evidence](evidence/console-reflow-browser.json) records the first row reachable at scrollTop 0 and the last row reachable at scrollTop 424 after native Ctrl+End, with focus retained and a solid outline. This targeted check followed the matrix and does not change its hero/case capture coverage. The supplemental section sheet may predate that interior console correction; `console-reflow-browser.json` and `console-320-end.png` are the final evidence for the console scroll region.

The [supplemental homepage sections](evidence/home-sections.jpg) were reviewed across lower Day sections and Night-only Offshift/terminal without a material defect in those views. Matrix captures use reduced motion for visual stability; the separate browser motion record establishes animation behaviour. Browser terminal records also confirm inherited/unknown command handling and inert XSS output while preserving input focus.
## Integrity and external links

All 28 approved content/movement entries pass source review. SHA-256 comparisons confirm all 15 protected assets, résumé and favicon are unchanged. All original case captions and destinations remain; there are nine visible full-size image actions across the homepage and cases. ScienceGears text and project contribution boundaries are unchanged. All five pages have one `h1`, no heading skips and no nested anchors.

The public-link check made unauthenticated, read-only HTTP requests to 16 unique links. Fifteen returned 200. LinkedIn returned 405 to HEAD and 999 to GET, so its profile availability could not be established. The YouTube short link resolved to a watch page with 200; playback was not verified.

The [source-size record](evidence/source-size-review.json) measures seven HTML/CSS/JS files as saved. Raw bytes total 154,583 versus 147,318 at baseline (+7,265). Summing gzip level-9 results for each file separately gives 42,697 versus 42,017 bytes (+680, about 1.6%). Original media remains unchanged. This excludes images, fonts, PDF and HTTP headers and does not measure a single page transfer, network timing or browser performance.
## Limits and delivery status

The original environment's unpushed files could not be recovered. Implementation was recreated from verified public commit `a07bdfcdeead1697975fc146c884b9d4ccef2ba7`. No invented employment, seniority, metrics, outcomes or awards were introduced; unrelated project code and records were outside scope.

No physical-device test, screen-reader session, complete WCAG audit or formal performance score is claimed. The push dry-run returned HTTP 403 because GitHub account `Minglzzb` lacks permission to the portfolio repository. No branch was uploaded and no PR exists; the prepared PR text does not indicate publication. No merge or deployment is part of this task.

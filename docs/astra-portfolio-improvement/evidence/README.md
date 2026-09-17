# Browser review evidence

Captured locally on 17 September 2026. These are audit artifacts; portfolio artwork, photographs and screenshots under `assets/` were not modified. See the [review](../REVIEW.md) for decisions and verification limits.

## Final visual matrix

The ten contact sheets were regenerated from the final viewport captures, after the header controls, mobile centering, gallery alignment, limited case rail and hero typography corrections. Labels identify the page, viewport width, theme and reading mode. `light` means Day; `dark` means Night. Homepage filenames are strictly limited to the four expected theme/mode combinations per width, excluding full-page captures. Contact sheets are resized JPEG previews; gray padding belongs to the sheets, not the website.

| Views | Contact sheets |
| --- | --- |
| Home, Skim/Read × Day/Night | [390px](home-390.jpg), [768px](home-768.jpg), [1280px](home-1280.jpg), [1440px](home-1440.jpg) |
| ClassQuest, Day/Night at all four widths | [Top](classquest-top.jpg), [Evidence](classquest-evidence.jpg) |
| ITDR Home Lab, Day/Night at all four widths | [Top](homelab-top.jpg), [Evidence](homelab-evidence.jpg) |
| LUNA, Day/Night at all four widths | [Top](luna-top.jpg), [Evidence](luna-evidence.jpg) |

The [supplemental homepage sections](home-sections.jpg) sheet records About, background, contact, experience, Night-only Offshift, skills, terminal and the illustrative walkthrough. These selected section views supplement the matrix; they are not additional complete viewport combinations.

The 16 homepage configurations use viewports 390×844, 768×1024, 1280×800 and 1440×900. The 24 case-study configurations each have top and evidence captures. They are viewport samples, not a claim of a full-page visual inspection in every configuration. Matrix captures use reduced motion for a stable comparison; the separate motion records cover interaction behavior.

Final inspection confirmed the centered mobile responder, shorter ClassQuest figure ending at its caption, compact context labels, retained build-section rail, natural LUNA framing and clear Day/Night states. No new material clipping or hierarchy regression was visible in the reviewed sheets.

## Before and after

- Original baseline: [desktop viewport](baseline-desktop-day.png), [mobile viewport](baseline-mobile-day.png), [full homepage](baseline-home-day-full.png).
- Final Day/Skim homepage: [1440px viewport](final-home-1440-light-skim.png), [390px viewport](final-home-390-light-skim.png).

The workspace's earlier `after-home-day-full.png` was captured before final polish and is deliberately omitted. The final matrix and representative viewport screenshots above are the current visual reference. Baseline and final full-page lengths are not compared as equivalent states.

## Rendered experiments

These historical comparison renders support treatment selection; they predate final polish and do not replace the final matrix.

| Comparison | Actual captures | Selected treatment |
| --- | --- | --- |
| Grain | [Original 0.055 overlay](experiment-grain-original.png), [0.018 background margins](experiment-grain-background-only.png), [No grain](experiment-grain-none.png) | No grain |
| Case rail | [Original 150px rail](experiment-rail-original150.png), [Limited 120px rail](experiment-rail-limited120.png) | 120px rail at the build section; compact labels elsewhere |
| Homepage project evidence | [Split](experiment-evidence-split.png), [Wide](experiment-evidence-wide.png) | Split at wide viewports; stacked on small screens |

[Experiment definitions](experiments.json) record the comparison CSS. Images remain PNG to retain fine text and the subtle grain difference.

## Verification records

| Record | Scope |
| --- | --- |
| [Homepage matrix](homepage-matrix.json) | Final 16 configurations, dimensions, selected states and overflow observations |
| [Case matrix](case-matrix.json) | Final 24 configurations, headings, figures and overflow observations |
| [320px reflow](reflow.json) | Five pages in both themes; includes 404 and control dimensions |
| [No JavaScript](no-js.json) | Five pages in both OS colour preferences |
| [Browser interaction](interaction-browser.json) | Anchor offset/focus, reading-position preservation, focus outlines and preference persistence |
| [Browser motion](motion-browser.json) | Manual Pause, offscreen pause, live reduced motion and Replay observations |
| [Browser terminal](terminal-browser.json) | Static command handling, clear behavior and input-focus observations |
| [320px console scrolling](console-reflow-browser.json) | First and last telemetry rows remain reachable; focused Ctrl+End scrolls to the final alert ([end view](console-320-end.png)) |
| [Baseline dimensions](baseline-metrics.json) | Original layout and Selected Work position |
| [Content review](content-review.json) | Approved content, semantic structure and protected content checks |
| [External destinations](external-links.json) | Unauthenticated HTTP checks; LinkedIn availability remained unverified |

The console scrolling correction followed the final top/case matrix: it changes the console interior only, leaving those matrix views unaffected. The supplemental sections sheet may show the earlier console interior; the focused 320px end view is the final console reference.

The browser hidden-tab attempt continued to report `document.hidden=false`, so that observation does **not** verify hidden-document behavior. Deterministic runtime tests cover the hidden-document timer path separately. No physical-device test, screen-reader session, complete WCAG audit or formal performance score is claimed. Contact-sheet compression must not be used to measure text contrast; source palette checks and browser records are described in the main review.

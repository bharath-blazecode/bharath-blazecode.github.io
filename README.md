# bharath-blazecode.github.io

Personal portfolio for Barry Sampath — cybersecurity and IT automation.
Live at <https://bharath-blazecode.github.io>.

**Version 1.0.3.** Adds shared-element page transitions, kinetic type on
the hero, and a typeable hello-world terminal. Versions 1.0.1 (the
original single-file site) and 1.0.2 (the rebuild) are preserved as zip
archives outside this repository, and in the `main` history.

## What this is

A hand-written static site. No framework, no build step, no dependencies.
GitHub Pages serves the files exactly as they are committed.

```
index.html            home — hero, glance strip, about, detection, work,
                      experience, skills, background, hello world, off shift
work/homelab/         case study — ITDR home lab
work/classquest/      case study — ClassQuest
work/luna/            case study — LUNA robot
css/site.css          the whole design system
js/site.js            progressive enhancement only
404.html              not-found page
resume/               resume PDF
favicon.svg
```

## Design

Two materials. Editorial print for everything that is read; console
telemetry for everything that is evidence.

- **Type** — Archivo (display), Source Serif 4 (body), IBM Plex Mono (data)
- **Colour** — paper and ink, with a single signal colour reserved strictly
  for severity. If the accent appears, something is being flagged.
- **Day shift / night shift** — a SOC runs around the clock, so the theme
  states are named for the shifts. The switch wipes the page as a circle
  expanding from the button, via the View Transitions API.

## Two reading speeds

The **glance strip** directly under the hero answers who / doing now /
built / proof in about twenty seconds, without scrolling far. The
**Skim / Read** control in the header compresses the page further by
collapsing `.detail-only` sections — the walkthrough, the failure log,
the role bullets — roughly a 30% reduction in page length. Read is the
default, so with JavaScript off nothing is ever hidden.

## hello, world

Every field has a first line everybody recognises. The band near the
footer cycles through security's: the EICAR test string, `nmap -sV
scanme.nmap.org`, `' OR '1'='1'`, `whoami`, "It depends." for GRC, and
one about MFA. Cycles on a timer, advances on click.

It is also typeable. `help` lists what it knows: `whoami`, `nmap`,
`eicar`, `sqli`, `xss`, `grc`, `mfa`, `ls`, `resume`, `contact`, `sudo`,
`clear`, `exit`. Arrow keys walk the history. The panel says everything
it has to say untouched, so typing is additive rather than a gate — and
the input element is `hidden` in the markup and unhidden by script, so
with JavaScript off there is no form to submit. Every response is written
with `textContent`, which is why the `xss` and `sqli` answers are inert
text rather than markup.

## Motion policy

Every animation reveals information. Nothing moves for decoration.

| Effect | What it shows |
|---|---|
| Theme wipe from the button | Causation — you pressed that |
| Console filling | Telemetry arriving in real time |
| Section rules drawing | A section beginning |
| Case-study rail filling | Progress through the page |
| Cross-document transitions | Continuity between pages |
| Card expanding into a page header | Which card you came from |
| Hero headline shedding weight | Distance travelled from the top |
| Packets along the lab diagram | The direction telemetry actually flows |

## Shared-element transitions

Each project card title and the matching case-study `h1` carry the same
`view-transition-name` via `data-vt`, so clicking a card expands it into
the page header. A name must be unique per document, which holds: three
cards on the home page, one `h1` on each case-study page. The theme wipe's
override of the root animation is scoped to a `.theme-wipe` class the
script adds for that one transition, so navigation keeps its own root
cross-fade.

## Kinetic type

Archivo is loaded on the `wght@400..900` variable axis. The hero headline
sheds weight from 900 to 620 as it exits the viewport, scroll-linked
rather than timed. Ignored where the variable font did not load, skipped
under reduced-motion.

## Accessibility and resilience

- Works with JavaScript disabled: role list renders as plain text, every
  walkthrough panel renders stacked, theme follows the operating system.
- `prefers-reduced-motion` honoured throughout.
- `prefers-color-scheme` respected by default; an explicit choice is stored
  in `localStorage`, wrapped so blocked storage cannot break the page.
- Skip link, semantic landmarks, visible focus, keyboard-operable tabs
  (arrow keys, Home, End).
- Print stylesheet produces a clean summary.

## Local development

Any static server works:

```bash
python3 -m http.server 8000
```

## To do

- Replace the portrait placeholder in `index.html` with `assets/barry.jpg`
- Add redacted Wazuh screenshots to the home lab case study
- Swap the sample Sysmon event and rule for sanitised real ones
- Add `/writing/` once the first posts are drafted

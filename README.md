# bharath-blazecode.github.io

Barry Sampath’s portfolio of practical work in defensive security, identity
and access, and IT automation. Live at <https://bharath-blazecode.github.io>.

This refinement uses an Incident File layout with restrained evidence presentation.
It preserves the existing project narratives, genuine images, attribution and pixel
responder artwork. The current Code Network role is Event Officer; the Engagement
Officer transition begins in October 2026. The ITDR home lab remains a personal
project with Phase 1 complete and development paused.

## What this is

A hand-written static site. No framework, build step or runtime dependencies.
GitHub Pages serves the committed files.

```
index.html            home — hero, summary, selected work, about, detection,
                      experience, skills, background, off shift, contact, terminal
work/homelab/         case study — ITDR home lab
work/classquest/      case study — ClassQuest
work/luna/            case study — LUNA robot
css/site.css          shared design system
js/site.js            progressive enhancement
404.html              not-found page
resume/               resume PDF
favicon.svg
assets/projects/      original project screenshots, photograph and diagram
assets/incident-responder/
                      six original transparent pixel sprite sheets
```

## Design and reading modes

Archivo supplies headings, Source Serif 4 body text, and IBM Plex Mono technical
labels and code. Day and Night use the Incident palette, with rust links, green
status indicators and distinct functional borders. Genuine images keep their
natural proportions and colours. Each project image links to its original
file through the image and a visible **View full-size image** link.

The header exposes **Day / Night** in a **Colour mode** group with programmatic
selected states. The operating-system preference applies until an explicit choice
is saved. Theme changes are immediate. Night reveals the Off shift section.

**Skim / Read**, labelled **Homepage reading mode**, controls the homepage only.
Skim is the first-visit default; Read adds the walkthrough, detailed role bullets
and selected training. The saved preference persists across visits, and switching
modes preserves the current section-relative reading position. Case studies always
show their full narratives. With JavaScript disabled, all reading content remains
visible and the theme follows the operating system.

## The illustrative detection console

Runs an illustrative nine-event sequence with condensed timing, displays an example
alert, holds for nine seconds so the card can be read, then wipes and goes again.
The telemetry, rule and alert are examples; the completed home-lab milestone is
endpoint telemetry collection.

The sequence pauses on hover, keyboard focus, manual Pause, when off screen or when
the document is hidden. Suspended timers retain their remaining duration. Restart
replays the sequence. Reduced motion displays the whole example without animation.
A live change to reduced motion settles it immediately; turning the preference off
leaves the static result in place until Restart.

## The simulated terminal

The terminal contains only responses stored in this page. It cannot run commands,
make requests to scan a host, or operate on a visitor’s computer. Replies use
`textContent`, so examples such as SQL injection and XSS remain inert text.

The example card advances only with **Next**. The card and command log remain
visible together. `clear` empties the log without changing the example card.
`help` lists `whoami`, `nmap`, `eicar`, `sqli`, `xss`, `grc`, `mfa`, `cards`, `ls`,
`resume`, `contact`, `sudo`, `clear` and `exit`. `cards` prints all six examples.
Arrow keys navigate command history. `ls` includes `off-shift` only in Night.
Command dispatch accepts only the command table’s own properties.

The command form starts hidden and is enabled by JavaScript. Without JavaScript,
the qualified service-scan example remains readable as static content.

## Incident responder and motion

The original sprite artwork runs one bounded hero sequence through monitoring,
alert, containment, recovery and investigation, then settles. **Replay incident**
starts it again. Manual Pause is remembered for the browser session. Offscreen and
hidden-document pauses preserve the remaining timing, and sprite frames use the
same paused state. The terminal pointing action runs once, for about 860 ms, and
then holds its final pose.

Reduced motion uses meaningful static poses and disables smooth scrolling,
decorative entrances and drawing animations. The preference is observed both at
load and when it changes during a visit. Turning reduced motion off does not
restart a settled sequence without an explicit replay. Interest labels remain
visible instead of rotating, and headings retain a consistent weight while scrolling.

## Accessibility and resilience

- Skip links, semantic landmarks and heading hierarchy, visible keyboard focus,
  and keyboard-operable walkthrough tabs with arrow keys, Home and End.
- Sticky-header offsets measured for anchor navigation, with focus moved to the
  destination after same-page navigation.
- Labelled Day/Night and Skim/Read controls with `aria-pressed` selected states.
- A semantic faults table with row headers and labelled stacked cells on small screens.
- Natural image framing, descriptive image alternatives and normal full-size links.
- Blocked browser storage is caught so it cannot stop the page from running.
- With JavaScript disabled, the walkthrough panels stack and content stays available.
- A print stylesheet produces a compact readable document.

## Local development

Any static server works:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. There is no package install or build command.

With Node.js installed, run the interaction checks without installing packages:

```bash
node --check js/site.js
node --test tests/site.test.cjs
```

The tests exercise the actual site script with deterministic clocks and a small
DOM harness. Browser captures and the limits of verification are documented in
[`docs/astra-portfolio-improvement/REVIEW.md`](docs/astra-portfolio-improvement/REVIEW.md).

## To do

- Replace illustrative telemetry and rules with sanitised real examples when
  detection-rule development resumes.
- Add `/writing/` once the first posts are drafted.

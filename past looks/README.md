# Past looks

This archive keeps before-and-after screenshots of changes to the portfolio. It is not linked from the site and is excluded from the optional `dist/` build. GitHub Pages currently serves the repository root, so the archived files are publicly accessible along with the rest of the repository.

Each dated folder describes a change and contains separate `before` and `after` folders. The default capture includes the full homepage, opening, selected project and QUT research details, plus the evidence journey and quick index when present; the `projects` profile captures a selected project, the ITDR evidence and the learning example. Both use desktop (1440 × 900) and phone (390 × 844) sizes, the light theme and reduced motion to make settled designs easier to compare. The explicitly named `tray-shatter` captures show a moment of animation with reduced motion turned off. The targeted project captures hide fixed page elements so they do not cover the section.

For a future change, install the project's development dependencies and Playwright's Chromium, then run the following before editing and again after editing, replacing the example folder name:

```sh
node tools/capture-past-looks.cjs 2026-11-19-example before
node tools/capture-past-looks.cjs 2026-11-19-example after
```

For the project and ITDR sections, add `projects` after `before` and `after` in those commands. Use `signals` to capture the desktop pointer effect at rest, on approach, inside the desk and on return, plus a reduced-motion phone view. Use `liquid` to capture the gathering, settled, fast-moving and selected states of the pointer effect.

Use a new dated folder for each change. Existing captures are never overwritten. If the standard preview port is occupied, set `SNAPSHOT_PORT` to another local port. To use a locally installed Chrome, set `BROWSER_CHANNEL=chrome`.

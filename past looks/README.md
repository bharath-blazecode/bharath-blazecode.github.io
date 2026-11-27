# Past looks

This archive keeps before-and-after screenshots of changes to the portfolio. It is not linked from the site and is not part of the published `dist/` build.

Each dated folder describes a change and contains `before` and `after` folders. Captures use desktop (1440 by 900) and phone (390 by 844) sizes, the light theme and reduced motion, so settled designs are easy to compare. Each capture holds the opening screen, the full homepage, Selected work and Research.

For a future change, install the development dependencies and Chromium, then run this before editing and again after editing, replacing the example folder name:

```sh
node tools/capture-past-looks.cjs 2027-01-15-example before
node tools/capture-past-looks.cjs 2027-01-15-example after
```

Use a new dated folder for each change. Existing captures are never overwritten. If the capture port is in use, set `SNAPSHOT_PORT` to another local port. To use a locally installed Chrome, set `BROWSER_CHANNEL=chrome`.

Folders dated 19 and 20 November 2026 were made with an earlier version of the tool and include extra views of features that have since been retired.

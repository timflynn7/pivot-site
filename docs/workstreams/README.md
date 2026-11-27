# Workstreams

Each workstream has its own brief. Work on one per Claude session, and update its brief before ending.

| # | Workstream | Brief | Status |
| --- | --- | --- | --- |
| 1 | Website content and layout | [website.md](website.md) | **Active.** 24 Nov: Tim's page notes done on branch (Shop menu, terms, story, configurator steps, measurements, arched pairs, test page). Waiting on pictures |
| 2 | Visualiser | [visualiser.md](visualiser.md) | Not started |
| 3 | Door designs and DXF engine | [designs.md](designs.md) | **Active.** 18 drafts; moulding and round-over designs need rework |
| 3a | Toolpath lab: moulding toolpath and round-over bits | [toolpath-lab.md](toolpath-lab.md) | **Active.** Proven settings go back into designs.md |
| 4 | Orders and payments | [orders.md](orders.md) | **Active.** **Live**: real payments, emails, terms. 27 Nov: hinge-hole charge and discount codes built on a branch, waiting for Tim to try them |
| 5 | Business setup | [business.md](business.md) | Open questions |
| 6 | Trade portal | [trade-portal.md](trade-portal.md) | Backlog: Tim's idea of a password-protected trade page with discounted online ordering (24 Nov 2026) |

**The prioritised list of everything still open is in [../BACKLOG.md](../BACKLOG.md).**

## Starting a session

Start a new Claude Code session with the `timflynn7/pivot-site` repository selected, and name it after the workstream (e.g. "Pivot – Website content"). Open with:

> Work on the **website** workstream. Read docs/workstreams/website.md.

Links to everything are in [../LINKS.md](../LINKS.md).

## Where they overlap

- Website ↔ Visualiser: the visualiser lives on the design and configurator pages.
- Designs ↔ Orders: orders store a spec with an engine version, so changing a recipe must not break old orders. Bump `VERSION` in engine.js when geometry changes meaningfully.
- Business ↔ Designs: pricing by machining time needs VCarve time estimates per design.

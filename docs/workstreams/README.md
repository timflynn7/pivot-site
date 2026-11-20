# Workstreams

Each workstream has its own brief. Work on one per Claude session, and update its brief before ending.

| # | Workstream | Brief | Status |
| --- | --- | --- | --- |
| 1 | Website content and layout | [website.md](website.md) | **Active.** Holding pages live; needs compelling content |
| 2 | Visualiser | [visualiser.md](visualiser.md) | Not started |
| 3 | Door designs and DXF engine | [designs.md](designs.md) | **Active.** 18 drafts; moulding and round-over designs need rework |
| 3a | Toolpath lab: moulding toolpath and round-over bits | [toolpath-lab.md](toolpath-lab.md) | **Active.** Proven settings go back into designs.md |
| 4 | Orders and payments | [orders.md](orders.md) | **Active.** Database and Stripe payment links built on a branch; Tim to set up Stripe, then merge |
| 5 | Business setup | [business.md](business.md) | Open questions |
| 6 | Trade portal | [trade-portal.md](trade-portal.md) | Later |

## Starting a session

Start a new Claude Code session with the `timflynn7/pivot-site` repository selected, and name it after the workstream (e.g. "Pivot – Website content"). Open with:

> Work on the **website** workstream. Read docs/workstreams/website.md.

Links to everything are in [../LINKS.md](../LINKS.md).

## Where they overlap

- Website ↔ Visualiser: the visualiser lives on the design and configurator pages.
- Designs ↔ Orders: orders store a spec with an engine version, so changing a recipe must not break old orders. Bump `VERSION` in engine.js when geometry changes meaningfully.
- Business ↔ Designs: pricing by machining time needs VCarve time estimates per design.

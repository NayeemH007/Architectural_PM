# ArchIntel · Project control for design studios

ArchIntel is the **central project-control system** for an architecture / interior-design studio. It keeps every project moving through its phases — files, drawings, approvals, client communication and payments in one workspace — **without replacing** the design tools the team already uses (AutoCAD, SketchUp, D5 Render, InDesign, Word, Excel).

Built and tailored for **SPACE ESSE** (interior design studio, Dhaka) from a discovery meeting: their real 4-phase workflow, design & material approvals with the founder as final approver, WhatsApp client approvals, phase-based payments, a file register, a searchable archive, a firm-level finance hub, and an AI **Risk Radar** that flags risks before they happen.

## Repository layout

| Folder | What it is |
|---|---|
| [`app/`](app/) | The **ArchIntel frontend** — React + TypeScript + Vite + Tailwind. The live product demo. |
| [`docs/`](docs/) | System documentation (describes the earlier *Practice Intelligence* analytics concept — see note below). |
| [`blueprint/`](blueprint/) | The original product & build blueprint. |

> **Note on direction:** the app pivoted from a building-architecture *analytics* concept (“Practice Intelligence”) to **ArchIntel**, a *project-control* system shaped by the Space Esse meeting. `docs/` and `blueprint/` document the earlier concept; the live `app/` is ArchIntel.

## Run

```bash
cd app
pnpm install      # first time
pnpm dev          # → http://localhost:5173
```

`pnpm build` → static `dist/` (host on Vercel/Netlify; SPA rewrite included in `app/vercel.json`). Shortcuts: **⌘K/Ctrl+K** command palette · **⌘J/Ctrl+J** AI Risk Radar.

## What's inside (frontend prototype, mock data)

- **Onboarding** — studio sign-up + a 4-step setup wizard.
- **Dashboard** — management overview: blockers, pending approvals, overdue payments, team workload, and top AI risk flags.
- **Project workspace** — one hub per project with the studio's **4 phases & checklists** (with gate rules), files, approvals, client comms, payments, decisions and activity.
- **Approvals** — design & material approval inbox (founder = final approver) + client (WhatsApp) approval log.
- **Files** — firm-wide register (owner · storage · version · date · status) that flags single-person/local-PC dependencies.
- **Finance** — income vs expense, receivables (phase-based payment tracker), expenses, per-project profitability.
- **AI Risk Radar** — proactive, pattern-based risk flags that learn the studio over time (preview; real learning is backend).
- **Clients · Archive · Team · Activity · Settings**.

> Prototype: all data is realistic **mock data** behind a swappable API layer (`app/src/lib/archintel/`). No backend yet — when backend work starts it will live in a **separate repository** so it can't affect this live demo.

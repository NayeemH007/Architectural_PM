# SPACE ESSE · Practice Intelligence

An **AI-powered reporting & analytics platform** for an architecture practice — a read-first intelligence layer that sits *above* the tools a firm already uses (accounting, files, email, calendar, manual capture) and turns scattered, mostly-uncaptured operational reality into trustworthy KPIs, dashboards, authority-approval tracking and **cited** AI insights.

Built around **SPACE ESSE** (Dhaka, Bangladesh) as the pilot firm. It integrates with existing systems rather than replacing them, and every number is traceable to a source — the AI refuses to answer when the data isn't there.

## Repository layout

| Folder | What it is |
|---|---|
| [`app/`](app/) | The **frontend prototype** — React + TypeScript + Vite + Tailwind. 24 routes, realistic mock data, swappable API layer. This is the live product demo. |
| [`blueprint/`](blueprint/) | The **product & build blueprint** (~61k words): industry research, software ecosystem, data + integration architecture, KPI dictionary, AI reporting design, MVP scope, roadmap, pilot plan, security, costs. Start at [`blueprint/00-BLUEPRINT.md`](blueprint/00-BLUEPRINT.md). |

## Run the app

```bash
cd app
pnpm install      # first time only
pnpm dev          # → http://localhost:5173
```

`pnpm build` produces a static `dist/` you can host anywhere (Vercel / Netlify / S3+CDN — see [`app/README.md`](app/README.md)). Shortcuts: **⌘K / Ctrl+K** command palette, **⌘J / Ctrl+J** AI assistant.

## Highlights

- **Section dashboards** — Executive, Delivery & Operations, Financials, Profitability, Resourcing, Clients, Portfolio analytics, Document Control.
- **Bangladesh-real finance** — net cash modelled through 15% VAT, VDS and ~10% AIT/TDS withholding; BDT-native.
- **Authority approvals** (RAJUK, FSCD, CAAB, DoE, utilities) as first-class, schedule-driving milestones.
- **Trust by design** — every metric carries a confidence level, a "Why this number?" provenance trail and a data-completeness score; missing data is shown as *insufficient*, never fabricated.
- **Manual capture** as a first-class connector (the highest-value data lives in WhatsApp/phone/paper).
- **Intelligence** — cited AI reports & briefings, a review/sign-off queue, scheduled reports, an audit/activity log, and natural-language Q&A.

> Prototype: all data is realistic **mock data**. The API layer (`app/src/lib/api.ts`) is built to swap onto a real backend without touching components.

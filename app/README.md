# SPACE ESSE · Practice Intelligence

The reporting & analytics layer above an architecture firm's existing tools — KPIs, dashboards, cited AI insights, authority-approval tracking and manual capture. Built for **SPACE ESSE** (Dhaka).

> Frontend prototype. All data is realistic **mock data** served through a swappable API layer (`src/lib/api.ts`) — every read goes through one `resolve()` you replace with `fetch()` to wire a real backend. No backend or API keys required to run.

## Stack
React + TypeScript + Vite · Tailwind v4 · React Router · TanStack Query · Recharts · Radix UI · Framer Motion. Light "Atelier" theme. Type: Schibsted Grotesk + JetBrains Mono (figures) + Hind Siliguri (বাংলা).

## Run locally
```bash
pnpm install      # first time only
pnpm dev          # → http://localhost:5173
```
Other scripts: `pnpm build` (production build → `dist/`), `pnpm preview`, `pnpm typecheck`.

Shortcuts: **⌘K / Ctrl+K** command palette · **⌘J / Ctrl+J** AI assistant.

## Publish online
It's a static SPA — build and host the `dist/` folder anywhere.

- **Vercel:** import the repo, set root to `app/`, framework **Vite**, build `pnpm build`, output `dist`.
- **Netlify:** base `app/`, build `pnpm build`, publish `app/dist`. Add a SPA redirect `/* /index.html 200` (e.g. a `public/_redirects` file) so client routes resolve on refresh.
- **Any static host / S3 + CDN:** upload `dist/`; configure a catch-all rewrite to `index.html` for client-side routing.

## Structure
```
src/
  lib/        types, mock data (mock/), api hooks, formatters, nav
  components/  ui/ (primitives) + shared (KpiCard, trust, charts, status, data-source, shell/)
  pages/       24 routes (dashboards, finance, clients, intelligence, data & setup)
```

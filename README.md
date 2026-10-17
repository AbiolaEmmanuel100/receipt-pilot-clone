# Receipt Pilot-C

A modern, offline-first small-business management application (receipts, product catalogue, inventory, sales, expenses, reports).

**This is a completely separate project.** The original `AbiolaEmmanuel100/Receipt-Pilot` repository is used only as a read-only reference and is never modified.

## Current status

- Stage 2 foundation complete (design system, navigation, receipt builder, IndexedDB)
- Stage 3A complete (HTML escaping fix + product catalogue)
- Stage 3B complete (stock movements, restock, adjustments, physical count reconciliation)
- Visual redesign complete (premium layout, design system, all screens)
- Phase 1 scope and roadmap: `docs/PHASE-1-SCOPE-AND-ROADMAP.md`

## Required software

- Node.js 18+ (20 recommended)
- npm 9+
- A modern browser (Chrome, Firefox, Safari, Edge)

No database server is required for Stage 3A. Data is stored in the browser via IndexedDB.

## Setup

```bash
cd frontend
npm install
```

## Run tests

```bash
cd frontend
npm test
```

## Build

```bash
cd frontend
npm run build
```

Output is written to `frontend/dist/`.

## Start locally

```bash
cd frontend
npm run dev
```

Then open the URL shown (usually `http://localhost:5173`).

## Project layout

```
receipt-pilot-c/
├── README.md                 # this file
├── docs/                     # vision, design, stage reports
├── frontend/                 # Vite + TypeScript app
│   ├── index.html
│   ├── src/                  # calculations, storage, products, UI
│   └── tests/
└── worker/                   # Cloudflare Worker skeleton (not required for Stage 3A)
```

## Boundaries

- No connection to the original Supabase project, Worker, or Paystack.
- No production SQL, deploy, or push without explicit approval.
- Guest/offline first. No secrets are included in this project.

## Release notes

See `docs/VISUAL-REDESIGN-REPORT.md` for the latest visual release notes.

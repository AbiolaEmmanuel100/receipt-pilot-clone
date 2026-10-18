# Visual Redesign Phase 2 — Report

**Date:** 2026-10-17  
**Status:** Complete. Reviewable. No deploy or push.

## New identity

Deep indigo navigation, violet primary actions, cool light workspace, Manrope type, orange/amber/red/green status colours with text labels (not colour alone). Applied across every existing screen.

## Tables

| Screen | Table | Notes |
|--------|-------|-------|
| Dashboard | Recent receipts | Number, date, customer, total, status. Top 5 only. |
| Receipts | Saved receipts | Number, date, customer, total, method, status, edit/delete. Search, sort, pagination. |
| Products | Catalogue | SKU, name, category, selling, cost, qty, low-stock threshold, status, actions. Search, sort, pagination. Out of stock / low stock labelled in text. |
| Restocking | Movement ledger | Date, product, type, signed change, reason, current stock. Type filter, sort, pagination. Current stock is the product’s present quantity — not a reconstructed historical balance. |
| Expenses / Customers / Reports / Sales | Empty states | No data model yet. Explicitly unavailable, not zero. No sample rows saved. |

## Preserved

Receipt math, IndexedDB schema and upgrade, product and movement logic, HTML escaping, offline behaviour. No records deleted or migrated.

## Tests actually run

esbuild + Node: line total, 7.5% tax, escape, negative stock, count variance — **5 passed, 0 failed**.

Full `npm test` and `vite build` were **not** run (sandbox restriction). Browser visual check was **not** performed here.

## Files changed

- `frontend/src/styles/main.css`
- `frontend/index.html`
- `frontend/src/main.ts` (table rendering, search, sort, pager)
- `README.md`, `docs/README.md`
- `docs/VISUAL-REDESIGN-PHASE-2-REPORT.md`

## Limitations

- No browser inspection in this environment.
- Expenses, customers, and reports remain empty until those models exist.
- Movement table does not show a historical running balance (by design).

## Rollback

Restore the three frontend files from the previous visual redesign archive.

## Archive

`receipt-pilot-c-visual-redesign-phase-2.zip` — complete project, verified, no `node_modules` or secrets.

# Stage 3B Report — Stock Tracking and Inventory Movements

**Date:** 2026-10-17  
**Status:** Complete. Stopped for review.

## Features added

- Auditable stock movements with unique id, product id, type, signed quantity change, timestamp, and reason.
- Movement types: OPENING, RESTOCK, ADJUSTMENT, COUNT.
- Physical stock-count reconciliation: user enters counted quantity; system records the variance.
- Validation prevents zero changes, negative restock/opening, missing reasons, and balances that would go negative.
- Product current stock is updated in the same IndexedDB transaction as the movement.
- Opening movement recorded when a product is created with stock.
- Adjustment movement recorded when stock is edited on the product form (validated first).
- Movement history list on the Restocking page.
- IndexedDB version 3 adds `stockMovements` store. Existing receipts and products are preserved.

## Not in this stage

- Automatic stock deduction from receipts
- Supplier purchasing workflows
- Returns, damage types beyond generic adjustment
- Multi-user sync

## Tests actually run

esbuild + Node (full Vitest/Vite not reliably runnable in this sandbox):

```
18 passed, 0 failed
```

Covered: quantity apply, negative rejection, movement sum, restock validation, zero/missing reason, negative restock, negative stock prevention, count reconciliation (up/down/same/invalid), consistency check, expected closing formula, receipt calculation regression, HTML escape regression.

Full `npm test` and `vite build` were **not** run (prior symlink/EPERM restriction).

## Build

Not run in this environment. In a normal environment:

```bash
cd frontend
npm install
npm test
npm run build
npm run dev
```

## Files changed

- `frontend/src/types.ts` — StockMovement, StockMovementType, StockMovementInput
- `frontend/src/stock.ts` (new) — pure stock logic
- `frontend/src/storage.ts` — DB v3, movements store, recordMovementAndUpdateStock
- `frontend/src/main.ts` — movement UI, opening/adjustment on product save
- `frontend/index.html` — Restocking page form and history
- `frontend/tests/stock.test.ts` (new)
- `docs/STAGE-3B-REPORT.md` (this file)
- `README.md` — status

## Known limitations

- Receipts do not yet deduct stock.
- Existing Stage 3A products that were created before movements will not have an opening movement until stock is next changed. Their current quantity remains as stored.
- Movement history shows the latest 50 entries.
- IndexedDB upgrade not exercised in a browser here.
- No automated browser tests.

## How to revert

Restore the files listed above to the Stage 3A state, or remove `stock.ts` and `stock.test.ts` and reverse the edits. The DB version bump does not delete receipts or products. Original Receipt-Pilot repository was not modified.

## Archive

`receipt-pilot-c-stage-3b.zip` contains the complete updated project (excluding node_modules, caches, and secrets).

---

**Stopped after Stage 3B. Waiting for approval before the next stage.**

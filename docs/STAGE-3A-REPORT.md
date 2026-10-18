# Stage 3A Report — Security fix + Product Catalogue

**Date:** 2026-10-17  
**Status:** Complete. Stopped for review.

## Step 1 — HTML escaping fix

- Extracted `escapeHtml` to `frontend/src/escape.ts`.
- Encodes `&`, `<`, `>`, `"`, and `'` via runtime entity construction so the source is not corrupted by markup processors.
- `main.ts` now imports it. All `innerHTML` paths that interpolate user data (receipt preview, dashboard recent, records list, product list) use `escapeHtml`.
- Attribute values that come from user/product data are also escaped.
- Regression tests in `frontend/tests/escape.test.ts` cover ampersands, script tags, quotes, and mixed HTML-like input.

## Step 2 — Stage 3A Product Catalogue

- `Product` and `ProductInput` types added (id, sku, name, category, selling/cost prices in cents, manual stockQty, lowStockThreshold, active, timestamps).
- IndexedDB version bumped to 2. `onupgradeneeded` creates the `products` store only if missing. Existing `receipts` store is left intact.
- Products page: list, search, add, edit, soft-deactivate, validation messages, empty state.
- Dashboard low-stock count uses active products where `stockQty <= lowStockThreshold`.
- Pure helpers in `frontend/src/products.ts` (validation, low-stock, form parsing) with unit tests.
- No stock deduction, movements, suppliers, reconciliation, or receipt-to-product linking.

## Tests actually run

Via esbuild + Node (sandbox cannot reliably run full Vitest/Vite into the workspace):

```
18 passed, 0 failed
```

Covered: escape (amp, script, quotes, mixed, null, plain), product validation (required name, negatives, duplicate SKU), low-stock count (active only), form parse, SKU normalize, receipt calculation regression.

Full `npm test` and `vite build` were **not** run in this environment (prior symlink/EPERM restriction).

## Build

Not run. Configuration unchanged. In a normal environment:

```bash
cd frontend
npm install
npm test
npm run build
```

## Files changed

- `frontend/src/escape.ts` (new)
- `frontend/src/products.ts` (new)
- `frontend/src/types.ts` (Product, ProductInput)
- `frontend/src/storage.ts` (DB v2, products CRUD, soft deactivate)
- `frontend/src/main.ts` (import escape, product UI, dashboard low-stock)
- `frontend/index.html` (products page, low-stock metric id)
- `frontend/tests/escape.test.ts` (new)
- `frontend/tests/products.test.ts` (new)
- `docs/STAGE-3A-REPORT.md` (this file)

## Known limitations

- Stock quantity is manual only.
- Receipt items remain free-text (no productId).
- Soft-deactivated products are hidden from the active list; no restore UI yet.
- IndexedDB upgrade not exercised in a browser in this environment.
- No automated browser tests.

## How to revert

Restore the files listed above from the previous Stage 2 state, or remove the new files and revert the edits. Existing receipts in IndexedDB are not deleted by the version bump. Original Receipt-Pilot repository was not modified.

---

**Stopped after Stage 3A. Waiting for approval before Stage 3B.**

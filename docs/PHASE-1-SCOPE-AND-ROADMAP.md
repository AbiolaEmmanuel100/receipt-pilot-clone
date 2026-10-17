# Receipt Pilot-C — Master Product Vision, Phase 1 Scope & Roadmap

**Date:** 2026-10-17  
**Status:** Planning complete. No implementation of new modules in this step.  
**Reference:** Original AbiolaEmmanuel100/Receipt-Pilot is read-only. Never modified.  
**Current code base:** Stage 2 foundation (design system, navigation shell, dashboard sample, receipt builder with cents-based calculations and IndexedDB).

---

## 1. Master Product Vision

Receipt Pilot-C is a modern, offline-capable small-business management platform designed for owners who may have little or no accounting or technical knowledge.

It combines receipt generation, point-of-sale checkout, product and inventory control, daily stock reconciliation, customer and supplier records, expense tracking, and practical financial reporting into one coherent, easy-to-use application.

**Core principles**

- Make complex business information simple and trustworthy.
- Distinct, polished commercial SaaS experience (do not reproduce the original Receipt Pilot UI).
- Guest/offline first where safe; reliable path to authenticated cloud synchronisation.
- Financial and stock integrity: never double-count revenue, expenses, purchases, debt repayments, or stock movements.
- Modular, testable, incremental delivery. No live billing or production connections without explicit approval.

---

## 2. Phase 1 Scope

Phase 1 delivers a useful, polished first release that a small-business owner can run daily.

### Essential (must ship in Phase 1)

| Area | Essential features |
|------|--------------------|
| Dashboard | Daily activity overview, key figures (sales, cash, outstanding, low stock), alerts, quick actions |
| Receipts & POS | Create, edit, history, print, PDF/PNG export, share; POS-style checkout; paid / partial / unpaid; payment methods |
| Corrections | Discounts, returns, exchanges, refunds, voids; safe edit/void that reverses prior effects exactly once |
| Products & Inventory | Catalogue (name, SKU/code, category, selling price, cost price, stock qty, low-stock threshold); opening stock; restock; adjustments (damage/missing/etc.); physical count + reconciliation; low-stock alerts |
| Customers | Records, purchase history, outstanding balances |
| Suppliers & Purchases | Supplier records, purchase/restock records, goods received, history |
| Expenses | Track operating expenses by category and date |
| Reports | Daily / weekly / monthly / custom period; revenue, cash received, customer debt, discounts, refunds, COGS, gross profit, operating expenses, estimated net profit; stock valuation and discrepancies; CSV export |
| Usability | Search, filters, date ranges, sorting, empty states, clear validation and errors; mobile-responsive; accessible (contrast, keyboard, labels, focus) |
| Setup & Auth | Guided first-time setup; secure authentication; basic user permissions (owner vs staff later if needed) |
| Offline & Sync | Offline-capable core operations where safe; reliable synchronisation; duplicate prevention; activity history; backup/recovery planning |

### Optional / deferred within Phase 1 (nice-to-have if time remains)

- Multiple visual receipt templates (structure ready; classic first)
- Advanced barcode scanning (basic SKU entry is enough)
- Multi-currency beyond selection
- Detailed audit log UI (activity history is essential; rich viewer can be lighter)
- Staff roles beyond single owner (can start with single authenticated user)

---

## 3. Later Phases Roadmap

| Phase | Focus | Key capabilities |
|-------|-------|------------------|
| **Phase 2** | Growth tools | Promotions, loyalty programmes, advanced barcode workflows, staff shifts |
| **Phase 3** | Advanced purchasing & notifications | Advanced supplier purchasing, automated notifications |
| **Phase 4** | Analytics & online presence | Advanced analytics, online catalogues, customer ordering, delivery management |
| **Phase 5** | Scale & integrations | Optional online payments, multi-branch management, advanced staff controls, third-party integrations |
| **Phase 6** | Intelligence | AI business assistance, demand forecasting, workflow automation |

These are explicitly out of Phase 1. Architecture must not block them, but they are not implemented now.

---

## 4. Feature-Dependency Map

```
Business Profile / Guided Setup
        │
        ▼
Authentication + Guest/Offline local store
        │
        ├─► Product Catalogue ──► Stock Movements ──► Daily Reconciliation
        │         │                      │
        │         └─► Low-stock alerts   └─► Stock reports
        │
        ├─► Customer Records ──► Customer Balances
        │
        ├─► Supplier Records ──► Purchases / Restocks ──► Stock Movements
        │
        ├─► Receipt / POS ──► Payments (cash collection, not new sale)
        │         │
        │         ├─► Stock deduction (on finalise)
        │         ├─► Customer debt (unpaid/partial)
        │         └─► Revenue recognition
        │
        ├─► Returns / Refunds / Voids ──► Reversing stock + revenue effects
        │
        ├─► Expenses
        │
        └─► Reports (depend on all of the above being consistent)
```

**Critical dependency rules**

- Stock movements are the single source of truth for quantity changes.
- Finalising an ACTIVE receipt creates SALE movements once.
- Editing a receipt reverses previous movements then applies new ones.
- Void / refund creates compensating movements and excludes the document from revenue.
- Payments never create sales or stock movements.
- Purchases create RESTOCK movements and optionally supplier balances; they are not operating expenses.
- Reports read from the above records; they do not invent quantities or money.

---

## 5. Proposed Data Model (Database-Independent)

All money in integer minor units (cents). Timestamps ISO 8601. IDs UUID-style strings.

### Core entities

- **BusinessProfile** — id, name, address, phone, email, website, logo, footer, currency, receiptPrefix, createdAt, updatedAt
- **User** — id, email, role (owner | staff), linked to auth provider later
- **Product** — id, sku, name, category, sellingPriceCents, costPriceCents, lowStockThreshold, active, createdAt, updatedAt  
  *(currentStockQty is derived from StockMovement sum or cached with care)*
- **StockMovement** — id, productId, type (OPENING | RESTOCK | SALE | RETURN | DAMAGE | MISSING | TRANSFER | PERSONAL_USE | ADJUSTMENT | COUNT_CONFIRM), quantity (signed), unitCostCents?, relatedDocumentId?, relatedDocumentType?, date, notes, createdAt, idempotencyKey
- **Customer** — id, name, phone, email, notes, createdAt, updatedAt  
  *(balanceCents derived)*
- **Supplier** — id, name, phone, email, notes, createdAt, updatedAt
- **Receipt** — id, receiptNumber, status (ACTIVE | VOID | REFUNDED), businessSnapshot, customerId?, customerSnapshot, items[], discountCents, taxPercent, taxCents, subtotalCents, totalCents, amountPaidCents, balanceDueCents, paymentStatus, paymentMethod, currency, receiptDate, notes, templateId, createdAt, updatedAt, voidedAt?, refundedAt?
- **ReceiptItem** — id, receiptId, productId?, name, quantity, unitPriceCents, costPriceCentsAtSale?, lineTotalCents
- **Payment** — id, type (CUSTOMER | SUPPLIER), relatedId, amountCents, method, date, notes, createdAt  
  *(does not create a sale)*
- **Purchase** — id, supplierId?, date, items[{productId, qty, unitCostCents}], totalCostCents, notes, createdAt
- **Expense** — id, category, amountCents, date, description, notes, createdAt
- **DailyReconciliation** — id, date, openingSnapshot, expectedClosing, actualClosing (user), variance, confirmed, confirmedAt
- **ActivityLog** — id, entityType, entityId, action, userId?, timestamp, summary (for history and debugging sync)

### Financial measures (computed, never stored as source of truth)

- Revenue = sum of totalCents of ACTIVE receipts in period (after discounts; tax treatment documented)
- Cash received = sum of CUSTOMER payments in period (includes collections on old debt)
- Customer debt = sum of positive balanceDueCents on ACTIVE receipts
- COGS = sum of (qty sold × costPriceCentsAtSale or current cost) for items with known cost
- Gross profit = revenue − COGS
- Operating expenses = sum of Expense.amountCents
- Estimated net profit = gross profit − operating expenses
- Stock valuation = sum of on-hand × costPriceCents (only where cost known)

**Integrity rules**

- Idempotency keys or unique movement records prevent duplicate stock deductions on edit, sync, or retry.
- Soft-delete or status flags (VOID/REFUNDED) rather than hard delete for financial documents.
- Later updatedAt wins for sync conflicts; deletes are tombstoned.

---

## 6. Recommended Implementation Sequence

Each stage ends with tests, a short report (files changed, tests run, outstanding issues, revert instructions), and a review checkpoint. Do not start the next stage without approval.

| Stage | Scope | Testing & acceptance criteria |
|-------|-------|-------------------------------|
| **2 (done)** | Design system, navigation, dashboard shell, receipt builder + IndexedDB, cents calculations | Calculation unit tests pass; UI renders; receipts persist locally |
| **3** | Product catalogue (local), basic stock quantity, low-stock indicator | Create/edit/list products; stock qty updates on manual adjustment; tests for product validation |
| **4** | Stock movements model, deduction on receipt finalise, reverse on edit/void, restock recording | Unit tests: finalise once, edit reverses+applies, void restores; no double deduction; reconciliation formula tests |
| **5** | Daily reconciliation flow (opening, expected vs actual, confirm, carry-forward) | Tests for expected closing formula; user can enter actual count; next day opening correct |
| **6** | Customers, outstanding balances, payments (collections do not create sales) | Tests: unpaid receipt creates debt; payment reduces debt without new revenue; history visible |
| **7** | Suppliers, purchases/restocks, goods received linked to stock movements | Tests: purchase creates RESTOCK movement and does not appear as operating expense |
| **8** | Expenses + core reports (revenue, cash, debt, COGS, gross/net estimates, stock valuation) | Report calculations match known fixtures; CSV export works; estimates clearly labelled |
| **9** | Returns, exchanges, refunds, safe corrections | Tests: refund reverses stock and revenue; exchange handles both sides; no double effects |
| **10** | PDF/PNG export, sharing, print polish, multiple templates | Manual verification of output; share link structure (local or stub) |
| **11** | Guided setup, Supabase auth (dev project only), offline → sync with conflict and idempotency rules | Auth flow works against non-production project; sync does not duplicate movements or revenue |
| **12** | Accessibility pass, mobile polish, empty states, error handling, activity history, backup notes | Keyboard navigation, contrast, focus visible; critical paths usable on mobile |
| **13** | PWA / service worker, final Phase 1 acceptance | Offline core works; installable; all Phase 1 essential criteria met |

**Stage 3 is the next recommended implementation step** after approval.

---

## 7. Architecture & Safety (unchanged)

- Stack: HTML, CSS, TypeScript, Vite; Supabase/PostgreSQL; TypeScript Cloudflare Worker where secure operations are required; Vitest for unit tests.
- No React unless a clear, justified need arises.
- Original repository and its production services remain completely untouched.
- No production secrets, no connection to original Supabase/Worker/Paystack, no production SQL, no deploy or push without explicit approval.
- No live billing in Phase 1.
- Do not claim features work until implemented and tested.

---

## 8. Files Changed in This Planning Step

- `docs/PHASE-1-SCOPE-AND-ROADMAP.md` (this document — new)
- `docs/README.md` (updated index)
- `docs/PRODUCT-VISION.md` (light update to point to this master document)
- `README.md` (status note)

No application code, tests, or configuration were modified.

---

## 9. Unresolved Risks & Decisions

| Item | Notes |
|------|-------|
| Single vs multi-user in Phase 1 | Recommend single owner account first; staff roles can be Phase 2. |
| Cost price at time of sale | Store costPriceCentsAtSale on ReceiptItem for accurate historical COGS when prices change. |
| Tax treatment in reports | Decide whether revenue is tax-inclusive or exclusive and document it consistently. |
| Sync conflict resolution | Later updatedAt wins + tombstones; movement idempotency keys required. |
| PDF/PNG library | Choose lightweight client-side option when implementing Stage 10; avoid heavy dependencies until needed. |
| Supabase project | Must be a new/dev project; never the original production project. |
| Offline scope | Core receipt + product + stock operations offline; complex reports can require sync. |
| Currency | Single business currency recommended for Phase 1; multi-currency later. |

---

**Planning step complete. Stopped for approval before any further implementation.**

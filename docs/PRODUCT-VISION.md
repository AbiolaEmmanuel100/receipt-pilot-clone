# Receipt Pilot-C — Product Requirements & Updated Plan

**Date:** 2026-10-17  
**Status:** Superseded in part by the master planning document.  
**See:** [docs/PHASE-1-SCOPE-AND-ROADMAP.md](./PHASE-1-SCOPE-AND-ROADMAP.md) for the current Phase 1 scope, later-phase roadmap, data model, dependency map, and implementation sequence.

**Reference:** AbiolaEmmanuel100/Receipt-Pilot (read-only only). Original repository is never modified.

## 1. Product Vision

Receipt Pilot-C evolves from a basic receipt generator into a modern, easy-to-use small-business management application for owners who may have little or no accounting or technical knowledge.

It combines:

- Receipt generation and management
- Product and inventory management
- Daily stock tracking and reconciliation
- Sales recording and reporting
- Purchases, restocking and supplier records
- Business expenses
- Customer balances and payment tracking
- Financial summaries and accounting analysis

**Core principle:** Make complex business information simple, clear, and trustworthy. The interface must feel like a quality commercial SaaS product, not a form-based receipt tool.

**Distinct from original:** Do not reproduce the original Receipt Pilot interface. Design a substantially better, more polished experience while preserving proven business rules from the reference where they remain valid.

## 2. Target Users

Small-business owners (retail, service, informal trade) who need to:

- Create professional receipts quickly
- Know what they sold today / this week / this month
- Track what stock they have and what is missing
- Understand roughly how much money they made after costs
- See who still owes them money

They should not need to understand double-entry accounting.

## 3. Domain Model (Database-Independent)

Core entities (all timestamps in ISO 8601, money in integer minor units / cents):

- **BusinessProfile** — name, address, phone, email, website, logo, footer, default currency, receipt prefix.
- **Product** — id, sku/code, name, category, sellingPriceCents, costPriceCents, currentStockQty (derived or cached), lowStockThreshold, active flag.
- **StockMovement** — id, productId, type (OPENING | RECEIPT | SALE | RESTOCK | DAMAGE | MISSING | RETURN | TRANSFER | PERSONAL_USE | ADJUSTMENT | COUNT_CONFIRM), quantity (signed: +in / −out), unitCostCents (optional), relatedDocumentId (receiptId / purchaseId), date, notes, createdAt.
- **Receipt** — id, receiptNumber, business snapshot, customerId or inline customer, items[], discountCents, taxPercent, taxCents, subtotalCents, totalCents, amountPaidCents, balanceDueCents, paymentStatus (UNPAID | PARTIAL | PAID), paymentMethod, currency, receiptDate, notes, templateId, status (ACTIVE | VOID | REFUNDED), createdAt, updatedAt.
- **ReceiptItem** — productId (optional for free-text), name, quantity, unitPriceCents, lineTotalCents.
- **Customer** — id, name, phone, email, notes, balanceCents (derived from unpaid receipts and payments).
- **Payment** — id, type (CUSTOMER_PAYMENT | SUPPLIER_PAYMENT), relatedId, amountCents, method, date, notes. Does **not** create a new sale.
- **Purchase / Restock** — id, supplierId (optional), date, items[{productId, qty, unitCostCents}], totalCostCents, notes.
- **Expense** — id, category (Rent | Transport | Electricity | Wages | Other), amountCents, date, description, notes.
- **DailyReconciliation** — date, openingStock snapshot, movements summary, expectedClosing, actualClosing (user-entered), variance, confirmed flag, confirmedAt.
- **Sale** — conceptual; a finalized ACTIVE receipt generates SALE stock movements and contributes to revenue. Editing or voiding reverses the previous effect.

**Financial distinctions (never conflate):**

- Revenue = sum of totalCents of ACTIVE receipts in period (net of discounts/tax as appropriate).
- Cash collected = sum of payments received (including later collections on old debt).
- Customer debt = outstanding balanceDueCents on ACTIVE unpaid/partial receipts.
- Cost of goods sold = sum of (quantity sold × costPriceCents) for items with known cost.
- Gross profit = revenue − COGS.
- Operating expenses = sum of Expense.amountCents.
- Estimated net profit = gross profit − operating expenses.
- Stock valuation = sum of current stock × costPriceCents (only where cost is known).

Stock purchases increase inventory (and optionally supplier balance); they are **not** recorded as immediate operating expenses. Customer debt collection is **not** a new sale. Refunds and voids reverse the original revenue and stock effects.

## 4. Stock & Reconciliation Rules

**Expected closing stock**  
= opening stock  
+ stock received (restocks)  
− units sold (from finalized ACTIVE receipts)  
− other recorded reductions (damage, missing, transfer, personal use, etc.)  
+ eligible returns.

**Actual closing stock** is entered or confirmed by the user. The app never pretends to know the physical quantity without a count.

**Next day opening** normally carries forward from the previous confirmed closing stock, adjusted for any movements recorded after the count.

**Critical consistency rules:**

- Finalizing a receipt creates negative SALE stock movements (once).
- Editing a receipt first reverses the previous SALE movements, then applies the new ones.
- Voiding or refunding a receipt creates compensating positive movements and marks the receipt VOID/REFUNDED so it no longer contributes to revenue.
- Sync or offline replay must be idempotent (use movement IDs or a processed flag) to prevent duplicate deductions.
- Low-stock alerts fire when currentStockQty ≤ lowStockThreshold.

## 5. UI Design Specification

### Visual language
- Clean, professional, calm. Inspired by modern SaaS (clear hierarchy, generous whitespace, restrained colour).
- **Primary colour:** Teal/cyan (#0d9488) for actions and positive indicators.
- **Surface:** White / very light slate (#f8fafc).
- **Text:** Near-black (#0f172a) with muted secondary (#64748b).
- **Success / warning / danger:** Soft greens, ambers, reds used sparingly.
- **Typography:** System UI stack (Inter or system-ui). Headings 1.25–1.75rem, body 0.95–1rem, labels 0.8–0.85rem. High contrast.
- **Spacing:** 4/8/16/24 px scale. Cards with subtle border and light shadow.
- **Radius:** 8–12 px.
- **Icons:** Simple inline SVG or Unicode, used sparingly.

### Navigation
Persistent top bar or sidebar (collapses to bottom/hamburger on mobile):

- Dashboard
- Receipts
- Sales
- Products & Inventory
- Restocking & Purchases
- Expenses
- Customers
- Reports
- Settings

### Dashboard (sample concept)
- Greeting + date.
- Key figures row: Today’s sales, Cash received, Outstanding, Low-stock count.
- Alerts: “3 products below reorder level”, “2 unpaid receipts older than 7 days”.
- Quick actions: New receipt, Add stock, Record expense.
- Recent receipts table (compact).
- Simple sparkline or bar for last 7 days sales (optional, CSS or lightweight).

### Mobile behaviour
- Single column.
- Sticky bottom navigation or collapsible menu.
- Large tap targets (≥44 px).
- Forms stack vertically; tables become cards.
- Primary action always visible.

### Components (design system)
- Buttons: primary, secondary, danger, ghost.
- Cards, badges (status), tables, empty states, form fields with clear labels and error text.
- Confirm dialogs for destructive actions.
- Consistent focus rings for accessibility.

### Accessibility
- Colour contrast ≥ 4.5:1 for text.
- Visible focus states.
- Proper labels, ARIA where needed.
- Keyboard navigable.

## 6. Implementation Stages (Revised)

| Stage | Scope | Status |
|-------|-------|--------|
| 1 | Inspection + initial plan | Done |
| 2 | **Foundation** — design system, navigation shell, sample dashboard, polished receipt builder with live cents-based calculations, IndexedDB persistence for receipts, basic empty states, responsive layout. No live services. | In progress |
| 3 | Products & simple inventory (local), stock movements on receipt finalise, low-stock indicator | Planned |
| 4 | Daily reconciliation flow, restock recording, stock reports | Planned |
| 5 | Expenses, customer balances, basic sales reports, CSV export | Planned |
| 6 | Supabase auth + sync (guest → cloud), business profile persistence | Planned |
| 7 | Sharing, PDF/PNG, PWA, print polish | Planned |
| 8 | Purchases/suppliers, fuller accounting views, Worker for secure ops if needed | Planned |
| 9 | Accessibility audit, performance, automated tests expansion | Planned |

**Stage 2 deliberately does not implement** full inventory deduction, reconciliation, expenses, customers, reports, or any cloud/billing features.

## 7. Safety Boundaries (unchanged)

- Original repo is reference-only.
- No production secrets, no connection to original Supabase / Worker / Paystack.
- No production SQL, no deploy, no push without explicit approval.
- No live billing.
- Do not claim untested features work.
- Guest/offline remains first-class.

## 8. Next (Stage 2)

Implement the polished frontend foundation described above, keep and extend the existing calculation tests, and produce a working receipt workflow with local persistence.

---

**Files to be created/updated in this update:**  
- This document (`docs/PRODUCT-VISION.md`)  
- Design notes embedded above  
- Updated stage tracking in `docs/README.md`

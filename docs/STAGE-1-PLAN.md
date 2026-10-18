# Receipt Pilot-C — Stage 1: Inspection & Implementation Plan

**Date:** 2026-10-17  
**Reference:** https://github.com/AbiolaEmmanuel100/Receipt-Pilot (public, cloned for read-only inspection only)  
**Status:** Inspection complete. No changes made to the original repository.

## 1. Inspection Summary of Original Receipt-Pilot

### Tech Stack
- **Frontend:** Static HTML + vanilla JavaScript + CSS (no build step)
- **Local storage:** IndexedDB (`js/storage.js`)
- **Auth & cloud data:** Supabase (anon/publishable key only, client-side)
- **Server-side:** Separate Cloudflare Worker (`worker/billing.js`) for Paystack billing webhooks and secure operations
- **PWA:** `manifest.json` + `sw.js`
- **Deployment:** Netlify (static)

### Key Features Present
- Receipt builder with line items, calculations (subtotal, discount, tax, total, amount paid, outstanding)
- Multiple templates (classic, modern, minimal, professional, elegant, compact, bold, corporate, simple, clean, retail, service, premium, modern-business)
- Business profiles (name, address, phone, email, website, logo, footer, prefix, currency)
- Receipt numbering with counters and unique constraint per user
- History / records list with filters, search, export (CSV, JSON)
- Editing existing receipts
- Printing + PDF/PNG exports
- Sharing (public share links via `r.html` + Supabase RPC)
- Sales summaries (daily / weekly / monthly)
- Guest mode (local only) + optional authentication & sync
- Subscriptions / trials / entitlements (Paystack via Worker)
- Admin features, account deletion requests, usage tracking
- Phone number handling, validation, error handling
- Offline support via service worker

### Database Structure (from `supabase/schema.sql` + migrations)
- `profiles`, `business_information`, `user_settings`
- `usage`, `subscriptions`
- `receipts` (with JSONB payload, soft-delete `deleted_at`)
- `receipt_items`
- `receipt_counters`
- Admin tables, payment-related functions
- RLS policies (inferred from setup docs; anon key only on client)
- Migrations 001–010 covering numbering, sharing, deletion, payments, trials, entitlements

### Notable Implementation Details
- Config in `js/config.js` (public keys only)
- Sync conflict rule: later `updatedAt` wins; deletes remembered
- Billing Worker holds secrets (Paystack, service role)
- Large JS modules (account.js ~60kB, app.js ~40kB, records.js ~34kB, etc.)
- No React; pure DOM manipulation

## 2. Goals for Receipt Pilot-C

Create a **completely separate**, more maintainable, secure, and testable version while preserving core functionality.

### Constraints (from user)
- Separate project — do **not** modify, commit to, or deploy the original repo
- HTML + CSS + TypeScript + Vite (frontend)
- Supabase/PostgreSQL for auth & data
- TypeScript Cloudflare Worker for secure server-side operations
- **No React** unless a specific need is demonstrated (none planned)
- Preserve: receipt builder, business profiles, templates, numbering, history, editing, printing, PDF/PNG exports, sharing, sales summaries, guest mode, auth, subscriptions, PWA
- Improve: security, mobile responsiveness, accessibility, performance, error handling, automated testing
- No AI features or unnecessary complexity until core works reliably
- Do **not** deploy, push, run production SQL, or alter external services without explicit approval

## 3. Proposed Project Structure

```
receipt-pilot-c/
├── frontend/                  # Vite + TypeScript multi-page / modular app
│   ├── index.html
│   ├── records.html
│   ├── sales.html
│   ├── ... (other pages)
│   ├── src/
│   │   ├── main.ts
│   │   ├── styles/
│   │   ├── modules/           # receipt, records, sales, auth, sync, etc.
│   │   ├── lib/               # shared utils, types, supabase client
│   │   └── pwa/
│   ├── public/
│   │   └── assets/
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── worker/                    # TypeScript Cloudflare Worker
│   ├── src/index.ts
│   ├── wrangler.toml
│   └── package.json
├── supabase/                  # Schema & migrations (for local/dev only)
│   ├── schema.sql
│   └── migrations/
├── docs/                      # Plans, decisions, stage reports
├── tests/                     # Shared or e2e notes
└── README.md
```

### Technology Choices
- **Frontend:** Vite (multi-page app mode), TypeScript, vanilla DOM + modules, CSS (responsive + a11y focus)
- **State / Storage:** IndexedDB wrapper (modern, typed) + Supabase client
- **Auth:** Supabase Auth (guest + email)
- **Exports:** Browser print + client-side PDF/PNG (e.g. html2canvas + jsPDF or equivalent, evaluated carefully)
- **Worker:** TypeScript, Hono or raw Worker for billing/webhooks/secure RPCs
- **Testing:** Vitest (unit), Playwright or lightweight browser tests later
- **PWA:** Vite PWA plugin or manual service worker + manifest

## 4. Implementation Stages (High-Level)

1. **Stage 1 (this stage):** Inspection + structure + plan (current)
2. **Stage 2:** Core frontend skeleton — Vite setup, shared layout, receipt builder form + live preview, local IndexedDB storage, basic calculations, templates
3. **Stage 3:** Records history, editing, search/filter, sales summaries, export foundations
4. **Stage 4:** Supabase auth, business profiles, sync (guest → logged-in), receipt numbering
5. **Stage 5:** Sharing, printing/PDF/PNG, PWA
6. **Stage 6:** Subscriptions / billing Worker (secure), entitlements, admin foundations
7. **Stage 7:** Accessibility, mobile polish, error handling, automated tests, performance
8. **Stage 8:** Final comparison readiness, documentation

Each stage ends with a report: files changed, tests run, outstanding issues, revert instructions.

## 5. Security & Quality Improvements Planned
- Strict TypeScript
- Input validation & sanitization
- Proper error boundaries / user-friendly errors
- RLS-first design (document policies)
- Secrets only in Worker
- Accessibility (ARIA, keyboard, contrast, focus)
- Mobile-first responsive CSS
- Automated unit tests for calculations, validation, storage
- No client-side service role keys

## 6. Next Immediate Actions (Stage 2)
- Initialize Vite + TypeScript in `frontend/`
- Port core receipt calculation & form logic into typed modules
- Create basic responsive layout matching original UX intent
- Implement local-only receipt create/save/load
- Add initial tests for calculations

---

**Files created in this stage:**  
- `docs/STAGE-1-PLAN.md` (this file)  
- Directory skeleton  

**Tests run:** None (inspection only)  
**Outstanding problems:** None for stage 1. Original repo untouched.  
**How to revert:** Delete the `receipt-pilot-c/` directory if desired. No external changes made.

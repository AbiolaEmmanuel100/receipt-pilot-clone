# Receipt Pilot-C — UI Design Specification (Stage 2)

**Goal:** A clean, professional, modern interface that feels like a quality commercial SaaS product.

## Layout

- **Desktop (≥900 px):** Left sidebar (240 px) + main content area. Top bar optional for search or user status (guest).
- **Mobile (<900 px):** Top bar with logo + hamburger; content full-width; primary actions sticky or prominent.
- Max content width ~1200 px, centred.

## Colour palette

| Role          | Value     | Usage                     |
|---------------|-----------|---------------------------|
| Primary       | #0d9488   | Buttons, links, accents   |
| Primary hover | #0f766e   |                           |
| Background    | #f8fafc   | Page                      |
| Surface       | #ffffff   | Cards, panels             |
| Border        | #e2e8f0   | Dividers, inputs          |
| Text          | #0f172a   | Primary text              |
| Muted         | #64748b   | Secondary text            |
| Success       | #059669   | Paid, positive            |
| Warning       | #d97706   | Partial, low stock        |
| Danger        | #dc2626   | Unpaid, destructive       |

## Typography

- Font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
- H1: 1.5rem / 700
- H2: 1.25rem / 600
- Body: 1rem / 400
- Small / labels: 0.85rem
- Line height: 1.5

## Components

- **Button** — primary (filled teal), secondary (bordered), danger (soft red). Min height 40 px.
- **Card** — white, 1 px border, 8 px radius, subtle shadow.
- **Badge** — pill for status (Paid green, Partial amber, Unpaid red).
- **Form field** — label above, clear error text below, focus ring 2 px teal.
- **Table** — clean rows, hover, responsive collapse to cards on small screens.
- **Empty state** — icon + short message + primary action.
- **Sidebar nav item** — icon + label, active state with left border or background.

## Dashboard sample (to be implemented)

- Header: “Good afternoon” + today’s date.
- Metric cards: Today’s sales · Cash received · Outstanding · Low stock (placeholder 0).
- Quick actions row.
- Recent receipts list (from IndexedDB).
- Helpful empty state when no data: “Create your first receipt to get started.”

## Accessibility

- Contrast checked against palette.
- Focus visible on all interactive elements.
- Labels associated with inputs.
- Destructive actions require confirmation.

## Mobile

- Sidebar becomes off-canvas or bottom nav.
- Forms single column.
- Tables stack into definition lists or cards.
- Touch targets ≥ 44 px.

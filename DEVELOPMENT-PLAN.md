# Rezvo — Complete Development Plan
## 23 Design Files → Production Build Roadmap

---

## THE FULL PICTURE

**23 HTML designs across 2 products:**

### Product A: Restaurant Owner Dashboard (rezvo.app/dashboard)
*11 design files — this is where the money is*

| # | Design File | What It Builds | Status |
|---|-------------|---------------|--------|
| 1 | `3-Guest CRM - Guest Detail Panel.html` | **Shared side panel** — used everywhere | ❌ Not built |
| 2 | `1-Timeline-Polished.html` | Calendar → Timeline view | ⚠️ Built wrong (improvised) |
| 3 | `2-TableStatus-Polished.html` | Calendar → Table Status view | ⚠️ Built wrong |
| 4 | `3-ReservationList-Polished.html` | Calendar → Reservation List view | ⚠️ Built wrong |
| 5 | `4-FloorPlan-Polished.html` | Floor Plan page | ⚠️ Built wrong (placeholder) |
| 6 | `1-Guest CRM - Guest Profile.html` | Guest full profile page | ❌ Not built |
| 7 | `2-Guest CRM - Add Party.html` | Add party / new booking form | ❌ Not built |
| 8-11 | Original reservation files (4) | Reference only — polished versions supersede | N/A |

### Product B: Diner Consumer App (rezvo.co.uk or mobile)
*12 design files — separate product, launches after dashboard*

| # | Design File | What It Builds | Status |
|---|-------------|---------------|--------|
| 1 | `12-Design App - Welcome.html` | Splash / welcome screen | ❌ Not built |
| 2 | `1-Design App - Create Account.html` | Diner registration | ❌ Not built |
| 3 | `2-Design App - Sign In.html` | Diner login | ❌ Not built |
| 4-6 | `3/4/5-Design App - Onboarding` | 3-step onboarding flow | ❌ Not built |
| 7 | `6-Design App - Home Dashboard.html` | Diner home — nearby restaurants, upcoming bookings | ❌ Not built |
| 8 | `7-Design App - Browse.html` | Browse / search restaurants | ❌ Not built |
| 9 | `8-Design App - Item Details.html` | Restaurant detail page | ❌ Not built |
| 10 | `9-Design App - Create/New.html` | Make a booking (diner side) | ❌ Not built |
| 11 | `10-Design App - Notifications.html` | Booking confirmations, reminders | ❌ Not built |
| 12 | `11-Design App - Profile & Setting.html` | Diner profile & preferences | ❌ Not built |

---

## PRIORITY LOGIC

**Product A first.** Micho needs the dashboard to manage his restaurant. Burg Burgers needs it for launch. The diner app is the demand side — it only matters once restaurants are onboarded and operational.

**Within Product A**, the Guest Detail Panel is the foundation. Build it once, reuse it in every view. Then rebuild the calendar views properly from the polished designs. Then floor plan. Then CRM pages.

---

## BUILD PHASES

### Phase 1: THE FOUNDATION (Guest Detail Panel)
**1 component, used in 5+ places**

Build `GuestDetailPanel.jsx` from `3-Guest CRM - Guest Detail Panel.html`:
- Avatar with initials + gradient
- Status badges (Regular / New / VIP / At Risk)
- 4-stat grid (visits / no-shows / spent / avg)
- Contact section with phone + email + action buttons
- Tags section with colored pills + Add button
- Notes section with italic quote + preference pills (allergy warnings)
- History timeline with date, table, party, spend
- Action bar: Check In (green) / Edit (outline) / Rebook (teal) / No Show (red)
- Slide-in-right animation with glass overlay on main content

### Phase 2: RESTAURANT CALENDAR (3 views, rebuilt properly)
**Delete current RestaurantCalendar.jsx and rebuild from designs**

| View | Source File | Key Elements |
|------|-----------|-------------|
| Timeline | `1-Timeline-Polished.html` | Tables as columns, 30-min rows, booking blocks that span rows, tooltip on hover, detail panel on click |
| Table Status | `2-TableStatus-Polished.html` | Card grid with left color border, zone grouping (Window/Main/Bar/Patio), capacity summary, table count by status |
| Reservation List | `3-ReservationList-Polished.html` | Sticky header table, avatar + name, status pills, search bar, filter dropdowns, sort by time/name/table |

All 3 views: click any booking → opens Guest Detail Panel

### Phase 3: FLOOR PLAN (rebuilt properly)
**From `4-FloorPlan-Polished.html`**

- Dot-grid canvas with bg pattern
- Circle tables (2-4 seats) and rectangle tables (6+ seats)
- Color-coded by status (green=available, teal=seated, amber=reserved, purple=dessert, slate=paying)
- Chair dots around each table
- Click table → shows booking info
- Right sidebar with booking list for selected area
- Zone labels

### Phase 4: CRM PAGES
- Guest Profile full page (from `1-Guest CRM - Guest Profile.html`)
- Add Party form (from `2-Guest CRM - Add Party.html`)
- Wire to `/dashboard/clients` route

### Phase 5: WIRE EVERYTHING
- FAB New Booking → POST /bookings
- FAB Walk-in → POST /bookings (walkin status)
- Check In / No Show / Rebook → PATCH /bookings/:id
- Guest tags CRUD
- Guest notes CRUD

### Phase 6: DINER APP (separate sprint)
**12 pages — builds on rezvo.co.uk**
- Welcome → Create Account → Sign In → Onboarding (3 steps)
- Home Dashboard → Browse → Item Details → Create Booking
- Notifications → Profile & Settings

---

## EFFORT ESTIMATE

| Phase | Components | Complexity | Sessions |
|-------|-----------|-----------|----------|
| Phase 1: Guest Detail Panel | 1 | High (reused everywhere) | 1 |
| Phase 2: Calendar Views (3) | 3 | High (design-accurate) | 2 |
| Phase 3: Floor Plan | 1 | High (canvas + drag) | 1 |
| Phase 4: CRM Pages | 2 | Medium | 1 |
| Phase 5: Wire Everything | API + handlers | Medium | 1 |
| Phase 6: Diner App | 12 pages | High (new product) | 3-4 |
| **Total** | **22 components** | | **9-10 sessions** |

---

## NEXT ACTION

**Start Phase 1: Build GuestDetailPanel.jsx**

Open `3-Guest CRM - Guest Detail Panel.html`, read every class, replicate exactly in React, wire to booking data from the calendar API.

*This single component unlocks Phases 2, 3, and 4.*

---

*Updated: 25 Feb 2026 | 23 design files catalogued | 2 products scoped*

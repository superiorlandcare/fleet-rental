# Build Prompt — Superior Landcare LLC Equipment Rental Site

You are building a production equipment-rental booking site for **Superior Landcare LLC**. A working single-file prototype exists (`index.html` / `fleet_booking.jsx`) — use it as the **design and interaction reference**, but this is the real multi-user version backed by a database. Build it as a **Next.js (App Router, TypeScript) app** that replaces the static `index.html` in this repo.

Work through the build order at the end, checking in after each numbered step. Do not build any Phase 2 feature.

---

## How to approach this

The division of labor matters: **the product decisions, business rules, domain facts, branding, scope, and the hard invariants in this document are fixed** — treat them as requirements, not suggestions. **The implementation is yours** — file structure, libraries, patterns, and the exact data model are your call.

Treat the SQL/data model and build order below as a **reference implementation, not gospel.** Improve on them however you see fit, as long as you preserve these invariants:
1. No two active bookings ever overlap on the same item (machine, trailer, or attachment — including the single shared backhoe).
2. The catalog stays **generic** — categories + items — so adding new equipment is data, never code.
3. Customer PII is never exposed to anonymous/public clients.
4. Phase 1 scope only.

**Use your live context.** You can read the actual repo, check current library and API versions, run code, and see real errors — this prompt was written without any of that. Wherever what you observe differs from something assumed here, trust what you can verify and adjust.

**Keep the guardrails regardless.** Build only Phase 1, leave clean seams for Phase 2 but don't build it, and check in with the human after each numbered step.

---

## Already set up (don't recreate — connect to it)
- **Supabase** project (Postgres + Auth + Storage), with a public `photos` storage bucket.
- **GitHub** repo (this one) wired to **Vercel** for auto-deploy on push.
- Env vars already in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_EMAIL`, `OWNER_PHONE`.

The repo currently holds a static `index.html` demo and Vercel is set to Framework Preset "Other." As part of this build, the project becomes a real Next.js app — `index.html` is removed and the human switches Vercel's Framework Preset back to Next.js (remind them).

---

## What this is

A catalog of rentable equipment grouped by category (Machines, Trailers, Attachments — more later). Customers browse with photos, see real availability, **add multiple items to one request** (e.g., a machine + a trailer to haul it + an attachment), choose delivery or pickup, get a full quote, and either book instantly or send a request depending on how soon the rental starts. They're then shown how to pay (the owner's payment handles). The owner and his assistant share a login to manage the schedule, approve requests, block off their own days, manage the catalog/photos, and mark bookings paid. Every new booking texts both of them and emails the business.

**Build it generically.** Do NOT hardcode the current items. A flexible catalog by category means adding trailers or future equipment is just a row in the admin.

---

## Decisions (all locked)

**Booking flow — hybrid by lead time:**
- Rental starting **48+ hours out → instant confirm**.
- Rental starting **within 48 hours, including same-day → comes in as a request** the owner approves (or declines) in admin. (Same-day is allowed, just always a request.)
- The 48-hour threshold is an admin setting.
- **Minimum rental length: 1 day.** No maximum.

**Multi-item requests:** one reservation can hold several items, each with its own dates (default all to the same dates, allow per-item adjustment).

**Categories & availability:** items grouped by category. Machines and trailers each have their own availability calendar. Attachments are picked as add-ons to a machine but still hold their own availability (the shared backhoe can't be on two jobs at once).

**Per-item pricing toggle:** every item has a `pricing_enabled` switch in admin (ON → price shows + counts toward the total; OFF → "priced at pickup," still bookable, excluded from total). All current items are priced ON.

**Rates:**
- Machines and trailers have a **daily**, **weekly**, and **4-hour** rate.
- **Weekly logic** (≥7 days): `floor(days/7) × weekly + (days % 7) × daily`.
- **4-hour rentals are pickup-only**, and if not returned within the window they're billed a **full day**.
- **Attachment weekly rate = 4.5 × its daily rate**, same week/day blend.
- Attachment pricing lives on the **machine↔attachment pairing**, not the attachment itself — so the single shared backhoe is **$95 on the MT-100 and $120 on the T66**. The backhoe is **one physical unit**: shared availability across both machines.
- Each machine **includes a smooth bucket free** (a feature of the machine, not a separately booked item).

**Delivery:** request asks delivery or pickup. If delivery, capture the address and compute a fee by driving distance from the shop via the **Google Routes API** (server-side, key hidden). Fee = `max(min_fee, min_fee + max(0, one_way_miles − included_radius) × per_mile)`. Defaults (admin-editable): `min_fee = 180`, `included_radius = 20`, `per_mile = 3.50`. **No max distance** (out-of-state is possible).
- Shop origin: **4683 Antioch Road, Perry, OH 44081**.

**Deposit:** **$250 on every rental, paid upfront** with the rental.

**Payment (no processor):** show the customer a full quote — items + delivery + $250 deposit = "out the door" estimate — then a **payment step displaying the owner's handles** for the customer to pay manually:
- Venmo: **@evanw_222**
- CashApp: **$SuperiorLandCareLLC**
- Zelle: **superiorlc**
The owner **manually marks the booking paid** in admin once funds land. These handles are admin settings.

**Auth:** a **single shared admin login** (the shared business Gmail) for both the owner and Katy.

**Notifications:** on every new booking or request, **text both** the owner (**440-376-3470**) and Katy (**440-520-8414**) and **email evanslandscapingandplowing@gmail.com**, with full details (items, dates, delivery/pickup + address, quote/total, customer name + contact, and whether it's an instant booking or a request needing approval). The **customer gets an email** with their quote, the payment handles, and the terms: $250 deposit, return with full fuel, the daily hour cap, cleaning expectations, and that the rental form is signed and the key handed off **in person**.

---

## Branding
- Company name on the site: **Superior Landcare LLC** (text wordmark; no logo file yet — easy to swap one in later).
- Colors: **GM Rapid Blue** (vivid azure, ~`#1BA0E2`, tune to taste) accent on a **black / near-black** base. Keep the prototype's clean industrial dark look; swap amber → Rapid Blue.

---

## Catalog & pricing (seed this exactly)

**Machines**
- **MT-100** (Bobcat Mini Track Loader) — $170/day · $765/wk · $155/4hr · includes smooth bucket.
- **T66** (Bobcat Compact Track Loader) — $300/day · $1,350/wk · $260/4hr · includes smooth bucket.

**Trailers** (numbers pending final owner confirmation — admin-editable)
- **40' Gooseneck** (40×8.5) — $250/day · $1,000/wk · $225/4hr.
- **Dump Trailer** (8.5×16×4, 8K axles) — $225/day · $800/wk · $200/4hr.

**Attachments** (add-ons; weekly = 4.5× daily)
- **Grapple (MT-100)** — $95/day · $427.50/wk.
- **Pallet Forks (MT-100)** — $45/day · $202.50/wk.
- **Backhoe (shared, one unit)** — $95/day on MT-100, $120/day on T66 ($427.50 / $540 weekly respectively).

**Compatibility (which add-ons show per machine):**
- MT-100 → Grapple, Pallet Forks, Backhoe (+ included smooth bucket).
- T66 → Backhoe (+ included smooth bucket).
- (No grapple on the T66.)

**Every rental:** $250 deposit, upfront.

*All prices and rates above — including the trailer numbers and the deposit — are editable in the admin, so they can be tuned live without code changes.*

---

## Data model (replace the existing simple schema)

Provide migration SQL that drops the old `machines`/`attachments`/`bookings` tables and creates a generic model. Shape it as you see best while preserving the invariants; a reference:

```
settings (single row)
  shop_address, delivery_min_fee (180), delivery_included_radius (20),
  delivery_per_mile (3.50), deposit_amount (250), request_window_hours (48),
  venmo, cashapp, zelle

categories            id, name, sort_order
items                 id, category_id, name, maker, subtitle, description,
                      is_addon bool, daily_rate, weekly_rate, four_hour_rate,
                      pricing_enabled bool, active bool, sort_order
item_photos           id, item_id -> items (cascade), url, sort_order
item_compatibility    machine_id -> items, attachment_id -> items,
                      daily_rate, weekly_rate, included bool
                      -- drives per-machine add-on lists AND per-pairing price
                      -- backhoe gets two rows (MT $95 / T66 $120)
bookings              id, type ('reservation'|'block'),
                      status ('requested'|'confirmed'|'cancelled'),
                      customer_name, customer_phone, customer_email,
                      fulfillment ('delivery'|'pickup'), address,
                      distance_miles, delivery_fee, items_subtotal,
                      deposit, estimated_total, paid bool default false,
                      reason (blocks), created_at
booking_items         id, booking_id -> bookings (cascade), item_id -> items,
                      attached_to_item_id (nullable; for an add-on, the machine
                      it's mounted on -> resolves compat + price),
                      start_date, end_date, check (end_date >= start_date)
```

**Double-booking prevention** at the DB level on `booking_items` (covers machines, trailers, and the shared backhoe uniformly):
```sql
create extension if not exists btree_gist;
alter table booking_items add constraint no_overlap
  exclude using gist (item_id with =, daterange(start_date, end_date, '[]') with &&);
```
Cancelling/declining a booking deletes its `booking_items` (cascade), so the constraint only guards active rentals/blocks.

**RLS:** public reads `categories`, `items`, `item_photos`, `item_compatibility`. Only the authenticated admin writes the catalog or reads/manages bookings. Public reservations go through a server route (service role). Public availability is a server route returning only `item_id, start_date, end_date` — no PII.

---

## Pages & routes
- **`/` (public):** catalog by category; machines/trailers show gallery + availability calendar; attachments show contextually per selected machine with their pairing price. Multi-item cart with per-item dates, delivery/pickup + address (live delivery fee), customer name/phone/email, a running quote (items + delivery + $250 deposit), and submit. On submit, the **48-hour rule** decides instant-confirm vs. request. After submit, show the **payment step** with the handles. Carry over the prototype's look, rebranded.
- **`/api/availability` (GET, public):** date ranges per item, no PII.
- **`/api/reservations` (POST, public):** validate (overlap, 1-day min), compute pricing (weekly/day blend, attachment pairing price, delivery distance/fee, deposit), set status by the 48-hour rule, insert booking + line items via service role, fire notifications.
- **`/api/distance` (server):** Google Routes API, key hidden.
- **`/admin` (auth):** schedule board across all items; **requests queue (approve/decline)**; bookings list (view, cancel, **mark paid**); block-off per item; catalog management (add/edit items, category, daily/weekly/4hr rates, `pricing_enabled`, compatibility + pairing prices, photos via Storage with client-side resize, active); settings (shop address, delivery params, deposit, request window, payment handles).
- **`/login`:** Supabase Auth (shared login).

---

## Env vars to add
```
GOOGLE_MAPS_API_KEY          # server-only, Routes API enabled
RESEND_API_KEY
EMAIL_FROM
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
NOTIFY_PHONES = 4403763470,4405208414       # Evan, Katy
NOTIFY_EMAILS = evanslandscapingandplowing@gmail.com
```
(Twilio SMS needs A2P 10DLC registration, which takes a few days — build SMS behind a toggle so it goes live once approved; email works immediately.)

---

## Build order
1. Scaffold Next.js + TS + Tailwind; Supabase clients (publishable key in browser, secret key server-only); rebrand to Rapid Blue / black / Superior Landcare LLC.
2. Migration SQL (drop old, create the model, RLS, `booking_items` exclusion constraint); seed categories, items, `item_compatibility`, and settings per the catalog above.
3. Public catalog: categories, galleries, attachment scroller (contextual per machine), per-item availability calendar from `/api/availability`.
4. Multi-item cart + per-item dates + delivery/pickup + `/api/distance` + live quote (items + delivery + deposit).
5. `/api/reservations`: validation, full pricing, 48-hour instant/request decision, insert, notifications; then the customer payment step (handles + terms email).
6. Supabase Auth + `/login`; protect `/admin`.
7. `/admin`: schedule board, requests queue (approve/decline), bookings list (cancel, mark paid), block-off, catalog + compatibility management, photo upload, settings.
8. Polish, mobile pass; remove `index.html`; remind the human to switch Vercel Framework Preset to Next.js; deploy.

Leave clean seams for **Phase 2** (real payment processor, e-signed waiver, ID upload, fuel/hour-meter/condition logging) but do not build them.

---

## Kickoff (paste this first)
> Read this file. Build the Superior Landcare rental site exactly as specified. Start by scaffolding the Next.js project and connecting to the existing Supabase project, then stop and show me the migration SQL and the new env vars to add before continuing. Work through the build order, checking in after each numbered step. Don't build any Phase 2 features.

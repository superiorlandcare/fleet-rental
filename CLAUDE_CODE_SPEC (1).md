# Fleet Rental — Build Spec

A booking + availability site for a small equipment-rental operation (two machines, swappable attachments). Customers browse machines and attachments with photos, see real availability, and request dates. The owner and one assistant log in to manage the schedule, block off their own days, manage photos, and get notified of new requests.

A working prototype already exists (`fleet_booking.jsx`) — use it as the visual and behavioral reference. This spec is the production version of that prototype.

---

## Scope

**Phase 1 (build now)**
- Public site: machine list, photo gallery per machine, attachments scroller (with photos + descriptions), availability calendar, date-range reservation request.
- Admin: login, schedule board, bookings list (confirm / cancel), block-off days, photo management.
- Email + SMS notifications on new requests and confirmations.
- Real availability with database-level double-booking prevention.

**Phase 2 (do NOT build yet — just don't architect anything that blocks it)**
- Stripe deposit holds + rental payment.
- E-signed liability waiver, ID photo upload.
- Fuel level / hour-meter / condition-photo logging on pickup and return.

A "reservation" in Phase 1 is a **request**, not a paid booking. Payment, deposit, and waiver are handled offline at pickup/delivery.

---

## Stack

- **Next.js** (App Router, TypeScript) on **Vercel**
- **Supabase** — Postgres, Auth, Storage
- **Tailwind CSS** (match the prototype's dark industrial look)
- **Resend** — transactional email
- **Twilio** — SMS
- No Stripe in Phase 1.

---

## Environment variables (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only, never exposed to client
RESEND_API_KEY=
EMAIL_FROM="rentals@yourdomain.com"
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
OWNER_PHONE=                      # where new-request texts go
OWNER_EMAIL=                      # where new-request emails go
```

---

## Database (run in Supabase SQL editor)

```sql
create extension if not exists btree_gist;

create table machines (
  id text primary key,            -- slug, e.g. 'mt100'
  name text not null,
  maker text,
  type text,
  blurb text,
  sort_order int default 0,
  active boolean default true
);

create table attachments (
  id text primary key,            -- slug, e.g. 'auger'
  name text not null,
  does text,
  photo_url text,                 -- single hero photo, nullable (icon fallback in UI)
  sort_order int default 0,
  active boolean default true
);

create table machine_photos (
  id uuid primary key default gen_random_uuid(),
  machine_id text references machines(id) on delete cascade,
  url text not null,
  sort_order int default 0
);

create type booking_type as enum ('reservation','block');
create type booking_status as enum ('requested','confirmed','cancelled');

create table bookings (
  id uuid primary key default gen_random_uuid(),
  machine_id text not null references machines(id) on delete cascade,
  type booking_type not null,
  status booking_status not null default 'requested',
  customer_name text,
  customer_contact text,          -- phone or email
  reason text,                    -- for owner blocks
  start_date date not null,
  end_date date not null,
  created_at timestamptz default now(),
  check (end_date >= start_date)
);

-- Hard guarantee: no two non-cancelled bookings overlap on the same machine.
alter table bookings add constraint no_overlap
  exclude using gist (
    machine_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (status <> 'cancelled');
```

### Row-level security

```sql
alter table machines enable row level security;
alter table attachments enable row level security;
alter table machine_photos enable row level security;
alter table bookings enable row level security;

-- Catalog is publicly readable
create policy "read machines"     on machines       for select using (true);
create policy "read attachments"  on attachments    for select using (true);
create policy "read photos"       on machine_photos for select using (true);

-- Catalog writes: signed-in admins only
create policy "write machines"    on machines       for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "write attachments" on attachments    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "write photos"      on machine_photos for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Bookings: NO anonymous access. Admins manage directly; public writes go through a server route (service role).
create policy "admin bookings"    on bookings       for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
```

The `bookings` table holds customer names/contacts, so it is never exposed to anonymous clients. Public availability is served by a server route that returns date ranges only (no PII).

### Storage
One public bucket `photos` (or two: `machine-photos`, `attachment-photos`). Public read; authenticated write. Client resizes images to ~1280px JPEG before upload (mirror the prototype's `resizeToDataURL` helper).

---

## Auth
- Customers need **no account** — they submit a request with name + contact.
- Owner + assistant (Katy) use **Supabase Auth** (magic link is simplest). Two seats. All `/admin` routes require a session.

---

## Routes

| Route | Access | Purpose |
|---|---|---|
| `/` | public | Machines, galleries, attachments scroller, availability calendar, request form |
| `/api/availability` | public (GET) | Returns `[{ machine_id, start_date, end_date }]` for non-cancelled bookings — **ranges only, no PII** |
| `/api/reservations` | public (POST) | Validates + inserts a reservation via service role; overlap is rejected by the DB constraint; fires owner + customer notifications |
| `/admin` | auth | Schedule board, bookings list (confirm/cancel), block-off form, photo management |
| `/login` | public | Magic-link sign-in |
| `/api/cron/reminders` | cron | Daily — texts/emails reminders for tomorrow's pickups and returns (optional in Phase 1) |

---

## Feature spec (match prototype behavior)

**Public `/`**
- Two machine cards select the active machine.
- Gallery for the selected machine: hero image + thumbnail strip. Falls back to a clean SVG illustration when no photos exist (carry over `MachineArt` from the prototype). Owner-only "upload" affordance lives in `/admin`, not the public page.
- Attachments scroller **between the gallery and the calendar** — horizontal snap-scroll cards, each with photo (or icon fallback) + name + "what it does."
- Month calendar for the selected machine. Days that are reserved or blocked are unpickable. Customer clicks a start date then an end date; a range crossing any unavailable day is rejected. Past days disabled.
- Request rail: machine + chosen dates summary, name, phone/email, "Request these dates." On submit, POST to `/api/reservations`. Note that payment/deposit/waiver happen at pickup.

**Admin `/admin`**
- Schedule board: each machine as a row of day cells across the month; reservations in the machine's accent color, owner blocks as hazard stripes, open days muted. (Carry over the prototype's board.)
- Bookings list: every reservation + block sorted by date, with confirm (requested → confirmed) and cancel/remove. Reservations show status + customer name/contact; blocks show the reason.
- Block-off form: pick machine, from/to dates, optional reason → creates a `type='block'` booking. Same overlap rules apply.
- Photo management: upload/reorder/remove machine gallery photos; upload/remove a photo per attachment. Client-side resize before upload to Supabase Storage.

---

## Notifications (`lib/notify.ts`)

Two helpers: `sendEmail()` (Resend) and `sendSms()` (Twilio). Trigger points:

- **New reservation request** → SMS + email to owner: `New request — {machine} {start}–{end}, {name}, {contact}`. If the customer's contact is an email, send them a "request received" acknowledgment.
- **Reservation confirmed** (admin action) → email/SMS the customer: "You're confirmed for {machine} {start}–{end}."
- **Reminders** (Vercel Cron, optional Phase 1) → day-before pickup and day-before return.

Keep message bodies short and templated. Costs at this volume are negligible (Resend free tier covers it; Twilio is ~$0.008/text + ~$1.15/mo for the number).

---

## Design

Match the prototype exactly: dark zinc base, amber accent for MT-100, sky-blue for T66, hazard-stripe pattern for owner blocks, Oswald for display / Inter for body. Mobile-responsive, visible keyboard focus. The prototype `fleet_booking.jsx` is the source of truth for layout, colors, and the calendar interaction.

---

## Build order

1. Scaffold Next.js + TypeScript + Tailwind; wire Supabase client (anon for browser, service role for server routes).
2. Run the SQL above; create the storage bucket; seed `machines` (mt100, t66) and `attachments` (the 8 from the prototype).
3. Public `/`: catalog + galleries + attachments + availability calendar reading `/api/availability`.
4. `/api/reservations` with server-side validation + DB-constraint overlap handling + owner/customer notifications.
5. Supabase Auth + `/login`; protect `/admin`.
6. `/admin`: schedule board, bookings list with confirm/cancel, block-off form.
7. Photo management (upload/resize to Storage) for machines + attachments.
8. Polish, mobile pass, deploy to Vercel, set env vars, point the domain.
9. (Optional) Vercel Cron reminders.

Leave clean seams for Phase 2 (a `payments` concern on bookings, a `waivers` table, a `condition_logs` table) but do not build them.

---

## Kickoff prompt (paste into Claude Code on first run)

> Read `CLAUDE_CODE_SPEC.md` and `fleet_booking.jsx` in this folder. Build the Phase 1 production app described in the spec: a Next.js + Supabase equipment-rental booking site that matches the prototype's design and behavior. Start by scaffolding the project and setting up the Supabase client, then show me the SQL and `.env.local` template to run before you continue. Work through the build order in the spec, checking in after each numbered step. Do not build any Phase 2 features.

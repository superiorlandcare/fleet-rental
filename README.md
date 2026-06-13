# Superior Landcare LLC — Equipment Rental Site

Production booking site: Next.js (App Router, TypeScript) + Tailwind on Vercel,
backed by Supabase (Postgres, Auth, Storage). Customers browse the catalog with
live availability, build a multi-item rental (machine + trailer + attachments),
choose delivery or pickup, get a full quote, and book instantly or send a
request depending on lead time. Admin (shared login) manages the schedule,
requests, catalog, photos, and settings at `/admin`.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
```

## Database

Migrations live in `supabase/migrations/` and are applied by pasting into the
Supabase SQL editor, in order:

1. `0001_phase1_schema.sql` — schema, RLS, overlap-prevention constraint, seed catalog
2. `0002_four_hour_flag.sql` — 4-hour flag on booking line items
3. `0003_hour_cap_settings.sql` — hour cap + overage settings

Hard invariant: a GiST exclusion constraint on `booking_items` makes
double-booking any item (including the shared backhoe) impossible at the
database level. Customer PII in `bookings` is never readable anonymously —
public traffic goes through server routes.

## Environment variables

See `.env.example`. Supabase keys + `OWNER_EMAIL`/`OWNER_PHONE` already exist
in Vercel; the build added `GOOGLE_MAPS_API_KEY` (Routes API, server-only),
`RESEND_API_KEY`, `EMAIL_FROM`, Twilio credentials, `SMS_ENABLED` (keep `false`
until A2P 10DLC registration clears), `NOTIFY_PHONES`, `NOTIFY_EMAILS`.

## Phase 2 seams (not built)

Real payment processor, e-signed waiver, ID upload, and fuel/hour-meter/
condition logging hang off `bookings`/`booking_items` without schema rework —
`paid` is already a column, and per-line records exist for condition logs.

## Reference

The original prototype and build specs are archived in `docs/`.

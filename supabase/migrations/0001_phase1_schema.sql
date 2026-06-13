-- ============================================================
-- Superior Landcare LLC — Phase 1 schema
-- Run this whole file in the Supabase SQL editor.
-- Drops the old prototype tables and creates the generic
-- catalog + booking model with DB-level double-booking
-- prevention.
-- ============================================================

create extension if not exists btree_gist;

-- ---------- drop the old prototype schema ----------
drop table if exists machine_photos cascade;
drop table if exists bookings cascade;
drop table if exists attachments cascade;
drop table if exists machines cascade;
drop type if exists booking_type cascade;
drop type if exists booking_status cascade;

-- ---------- types ----------
create type booking_type as enum ('reservation', 'block');
create type booking_status as enum ('requested', 'confirmed', 'cancelled');
create type fulfillment_type as enum ('delivery', 'pickup');

-- ---------- settings (single row) ----------
create table settings (
  id boolean primary key default true check (id), -- enforces a single row
  shop_address text not null,
  delivery_min_fee numeric not null,
  delivery_included_radius numeric not null,   -- one-way miles included in min fee
  delivery_per_mile numeric not null,
  deposit_amount numeric not null,
  request_window_hours int not null,           -- starts sooner than this => request, not instant
  venmo text,
  cashapp text,
  zelle text
);

-- ---------- catalog ----------
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0
);

create table items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id),
  name text not null,
  maker text,
  subtitle text,
  description text,
  is_addon boolean not null default false,     -- add-ons are booked against a machine
  daily_rate numeric,                          -- null for add-ons (price lives on the pairing)
  weekly_rate numeric,
  four_hour_rate numeric,                      -- null = no 4-hour option
  pricing_enabled boolean not null default true, -- off => "priced at pickup", excluded from total
  active boolean not null default true,
  sort_order int not null default 0
);

create table item_photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  url text not null,
  sort_order int not null default 0
);

-- Which add-ons fit which machine, and what the pairing costs.
-- The shared backhoe gets two rows (MT-100 $95/day, T66 $120/day).
-- included = true means it ships free with the machine (smooth bucket).
create table item_compatibility (
  machine_id uuid not null references items(id) on delete cascade,
  attachment_id uuid not null references items(id) on delete cascade,
  daily_rate numeric,
  weekly_rate numeric,
  included boolean not null default false,
  primary key (machine_id, attachment_id)
);

-- ---------- bookings ----------
create table bookings (
  id uuid primary key default gen_random_uuid(),
  type booking_type not null,
  status booking_status not null default 'requested',
  customer_name text,
  customer_phone text,
  customer_email text,
  fulfillment fulfillment_type,
  address text,
  distance_miles numeric,
  delivery_fee numeric,
  items_subtotal numeric,
  deposit numeric,
  estimated_total numeric,
  paid boolean not null default false,
  reason text,                                 -- owner blocks only
  created_at timestamptz not null default now()
);

create table booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  item_id uuid not null references items(id),
  attached_to_item_id uuid references items(id), -- for add-ons: the machine it's mounted on
  start_date date not null,
  end_date date not null,
  -- false once the parent booking is cancelled/declined, releasing the dates
  -- while keeping line-item history
  active boolean not null default true,
  check (end_date >= start_date)
);

create index booking_items_booking_idx on booking_items (booking_id);
create index booking_items_item_idx on booking_items (item_id);
create index items_category_idx on items (category_id);

-- Hard invariant: no two active line items ever overlap on the same
-- physical item — machines, trailers, and the shared backhoe alike.
alter table booking_items add constraint no_overlap
  exclude using gist (
    item_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (active);

-- Cancelling/declining a booking releases its dates automatically.
create or replace function release_cancelled_booking_items()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update booking_items set active = false where booking_id = new.id;
  end if;
  return new;
end;
$$;

create trigger booking_cancelled
  after update of status on bookings
  for each row execute function release_cancelled_booking_items();

-- ---------- row-level security ----------
alter table settings enable row level security;
alter table categories enable row level security;
alter table items enable row level security;
alter table item_photos enable row level security;
alter table item_compatibility enable row level security;
alter table bookings enable row level security;
alter table booking_items enable row level security;

-- Catalog + settings are publicly readable (no PII lives there;
-- payment handles and deposit are shown to customers by design).
create policy "public read settings"      on settings           for select using (true);
create policy "public read categories"    on categories         for select using (true);
create policy "public read items"         on items              for select using (true);
create policy "public read item_photos"   on item_photos        for select using (true);
create policy "public read compatibility" on item_compatibility for select using (true);

-- Only the signed-in admin writes the catalog/settings.
create policy "admin write settings"      on settings           for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write categories"    on categories         for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write items"         on items              for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write item_photos"   on item_photos        for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write compatibility" on item_compatibility for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Bookings hold customer PII: NO anonymous access at all.
-- Public reservations and the availability feed go through server
-- routes using the service role (which bypasses RLS).
create policy "admin bookings"      on bookings      for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin booking_items" on booking_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------- storage policies for the existing public `photos` bucket ----------
-- (public read is already on; allow the signed-in admin to manage objects)
create policy "admin upload photos" on storage.objects for insert to authenticated with check (bucket_id = 'photos');
create policy "admin update photos" on storage.objects for update to authenticated using (bucket_id = 'photos');
create policy "admin delete photos" on storage.objects for delete to authenticated using (bucket_id = 'photos');

-- ============================================================
-- Seed data — catalog & settings per the locked decisions
-- ============================================================

insert into settings (shop_address, delivery_min_fee, delivery_included_radius,
                      delivery_per_mile, deposit_amount, request_window_hours,
                      venmo, cashapp, zelle)
values ('4683 Antioch Road, Perry, OH 44081', 180, 20, 3.50, 250, 48,
        '@evanw_222', '$SuperiorLandCareLLC', 'superiorlc');

insert into categories (name, sort_order) values
  ('Machines', 1),
  ('Trailers', 2),
  ('Attachments', 3);

insert into items (category_id, name, maker, subtitle, description, is_addon,
                   daily_rate, weekly_rate, four_hour_rate, sort_order)
values
  ((select id from categories where name = 'Machines'),
   'MT-100', 'Bobcat', 'Mini Track Loader',
   'Stand-on mini track loader — fits through gates and tight access. Smooth bucket included.',
   false, 170, 765, 155, 1),
  ((select id from categories where name = 'Machines'),
   'T66', 'Bobcat', 'Compact Track Loader',
   'Cab compact track loader — heavy lift and grading power. Smooth bucket included.',
   false, 300, 1350, 260, 2),
  ((select id from categories where name = 'Trailers'),
   '40'' Gooseneck', null, '40 × 8.5',
   'Forty-foot gooseneck for hauling machines and heavy loads.',
   false, 250, 1000, 225, 1),
  ((select id from categories where name = 'Trailers'),
   'Dump Trailer', null, '8.5 × 16 × 4 · 8K axles',
   'Heavy-duty dump trailer for debris, gravel, and demo hauling.',
   false, 225, 800, 200, 2),
  -- Add-ons: pricing lives on the machine pairing, not here.
  ((select id from categories where name = 'Attachments'),
   'Grapple', null, null,
   'Grabs brush, rock, and debris that won''t sit still in a bucket.',
   true, null, null, null, 1),
  ((select id from categories where name = 'Attachments'),
   'Pallet Forks', null, null,
   'Lifts and carries pallets, block, and bundled material.',
   true, null, null, null, 2),
  ((select id from categories where name = 'Attachments'),
   'Backhoe', null, 'One shared unit',
   'Digs trenches, footings, and stumps. One unit shared across both machines.',
   true, null, null, null, 3),
  ((select id from categories where name = 'Attachments'),
   'Smooth Bucket', null, 'Included free',
   'Scoops and moves dirt, gravel, and mulch. Included free with every machine.',
   true, null, null, null, 0);

-- Pairings: which add-ons each machine takes, at what price.
-- Attachment weekly = 4.5 × daily.
insert into item_compatibility (machine_id, attachment_id, daily_rate, weekly_rate, included)
values
  ((select id from items where name = 'MT-100'), (select id from items where name = 'Smooth Bucket'), 0, 0, true),
  ((select id from items where name = 'T66'),    (select id from items where name = 'Smooth Bucket'), 0, 0, true),
  ((select id from items where name = 'MT-100'), (select id from items where name = 'Grapple'),      95,  427.50, false),
  ((select id from items where name = 'MT-100'), (select id from items where name = 'Pallet Forks'), 45,  202.50, false),
  ((select id from items where name = 'MT-100'), (select id from items where name = 'Backhoe'),      95,  427.50, false),
  ((select id from items where name = 'T66'),    (select id from items where name = 'Backhoe'),      120, 540.00, false);

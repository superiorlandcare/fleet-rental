-- 4-hour rentals (single-day, pickup-only) need to be visible on the line
-- item so admin and notifications show what was actually booked.
alter table booking_items
  add column four_hour boolean not null default false;

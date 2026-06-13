-- Daily machine-hour cap and overage rate, admin-editable like the other
-- rental terms.
alter table settings
  add column hour_cap_per_day numeric not null default 7,
  add column overage_per_hour numeric not null default 50;

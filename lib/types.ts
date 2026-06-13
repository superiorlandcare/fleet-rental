// Row shapes for the Phase 1 schema (supabase/migrations/0001_phase1_schema.sql)

export type Settings = {
  shop_address: string;
  delivery_min_fee: number;
  delivery_included_radius: number;
  delivery_per_mile: number;
  deposit_amount: number;
  request_window_hours: number;
  venmo: string | null;
  cashapp: string | null;
  zelle: string | null;
};

export type Category = {
  id: string;
  name: string;
  sort_order: number;
};

export type Item = {
  id: string;
  category_id: string;
  name: string;
  maker: string | null;
  subtitle: string | null;
  description: string | null;
  is_addon: boolean;
  daily_rate: number | null;
  weekly_rate: number | null;
  four_hour_rate: number | null;
  pricing_enabled: boolean;
  active: boolean;
  sort_order: number;
};

export type ItemPhoto = {
  id: string;
  item_id: string;
  url: string;
  sort_order: number;
};

export type Compatibility = {
  machine_id: string;
  attachment_id: string;
  daily_rate: number | null;
  weekly_rate: number | null;
  included: boolean;
};

/** What /api/availability returns — date ranges only, never PII. */
export type AvailabilityRange = {
  item_id: string;
  start_date: string;
  end_date: string;
};

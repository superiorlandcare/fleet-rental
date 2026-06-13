// Row shapes for the Phase 1 schema (supabase/migrations/0001_phase1_schema.sql)

export type Settings = {
  shop_address: string;
  delivery_min_fee: number;
  delivery_included_radius: number;
  delivery_per_mile: number;
  deposit_amount: number;
  request_window_hours: number;
  hour_cap_per_day: number;
  overage_per_hour: number;
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

export type BookingType = "reservation" | "block";
export type BookingStatus = "requested" | "confirmed" | "cancelled";

export type Booking = {
  id: string;
  type: BookingType;
  status: BookingStatus;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  fulfillment: "delivery" | "pickup" | null;
  address: string | null;
  distance_miles: number | null;
  delivery_fee: number | null;
  items_subtotal: number | null;
  deposit: number | null;
  estimated_total: number | null;
  paid: boolean;
  reason: string | null;
  created_at: string;
};

export type BookingItem = {
  id: string;
  booking_id: string;
  item_id: string;
  attached_to_item_id: string | null;
  start_date: string;
  end_date: string;
  active: boolean;
  four_hour: boolean;
};

export type BookingWithItems = Booking & { booking_items: BookingItem[] };

import type { Compatibility, Item, Settings } from "./types";

/**
 * Weekly/daily blend (≥7 days): floor(days/7) × weekly + (days % 7) × daily.
 * Falls back to straight daily when no weekly rate exists.
 */
export function blendedPrice(days: number, daily: number, weekly: number | null) {
  if (weekly == null || days < 7) return days * daily;
  return Math.floor(days / 7) * weekly + (days % 7) * daily;
}

export type RateMode = "daily" | "four_hour";

/**
 * Price for one cart/booking line, or null when it doesn't count toward the
 * total ("priced at pickup"): pricing toggled off, or no usable rate.
 * Add-ons price from their machine pairing; included pairings are free.
 */
export function linePrice(opts: {
  item: Pick<Item, "is_addon" | "pricing_enabled" | "daily_rate" | "weekly_rate" | "four_hour_rate">;
  pairing: Pick<Compatibility, "daily_rate" | "weekly_rate" | "included"> | null;
  days: number;
  rateMode?: RateMode;
}): number | null {
  const { item, pairing, days } = opts;
  if (!item.pricing_enabled) return null;

  if (item.is_addon) {
    if (!pairing) return null;
    if (pairing.included) return 0;
    if (pairing.daily_rate == null) return null;
    return blendedPrice(days, pairing.daily_rate, pairing.weekly_rate);
  }

  if (opts.rateMode === "four_hour" && item.four_hour_rate != null && days === 1) {
    return item.four_hour_rate;
  }
  if (item.daily_rate == null) return null;
  return blendedPrice(days, item.daily_rate, item.weekly_rate);
}

/** Delivery fee from one-way driving miles, per admin settings. */
export function deliveryFee(
  oneWayMiles: number,
  s: Pick<Settings, "delivery_min_fee" | "delivery_included_radius" | "delivery_per_mile">
) {
  const extra = Math.max(0, oneWayMiles - s.delivery_included_radius) * s.delivery_per_mile;
  return Math.round((s.delivery_min_fee + extra) * 100) / 100;
}

/**
 * Does a rental starting on `startDate` (local shop time, start of day)
 * clear the instant-confirm window, or does it come in as a request?
 */
export function isInstantConfirm(startDate: string, windowHours: number, now = new Date()) {
  const [y, m, d] = startDate.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  return start.getTime() - now.getTime() >= windowHours * 3600000;
}

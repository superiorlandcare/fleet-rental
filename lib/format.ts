import type { Item } from "./types";

export const money = (n: number) =>
  n % 1 === 0
    ? `$${n.toLocaleString("en-US")}`
    : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "$170/day · $765/wk · $155/4hr" or "Priced at pickup". */
export function ratesLine(item: Pick<Item, "pricing_enabled" | "daily_rate" | "weekly_rate" | "four_hour_rate">) {
  if (!item.pricing_enabled) return "Priced at pickup";
  const parts: string[] = [];
  if (item.daily_rate != null) parts.push(`${money(item.daily_rate)}/day`);
  if (item.weekly_rate != null) parts.push(`${money(item.weekly_rate)}/wk`);
  if (item.four_hour_rate != null) parts.push(`${money(item.four_hour_rate)}/4hr`);
  return parts.join(" · ") || "Priced at pickup";
}

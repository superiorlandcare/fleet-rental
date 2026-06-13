import type { Compatibility, Item, Settings } from "./types";
import { rentalDays } from "./dates";
import { linePrice, type RateMode } from "./pricing";

export type Fulfillment = "delivery" | "pickup";

export type CartLine = {
  key: string;
  itemId: string;
  /** For add-ons: the machine they're mounted on (resolves pairing + price). */
  attachedToItemId: string | null;
  start: string;
  end: string;
  rateMode: RateMode;
};

export type PricedLine = CartLine & {
  item: Item;
  pairing: Compatibility | null;
  days: number;
  /** 4-hour pricing only applies to single-day pickup rentals. */
  effectiveMode: RateMode;
  /** null = "priced at pickup", excluded from the total. */
  price: number | null;
};

export function priceLines(
  lines: CartLine[],
  items: Item[],
  compat: Compatibility[],
  fulfillment: Fulfillment
): PricedLine[] {
  return lines.flatMap((line) => {
    const item = items.find((i) => i.id === line.itemId);
    if (!item) return [];
    const pairing = line.attachedToItemId
      ? compat.find(
          (c) => c.machine_id === line.attachedToItemId && c.attachment_id === line.itemId
        ) ?? null
      : null;
    const days = rentalDays(line.start, line.end);
    const effectiveMode: RateMode =
      line.rateMode === "four_hour" &&
      fulfillment === "pickup" &&
      days === 1 &&
      !item.is_addon &&
      item.four_hour_rate != null
        ? "four_hour"
        : "daily";
    return [
      {
        ...line,
        item,
        pairing,
        days,
        effectiveMode,
        price: linePrice({ item, pairing, days, rateMode: effectiveMode }),
      },
    ];
  });
}

export function quoteTotals(
  priced: PricedLine[],
  settings: Pick<Settings, "deposit_amount"> | null,
  delivery: number | null
) {
  const itemsSubtotal = priced.reduce((sum, l) => sum + (l.price ?? 0), 0);
  const unpricedCount = priced.filter((l) => l.price === null).length;
  const deposit = settings?.deposit_amount ?? 0;
  const total = itemsSubtotal + (delivery ?? 0) + deposit;
  return { itemsSubtotal, unpricedCount, deposit, total };
}

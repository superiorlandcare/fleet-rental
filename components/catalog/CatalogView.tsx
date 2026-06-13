"use client";

import { useEffect, useMemo, useState } from "react";
import { Truck } from "lucide-react";
import type {
  AvailabilityRange,
  Category,
  Compatibility,
  Item,
  ItemPhoto,
  Settings,
} from "@/lib/types";
import { fmtDay, fmtRange, overlaps, rentalDays } from "@/lib/dates";
import { money, ratesLine } from "@/lib/format";
import { Row } from "@/components/ui";
import { artKind } from "./art";
import { Gallery } from "./Gallery";
import { AttachmentsRail, type RailEntry } from "./AttachmentsRail";
import { AvailabilityCalendar } from "./AvailabilityCalendar";

export function CatalogView({
  categories,
  items,
  photos,
  compat,
  settings,
}: {
  categories: Category[];
  items: Item[];
  photos: ItemPhoto[];
  compat: Compatibility[];
  settings: Settings | null;
}) {
  // Bookable (non-add-on) items grouped under their category, in sort order.
  const sections = useMemo(
    () =>
      categories
        .map((cat) => ({
          category: cat,
          items: items.filter((i) => i.category_id === cat.id && !i.is_addon),
        }))
        .filter((s) => s.items.length > 0),
    [categories, items]
  );

  const [selectedId, setSelectedId] = useState<string | null>(
    sections[0]?.items[0]?.id ?? null
  );
  const selected = items.find((i) => i.id === selectedId) ?? null;
  const selectedCategory = categories.find((c) => c.id === selected?.category_id);

  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);

  // Live availability — bare date ranges per item, no PII.
  const [ranges, setRanges] = useState<AvailabilityRange[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(true);
  useEffect(() => {
    fetch("/api/availability")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => Array.isArray(data) && setRanges(data))
      .catch(() => {})
      .finally(() => setLoadingAvail(false));
  }, []);

  const isBooked = (itemId: string, day: string) =>
    ranges.some((r) => r.item_id === itemId && r.start_date <= day && day <= r.end_date);
  const hasConflict = (itemId: string, s: string, e: string) =>
    ranges.some((r) => r.item_id === itemId && overlaps(s, e, r.start_date, r.end_date));

  const pick = (item: Item) => {
    setSelectedId(item.id);
    setStart(null);
    setEnd(null);
  };

  // Add-ons compatible with the selected machine, with pairing prices.
  const railEntries: RailEntry[] = useMemo(() => {
    if (!selected) return [];
    return compat
      .filter((c) => c.machine_id === selected.id)
      .map((pairing): RailEntry | null => {
        const attachment = items.find((i) => i.id === pairing.attachment_id);
        if (!attachment || !attachment.active) return null;
        const photo =
          photos.filter((p) => p.item_id === attachment.id).sort((a, b) => a.sort_order - b.sort_order)[0] ?? null;
        return { attachment, pairing, photo };
      })
      .filter((e): e is RailEntry => e !== null)
      .sort((a, b) => Number(a.pairing.included) - Number(b.pairing.included) || a.attachment.sort_order - b.attachment.sort_order);
  }, [selected, compat, items, photos]);

  const selectedPhotos = useMemo(
    () =>
      selected
        ? photos.filter((p) => p.item_id === selected.id).sort((a, b) => a.sort_order - b.sort_order)
        : [],
    [selected, photos]
  );

  const days = start && end ? rentalDays(start, end) : null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 bg-zinc-900/40">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-rapid-500 ring-1 ring-rapid-400/40">
              <Truck className="h-5 w-5 text-zinc-950" strokeWidth={2.4} />
            </div>
            <div>
              <div className="font-display text-lg font-bold leading-none tracking-wide">
                SUPERIOR LANDCARE <span className="text-rapid-500">LLC</span>
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-widest text-zinc-500">
                Equipment Rentals · Perry, Ohio · Live schedule
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-7">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-8">
            {sections.map(({ category, items: catItems }) => (
              <section key={category.id}>
                <div className="font-display mb-3 text-lg tracking-wide">{category.name}</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {catItems.map((item) => {
                    const on = selectedId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => pick(item)}
                        className={`rounded-lg border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rapid-400 ${
                          on
                            ? "border-rapid-500/60 bg-rapid-500/10"
                            : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-display text-xl font-bold ${on ? "text-rapid-400" : "text-zinc-200"}`}>
                            {item.name}
                          </span>
                          <span className={`h-2.5 w-2.5 rounded-full ${on ? "bg-rapid-500" : "bg-zinc-700"}`} />
                        </div>
                        <div className="mt-1 text-xs text-zinc-400">
                          {[item.maker, item.subtitle].filter(Boolean).join(" ")}
                        </div>
                        <div className="mt-2 text-[11px] uppercase tracking-wider text-zinc-500">
                          {ratesLine(item)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}

            {selected && selectedCategory && (
              <>
                <Gallery
                  item={selected}
                  photos={selectedPhotos}
                  artKind={artKind({
                    categoryName: selectedCategory.name,
                    subtitle: selected.subtitle,
                    sortOrder: selected.sort_order,
                  })}
                />

                <AttachmentsRail machineName={selected.name} entries={railEntries} />

                <AvailabilityCalendar
                  isBooked={(day) => isBooked(selected.id, day)}
                  hasConflict={(s, e) => hasConflict(selected.id, s, e)}
                  start={start}
                  end={end}
                  onPick={(s, e) => {
                    setStart(s);
                    setEnd(e);
                  }}
                  loading={loadingAvail}
                />
              </>
            )}
          </div>

          <aside className="h-fit rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 lg:sticky lg:top-5">
            <div className="font-display mb-3 text-sm uppercase tracking-wider text-zinc-400">
              Your rental
            </div>
            <div className="mb-4 space-y-2 text-sm">
              <Row label="Item">
                {selected ? <span className="text-rapid-400">{selected.name}</span> : "—"}
              </Row>
              <Row label="Dates">
                {start && end ? (
                  fmtRange(start, end)
                ) : start ? (
                  `${fmtDay(start)} — pick end`
                ) : (
                  <span className="text-zinc-600">none yet</span>
                )}
              </Row>
              {days !== null && (
                <Row label="Length">{days === 1 ? "1 day" : `${days} days`}</Row>
              )}
              {settings && (
                <Row label="Deposit">{money(settings.deposit_amount)} (every rental)</Row>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Pick an item and tap a start and end date on the calendar. Multi-item
              booking with delivery and a full quote is coming online in the next
              build step.
            </p>
          </aside>
        </div>
      </main>

      <footer className="border-t border-zinc-800">
        <div className="mx-auto max-w-5xl px-5 py-6 text-xs text-zinc-600">
          Superior Landcare LLC · {settings?.shop_address ?? "Perry, Ohio"}
        </div>
      </footer>
    </div>
  );
}

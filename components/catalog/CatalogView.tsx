"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Truck } from "lucide-react";
import type {
  AvailabilityRange,
  Category,
  Compatibility,
  Item,
  ItemPhoto,
  Settings,
} from "@/lib/types";
import { overlaps } from "@/lib/dates";
import { ratesLine } from "@/lib/format";
import type { CartLine, Fulfillment } from "@/lib/cart";
import { artKind } from "./art";
import { Gallery } from "./Gallery";
import { AttachmentsRail, type RailEntry } from "./AttachmentsRail";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import { CartRail, type DeliveryQuote } from "./CartRail";
import { PaymentStep, type BookingResult } from "./PaymentStep";

type Toast = { msg: string; kind: "ok" | "err" };

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

  // ---- cart ----
  const [lines, setLines] = useState<CartLine[]>([]);
  const [fulfillment, setFulfillment] = useState<Fulfillment>("pickup");
  const [address, setAddress] = useState("");
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);
  const flash = (msg: string, kind: Toast["kind"] = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2600);
  };

  const [result, setResult] = useState<BookingResult | null>(null);

  // Live availability — bare date ranges per item, no PII.
  const [ranges, setRanges] = useState<AvailabilityRange[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(true);
  const loadAvailability = () =>
    fetch("/api/availability")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => Array.isArray(data) && setRanges(data))
      .catch(() => {})
      .finally(() => setLoadingAvail(false));
  useEffect(() => {
    loadAvailability();
  }, []);

  const handleSubmitted = (r: BookingResult) => {
    setResult(r);
    setLines([]);
    setStart(null);
    setEnd(null);
    setAddress("");
    setDeliveryQuote(null);
    loadAvailability();
    window.scrollTo({ top: 0 });
  };

  // Booked = live ranges plus what's already in this cart.
  const isBooked = (itemId: string, day: string, excludeKey?: string) =>
    ranges.some((r) => r.item_id === itemId && r.start_date <= day && day <= r.end_date) ||
    lines.some((l) => l.itemId === itemId && l.key !== excludeKey && l.start <= day && day <= l.end);

  const hasConflict = (itemId: string, s: string, e: string, excludeKey?: string) =>
    ranges.some((r) => r.item_id === itemId && overlaps(s, e, r.start_date, r.end_date)) ||
    lines.some((l) => l.itemId === itemId && l.key !== excludeKey && overlaps(s, e, l.start, l.end));

  const pick = (item: Item) => {
    setSelectedId(item.id);
    setStart(null);
    setEnd(null);
  };

  const addSelected = () => {
    if (!selected || !start || !end) return;
    if (hasConflict(selected.id, start, end)) {
      flash("Those dates just got taken. Pick a clear stretch.", "err");
      setStart(null);
      setEnd(null);
      return;
    }
    setLines((ls) => [
      ...ls,
      {
        key: crypto.randomUUID(),
        itemId: selected.id,
        attachedToItemId: null,
        start,
        end,
        rateMode: "daily",
      },
    ]);
    setStart(null);
    setEnd(null);
    flash(`${selected.name} added to your rental`);
  };

  // ---- add-ons ----
  const machineLineFor = (machineId: string) =>
    lines.find((l) => l.itemId === machineId && !l.attachedToItemId) ?? null;

  const canAddAttachment = (entry: RailEntry): { ok: boolean; reason?: string } => {
    if (!selected) return { ok: false };
    const machineLine = machineLineFor(selected.id);
    if (!machineLine)
      return { ok: false, reason: `Add the ${selected.name} to your rental first.` };
    if (hasConflict(entry.attachment.id, machineLine.start, machineLine.end))
      return { ok: false, reason: "Not available for your machine's dates." };
    return { ok: true };
  };

  const addAttachment = (entry: RailEntry) => {
    if (!selected) return;
    const machineLine = machineLineFor(selected.id);
    if (!machineLine) return;
    setLines((ls) => [
      ...ls,
      {
        key: crypto.randomUUID(),
        itemId: entry.attachment.id,
        attachedToItemId: selected.id,
        start: machineLine.start,
        end: machineLine.end,
        rateMode: "daily",
      },
    ]);
    flash(`${entry.attachment.name} added for the ${selected.name}`);
  };

  // ---- cart line ops ----
  const updateDates = (key: string, s: string, e: string) => {
    if (!s) return;
    const fixedEnd = e && e >= s ? e : s;
    const line = lines.find((l) => l.key === key);
    if (!line) return;
    if (hasConflict(line.itemId, s, fixedEnd, key)) {
      flash("Those dates run into a booked day for that item.", "err");
      return;
    }
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, start: s, end: fixedEnd } : l)));
  };

  const setRateMode = (key: string, mode: "daily" | "four_hour") =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, rateMode: mode } : l)));

  const removeLine = (key: string) => {
    const line = lines.find((l) => l.key === key);
    if (!line) return;
    setLines((ls) => {
      let next = ls.filter((l) => l.key !== key);
      // Removing a machine's last line drops the add-ons riding on it.
      if (!line.attachedToItemId && !next.some((l) => l.itemId === line.itemId && !l.attachedToItemId)) {
        next = next.filter((l) => l.attachedToItemId !== line.itemId);
      }
      return next;
    });
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
      .sort(
        (a, b) =>
          Number(b.pairing.included) - Number(a.pairing.included) ||
          a.attachment.sort_order - b.attachment.sort_order
      );
  }, [selected, compat, items, photos]);

  const selectedPhotos = useMemo(
    () =>
      selected
        ? photos.filter((p) => p.item_id === selected.id).sort((a, b) => a.sort_order - b.sort_order)
        : [],
    [selected, photos]
  );

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

      {toast && (
        <div
          className={`fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-2 rounded-md px-4 py-2.5 text-sm shadow-lg ${
            toast.kind === "err" ? "bg-red-500 text-white" : "bg-rapid-500 text-zinc-950"
          }`}
        >
          {toast.kind === "err" ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {result ? (
        <PaymentStep result={result} onDone={() => setResult(null)} />
      ) : (
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

                <AttachmentsRail
                  machineName={selected.name}
                  entries={railEntries}
                  canAdd={canAddAttachment}
                  onAdd={addAttachment}
                />

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

          <CartRail
            lines={lines}
            items={items}
            compat={compat}
            settings={settings}
            selected={selected}
            pendingStart={start}
            pendingEnd={end}
            onAddSelected={addSelected}
            onUpdateDates={updateDates}
            onSetRateMode={setRateMode}
            onRemove={removeLine}
            fulfillment={fulfillment}
            onFulfillment={setFulfillment}
            address={address}
            onAddress={setAddress}
            deliveryQuote={deliveryQuote}
            onDeliveryQuote={setDeliveryQuote}
            onSubmitted={handleSubmitted}
            onConflict={loadAvailability}
          />
        </div>
      </main>
      )}

      <footer className="border-t border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 text-xs text-zinc-600">
          <span>Superior Landcare LLC · {settings?.shop_address ?? "Perry, Ohio"}</span>
          <a href="/login" className="transition hover:text-zinc-400">
            Admin
          </a>
        </div>
      </footer>
    </div>
  );
}

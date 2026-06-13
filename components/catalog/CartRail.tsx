"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import type { Compatibility, Item, Settings } from "@/lib/types";
import { fmtDay, fmtRange, rentalDays, todayISO } from "@/lib/dates";
import { money } from "@/lib/format";
import { isInstantConfirm } from "@/lib/pricing";
import { priceLines, quoteTotals, type CartLine, type Fulfillment } from "@/lib/cart";
import { Field, Row } from "@/components/ui";

export type DeliveryQuote = { miles: number; fee: number };

export function CartRail({
  lines,
  items,
  compat,
  settings,
  selected,
  pendingStart,
  pendingEnd,
  onAddSelected,
  onUpdateDates,
  onSetRateMode,
  onRemove,
  fulfillment,
  onFulfillment,
  address,
  onAddress,
  deliveryQuote,
  onDeliveryQuote,
}: {
  lines: CartLine[];
  items: Item[];
  compat: Compatibility[];
  settings: Settings | null;
  selected: Item | null;
  pendingStart: string | null;
  pendingEnd: string | null;
  onAddSelected: () => void;
  onUpdateDates: (key: string, start: string, end: string) => void;
  onSetRateMode: (key: string, mode: "daily" | "four_hour") => void;
  onRemove: (key: string) => void;
  fulfillment: Fulfillment;
  onFulfillment: (f: Fulfillment) => void;
  address: string;
  onAddress: (a: string) => void;
  deliveryQuote: DeliveryQuote | null;
  onDeliveryQuote: (q: DeliveryQuote | null) => void;
}) {
  const [checkingFee, setCheckingFee] = useState(false);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const priced = useMemo(
    () => priceLines(lines, items, compat, fulfillment),
    [lines, items, compat, fulfillment]
  );
  const deliveryFee = fulfillment === "delivery" ? (deliveryQuote?.fee ?? null) : null;
  const totals = quoteTotals(priced, settings, deliveryFee);

  const earliestStart = lines.length
    ? lines.reduce((min, l) => (l.start < min ? l.start : min), lines[0].start)
    : null;
  const instant =
    earliestStart && settings
      ? isInstantConfirm(earliestStart, settings.request_window_hours)
      : null;

  const checkFee = async () => {
    setFeeError(null);
    setCheckingFee(true);
    onDeliveryQuote(null);
    try {
      const res = await fetch("/api/distance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) setFeeError(data.error ?? "Couldn't compute the delivery fee.");
      else onDeliveryQuote({ miles: data.miles, fee: data.fee });
    } catch {
      setFeeError("Couldn't compute the delivery fee. Try again.");
    } finally {
      setCheckingFee(false);
    }
  };

  const today = todayISO();

  return (
    <aside className="h-fit rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 lg:sticky lg:top-5">
      <div className="font-display mb-3 text-sm uppercase tracking-wider text-zinc-400">
        Your rental
      </div>

      {/* current selection → add */}
      <div className="mb-4 space-y-2 text-sm">
        <Row label="Selected">
          {selected ? <span className="text-rapid-400">{selected.name}</span> : "—"}
        </Row>
        <Row label="Dates">
          {pendingStart && pendingEnd ? (
            fmtRange(pendingStart, pendingEnd)
          ) : pendingStart ? (
            `${fmtDay(pendingStart)} — pick end`
          ) : (
            <span className="text-zinc-600">tap the calendar</span>
          )}
        </Row>
      </div>
      <button
        type="button"
        disabled={!selected || !pendingStart || !pendingEnd}
        onClick={onAddSelected}
        className="font-display mb-4 flex w-full items-center justify-center gap-1.5 rounded-md bg-rapid-500 py-2.5 font-semibold tracking-wide text-zinc-950 transition hover:bg-rapid-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-rapid-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
      >
        <Plus className="h-4 w-4" />
        Add to rental
      </button>

      {/* cart lines */}
      {priced.length > 0 && (
        <div className="mb-4 divide-y divide-zinc-800 border-y border-zinc-800">
          {priced.map((l) => {
            const machine = l.attachedToItemId
              ? items.find((i) => i.id === l.attachedToItemId)
              : null;
            const fourHourEligible =
              !l.item.is_addon && l.item.four_hour_rate != null && l.days === 1;
            return (
              <div key={l.key} className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm text-zinc-100">
                      {l.item.name}
                      {machine && <span className="text-zinc-500"> · on {machine.name}</span>}
                    </div>
                    {l.pairing?.included && (
                      <div className="text-[11px] text-rapid-400">Included free</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-200">
                      {l.price === null ? (
                        <span className="text-zinc-500">at pickup</span>
                      ) : l.price === 0 ? (
                        "Free"
                      ) : (
                        money(l.price)
                      )}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${l.item.name}`}
                      onClick={() => onRemove(l.key)}
                      className="rounded bg-zinc-800 p-1 transition hover:bg-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                {!l.pairing?.included && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="date"
                      value={l.start}
                      min={today}
                      onChange={(e) => onUpdateDates(l.key, e.target.value, l.end)}
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 [color-scheme:dark] focus:border-rapid-500 focus:outline-none"
                    />
                    <span className="text-zinc-600">–</span>
                    <input
                      type="date"
                      value={l.end}
                      min={l.start}
                      onChange={(e) => onUpdateDates(l.key, l.start, e.target.value)}
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 [color-scheme:dark] focus:border-rapid-500 focus:outline-none"
                    />
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
                  <span>{l.days === 1 ? "1 day" : `${l.days} days`}</span>
                  {fourHourEligible && (
                    <div className="flex gap-1">
                      {(["daily", "four_hour"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          disabled={mode === "four_hour" && fulfillment === "delivery"}
                          onClick={() => onSetRateMode(l.key, mode)}
                          className={`rounded px-1.5 py-0.5 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                            l.effectiveMode === mode
                              ? "bg-rapid-500/20 text-rapid-300"
                              : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {mode === "daily" ? "Full day" : "4-hour"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {l.effectiveMode === "four_hour" && (
                  <div className="mt-1 text-[11px] text-zinc-500">
                    4-hour rentals are pickup-only; not back in the window bills a full day.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* fulfillment */}
      <div className="mb-3">
        <div className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500">
          Delivery or pickup
        </div>
        <div className="flex gap-2">
          {(
            [
              ["pickup", "Pickup"],
              ["delivery", "Delivery"],
            ] as const
          ).map(([f, label]) => (
            <button
              key={f}
              type="button"
              onClick={() => onFulfillment(f)}
              className={`font-display flex-1 rounded py-1.5 text-sm tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rapid-400 ${
                fulfillment === f
                  ? "bg-rapid-500 font-semibold text-zinc-950"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {fulfillment === "delivery" ? (
        <div className="mb-3">
          <Field
            label="Delivery address"
            value={address}
            onChange={(v) => {
              onAddress(v);
              onDeliveryQuote(null);
              setFeeError(null);
            }}
            placeholder="Street, city, state"
          />
          <button
            type="button"
            disabled={checkingFee || address.trim().length < 8}
            onClick={checkFee}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 py-2 text-sm text-zinc-200 transition hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checkingFee ? "Checking distance…" : "Check delivery fee"}
          </button>
          {deliveryQuote && (
            <div className="mt-2 text-xs text-zinc-400">
              {deliveryQuote.miles} mi one way · delivery {money(deliveryQuote.fee)}
            </div>
          )}
          {feeError && <div className="mt-2 text-xs text-red-400">{feeError}</div>}
        </div>
      ) : (
        settings && (
          <p className="mb-3 text-[11px] leading-relaxed text-zinc-500">
            Pickup at {settings.shop_address}.
          </p>
        )
      )}

      {/* quote */}
      <div className="mb-4 space-y-2 border-t border-zinc-800 pt-3 text-sm">
        <Row label="Items">
          {totals.unpricedCount === priced.length && priced.length > 0
            ? "Priced at pickup"
            : money(totals.itemsSubtotal)}
        </Row>
        {totals.unpricedCount > 0 && totals.unpricedCount < priced.length && (
          <div className="text-[11px] text-zinc-500">
            + {totals.unpricedCount} item{totals.unpricedCount > 1 ? "s" : ""} priced at pickup
          </div>
        )}
        {fulfillment === "delivery" && (
          <Row label="Delivery">
            {deliveryQuote ? money(deliveryQuote.fee) : <span className="text-zinc-600">check address</span>}
          </Row>
        )}
        {settings && <Row label="Deposit">{money(settings.deposit_amount)}</Row>}
        <div className="flex justify-between border-t border-zinc-800 pt-2 font-semibold">
          <span className="text-zinc-300">Out the door</span>
          <span className="text-rapid-400">{money(totals.total)}</span>
        </div>
        {instant !== null && (
          <div
            className={`rounded px-2 py-1.5 text-[11px] leading-relaxed ${
              instant ? "bg-emerald-500/10 text-emerald-400" : "bg-rapid-500/10 text-rapid-300"
            }`}
          >
            {instant
              ? "Starts more than 48 hours out — books instantly."
              : "Starts within 48 hours — comes in as a request we'll approve fast."}
          </div>
        )}
      </div>

      {/* customer + submit (wired to /api/reservations in the next step) */}
      <Field label="Name" value={name} onChange={setName} placeholder="Jordan / company" />
      <Field label="Phone" value={phone} onChange={setPhone} placeholder="440-555-0100" type="tel" />
      <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
      <button
        type="button"
        disabled
        className="font-display w-full cursor-not-allowed rounded-md bg-zinc-800 py-2.5 font-semibold tracking-wide text-zinc-500"
      >
        Book these dates
      </button>
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
        Booking goes live in the next build step. Every rental carries a{" "}
        {settings ? money(settings.deposit_amount) : "$250"} upfront deposit; you&apos;ll get the
        full quote and payment details after you submit.
      </p>
    </aside>
  );
}

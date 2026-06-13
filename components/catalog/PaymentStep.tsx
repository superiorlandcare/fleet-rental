"use client";

import { Check, Clock } from "lucide-react";
import { fmtRange } from "@/lib/dates";
import { money } from "@/lib/format";
import { Row } from "@/components/ui";

export type BookingResult = {
  id: string;
  status: "confirmed" | "requested";
  quote: {
    lines: {
      name: string;
      machine: string | null;
      start: string;
      end: string;
      days: number;
      fourHour: boolean;
      price: number | null;
    }[];
    itemsSubtotal: number;
    unpricedCount: number;
    deliveryMiles: number | null;
    deliveryFee: number | null;
    deposit: number;
    total: number;
  };
  payment: { venmo: string | null; cashapp: string | null; zelle: string | null };
  fulfillment: "delivery" | "pickup";
  address: string | null;
  shopAddress: string;
};

/** Post-submit screen: status, full quote, the payment handles, and terms. */
export function PaymentStep({ result, onDone }: { result: BookingResult; onDone: () => void }) {
  const confirmed = result.status === "confirmed";
  const q = result.quote;

  const handles = [
    ["Venmo", result.payment.venmo],
    ["CashApp", result.payment.cashapp],
    ["Zelle", result.payment.zelle],
  ].filter((h): h is [string, string] => !!h[1]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div
        className={`mb-6 flex items-center gap-3 rounded-lg border p-4 ${
          confirmed
            ? "border-emerald-500/40 bg-emerald-500/10"
            : "border-rapid-500/40 bg-rapid-500/10"
        }`}
      >
        <div
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
            confirmed ? "bg-emerald-500" : "bg-rapid-500"
          } text-zinc-950`}
        >
          {confirmed ? <Check className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
        </div>
        <div>
          <div className="font-display text-lg tracking-wide">
            {confirmed ? "You're booked!" : "Request received"}
          </div>
          <div className="text-sm text-zinc-400">
            {confirmed
              ? "Your dates are locked in. We've emailed you the details."
              : "Your rental starts soon, so we'll confirm it personally — watch for a call or text. We've emailed you the details."}
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="font-display mb-3 text-sm uppercase tracking-wider text-zinc-400">
          Your quote
        </div>
        <div className="divide-y divide-zinc-800 text-sm">
          {q.lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2">
              <div>
                <span className="text-zinc-100">{l.name}</span>
                {l.machine && <span className="text-zinc-500"> · on {l.machine}</span>}
                <div className="text-xs text-zinc-500">
                  {fmtRange(l.start, l.end)} ·{" "}
                  {l.fourHour ? "4-hour" : `${l.days} day${l.days > 1 ? "s" : ""}`}
                </div>
              </div>
              <span className="text-zinc-200">
                {l.price === null ? <span className="text-zinc-500">at pickup</span> : money(l.price)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3 text-sm">
          <Row label="Items">{money(q.itemsSubtotal)}</Row>
          {result.fulfillment === "delivery" && (
            <Row label={`Delivery${q.deliveryMiles != null ? ` (${q.deliveryMiles} mi)` : ""}`}>
              {q.deliveryFee != null ? money(q.deliveryFee) : "we'll confirm the fee"}
            </Row>
          )}
          <Row label="Deposit (upfront)">{money(q.deposit)}</Row>
          <div className="flex justify-between border-t border-zinc-800 pt-2 font-semibold">
            <span className="text-zinc-300">Out the door</span>
            <span className="text-rapid-400">{money(q.total)}</span>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-rapid-500/40 bg-zinc-900/40 p-4">
        <div className="font-display mb-3 text-sm uppercase tracking-wider text-rapid-400">
          How to pay
        </div>
        <div className="space-y-2 text-sm">
          {handles.map(([label, handle]) => (
            <div key={label} className="flex items-center justify-between rounded bg-zinc-950 px-3 py-2">
              <span className="text-zinc-400">{label}</span>
              <span className="font-mono text-zinc-100">{handle}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          Send the {money(q.deposit)} deposit (or the full amount) to any handle above and
          we&apos;ll mark you paid. Include your name in the payment note.
        </p>
      </div>

      <div className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="font-display mb-2 text-sm uppercase tracking-wider text-zinc-400">
          The fine print
        </div>
        <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-zinc-400">
          <li>{money(q.deposit)} deposit is due upfront with every rental.</li>
          <li>Return equipment with a full tank of fuel.</li>
          <li>Machine hours are capped per rental day — overages are billed at return.</li>
          <li>Bring it back clean — cleaning fees apply otherwise.</li>
          <li>The rental form is signed and keys are handed off in person at {result.fulfillment === "delivery" ? "delivery" : "pickup"}.</li>
        </ul>
      </div>

      <button
        type="button"
        onClick={onDone}
        className="font-display w-full rounded-md bg-rapid-500 py-2.5 font-semibold tracking-wide text-zinc-950 transition hover:bg-rapid-400"
      >
        Back to the catalog
      </button>
    </div>
  );
}

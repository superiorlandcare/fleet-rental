"use client";

import { useState } from "react";
import { CalendarDays, Check, Lock, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fmtRange, todayISO } from "@/lib/dates";
import { money } from "@/lib/format";
import type { BookingWithItems } from "@/lib/types";
import { Field } from "@/components/ui";
import type { AdminData } from "./AdminApp";

export function BookingsPanel({
  data,
  refresh,
  flash,
}: {
  data: AdminData;
  refresh: () => Promise<void>;
  flash: (msg: string, kind?: "ok" | "err") => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const itemName = (id: string) => data.items.find((i) => i.id === id)?.name ?? "item";

  const act = async (id: string, action: string, okMsg: string) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        flash(d.error ?? "That didn't work.", "err");
      } else {
        flash(okMsg);
        await refresh();
      }
    } finally {
      setBusyId(null);
    }
  };

  const requests = data.bookings.filter(
    (b) => b.type === "reservation" && b.status === "requested"
  );

  const earliest = (b: BookingWithItems) =>
    b.booking_items.reduce(
      (m, l) => (l.start_date < m ? l.start_date : m),
      b.booking_items[0]?.start_date ?? "9999-12-31"
    );
  const sorted = [...data.bookings].sort((a, b) => earliest(a).localeCompare(earliest(b)));

  const summary = (b: BookingWithItems) =>
    b.booking_items
      .map(
        (l) =>
          `${itemName(l.item_id)}${l.four_hour ? " (4hr)" : ""} ${fmtRange(l.start_date, l.end_date)}`
      )
      .join(" · ");

  return (
    <div className="space-y-6">
      {/* requests queue */}
      {requests.length > 0 && (
        <div className="rounded-lg border border-rapid-500/40 bg-rapid-500/5 p-4">
          <div className="font-display mb-3 text-sm uppercase tracking-wider text-rapid-400">
            Requests waiting on you ({requests.length})
          </div>
          <div className="divide-y divide-zinc-800">
            {requests.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-[200px] flex-1">
                  <div className="text-sm text-zinc-100">{summary(b)}</div>
                  <div className="mt-0.5 text-xs text-zinc-400">
                    {b.customer_name} · {b.customer_phone} · {b.customer_email}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {b.fulfillment === "delivery" ? `Delivery: ${b.address ?? "—"}` : "Pickup"}
                    {b.estimated_total != null && ` · est ${money(b.estimated_total)}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === b.id}
                    onClick={() => act(b.id, "approve", "Approved — customer notified")}
                    className="font-display flex items-center gap-1 rounded bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === b.id}
                    onClick={() => act(b.id, "decline", "Declined — customer notified")}
                    className="font-display flex items-center gap-1 rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <BlockForm data={data} refresh={refresh} flash={flash} />

        {/* everything on the books */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="font-display mb-3 flex items-center gap-2 text-sm uppercase tracking-wider text-zinc-400">
            <CalendarDays className="h-3.5 w-3.5" /> Everything on the books
          </div>
          {sorted.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-500">
              Nothing booked yet. Reservations and your blocks will land here.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {sorted.map((b) => (
                <div
                  key={b.id}
                  className={`flex flex-wrap items-center gap-3 py-3 ${
                    b.status === "cancelled" ? "opacity-45" : ""
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                      b.type === "block" ? "bg-zinc-500" : "bg-rapid-500"
                    }`}
                  />
                  <div className="min-w-[200px] flex-1">
                    <div className="text-sm text-zinc-100">{summary(b)}</div>
                    <div className="mt-0.5 text-xs text-zinc-400">
                      {b.type === "block" ? (
                        <span className="text-rapid-300/80">Block — {b.reason ?? "owner use"}</span>
                      ) : (
                        <>
                          {b.customer_name} · {b.customer_phone} · {b.customer_email}
                          <span className="text-zinc-600">
                            {" "}
                            · {b.fulfillment === "delivery" ? `delivery: ${b.address}` : "pickup"}
                            {b.estimated_total != null && ` · ${money(b.estimated_total)}`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {b.type === "reservation" && (
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                        b.status === "confirmed"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : b.status === "requested"
                            ? "bg-rapid-500/15 text-rapid-400"
                            : "bg-zinc-700/40 text-zinc-400"
                      }`}
                    >
                      {b.status}
                    </span>
                  )}
                  {b.type === "reservation" && b.status !== "cancelled" && (
                    <button
                      type="button"
                      disabled={busyId === b.id}
                      onClick={() =>
                        act(b.id, b.paid ? "unpaid" : "paid", b.paid ? "Marked unpaid" : "Marked paid")
                      }
                      className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider transition ${
                        b.paid
                          ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                          : "bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                      }`}
                    >
                      {b.paid ? "Paid ✓" : "Mark paid"}
                    </button>
                  )}
                  <div className="flex gap-1">
                    {b.type === "reservation" && b.status === "requested" && (
                      <button
                        type="button"
                        title="Approve"
                        disabled={busyId === b.id}
                        onClick={() => act(b.id, "approve", "Approved — customer notified")}
                        className="rounded bg-zinc-800 p-1.5 transition hover:bg-emerald-500 hover:text-zinc-950"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {b.type === "reservation" && b.status !== "cancelled" && (
                      <button
                        type="button"
                        title="Cancel booking"
                        disabled={busyId === b.id}
                        onClick={() => {
                          if (confirm("Cancel this booking? The customer will be emailed."))
                            act(b.id, "cancel", "Cancelled — customer notified");
                        }}
                        className="rounded bg-zinc-800 p-1.5 transition hover:bg-red-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {b.type === "block" && (
                      <button
                        type="button"
                        title="Remove block"
                        disabled={busyId === b.id}
                        onClick={async () => {
                          setBusyId(b.id);
                          const { error } = await createClient()
                            .from("bookings")
                            .delete()
                            .eq("id", b.id);
                          setBusyId(null);
                          if (error) flash("Couldn't remove that block.", "err");
                          else {
                            flash("Block removed");
                            await refresh();
                          }
                        }}
                        className="rounded bg-zinc-800 p-1.5 transition hover:bg-red-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BlockForm({
  data,
  refresh,
  flash,
}: {
  data: AdminData;
  refresh: () => Promise<void>;
  flash: (msg: string, kind?: "ok" | "err") => void;
}) {
  const blockable = data.items.filter(
    (i) =>
      i.active &&
      (!i.is_addon || data.compat.some((c) => c.attachment_id === i.id && !c.included))
  );
  const [itemId, setItemId] = useState(blockable[0]?.id ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const addBlock = async () => {
    if (!itemId || !from || !to) return flash("Pick an item and both dates.", "err");
    if (to < from) return flash("End date can't be before the start.", "err");
    setBusy(true);
    const supabase = createClient();
    const { data: booking, error } = await supabase
      .from("bookings")
      .insert({ type: "block", status: "confirmed", reason: reason.trim() || "Owner use" })
      .select("id")
      .single();
    if (error || !booking) {
      setBusy(false);
      return flash("Couldn't create the block.", "err");
    }
    const { error: lineErr } = await supabase.from("booking_items").insert({
      booking_id: booking.id,
      item_id: itemId,
      start_date: from,
      end_date: to,
    });
    if (lineErr) {
      await supabase.from("bookings").delete().eq("id", booking.id);
      setBusy(false);
      return flash(
        lineErr.code === "23P01"
          ? "That overlaps something already on the calendar."
          : "Couldn't create the block.",
        "err"
      );
    }
    setBusy(false);
    setFrom("");
    setTo("");
    setReason("");
    flash(`Blocked ${data.items.find((i) => i.id === itemId)?.name} ${fmtRange(from, to)}`);
    await refresh();
  };

  return (
    <div className="h-fit rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="font-display mb-3 flex items-center gap-2 text-sm uppercase tracking-wider text-zinc-400">
        <Lock className="h-3.5 w-3.5" /> Block off days
      </div>
      <div className="mb-3">
        <div className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500">Item</div>
        <select
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-rapid-500 focus:outline-none"
        >
          {blockable.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-3">
        <div className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500">From</div>
        <input
          type="date"
          value={from}
          min={todayISO()}
          onChange={(e) => setFrom(e.target.value)}
          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 [color-scheme:dark] focus:border-rapid-500 focus:outline-none"
        />
      </div>
      <div className="mb-3">
        <div className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500">To</div>
        <input
          type="date"
          value={to}
          min={from || todayISO()}
          onChange={(e) => setTo(e.target.value)}
          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 [color-scheme:dark] focus:border-rapid-500 focus:outline-none"
        />
      </div>
      <Field label="Reason (optional)" value={reason} onChange={setReason} placeholder="Personal job, maintenance…" />
      <button
        type="button"
        disabled={busy}
        onClick={addBlock}
        className="font-display flex w-full items-center justify-center gap-1.5 rounded-md bg-zinc-100 py-2 font-semibold tracking-wide text-zinc-950 transition hover:bg-white disabled:opacity-50"
      >
        <Plus className="h-4 w-4" /> Block these days
      </button>
    </div>
  );
}

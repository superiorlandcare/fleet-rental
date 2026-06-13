"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { iso, parseISO, todayISO } from "@/lib/dates";
import { Legend, NavBtn } from "@/components/ui";
import type { AdminData } from "./AdminApp";

/** Month board: one row per bookable item, day cells colored by what holds them. */
export function ScheduleBoard({ data }: { data: AdminData }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const dayList = Array.from({ length: daysInMonth }, (_, i) =>
    iso(new Date(cursor.y, cursor.m, i + 1))
  );
  const today = todayISO();

  // Rows: every active item that can actually hold a booking — skip add-ons
  // that are only ever included free (smooth bucket).
  const rows = data.items.filter((item) => {
    if (!item.active) return false;
    if (!item.is_addon) return true;
    return data.compat.some((c) => c.attachment_id === item.id && !c.included);
  });

  const dayState = (itemId: string, day: string) => {
    for (const b of data.bookings) {
      if (b.status === "cancelled") continue;
      for (const l of b.booking_items) {
        if (l.item_id !== itemId || !l.active) continue;
        if (l.start_date <= day && day <= l.end_date)
          return { booking: b, line: l };
      }
    }
    return null;
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-display text-base tracking-wide">{monthLabel}</div>
        <div className="flex gap-1">
          <NavBtn
            label="Previous month"
            onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}
          >
            <ChevronLeft className="h-4 w-4" />
          </NavBtn>
          <NavBtn
            label="Next month"
            onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}
          >
            <ChevronRight className="h-4 w-4" />
          </NavBtn>
        </div>
      </div>
      <div className="space-y-2 overflow-x-auto pb-1">
        {rows.map((item) => (
          <div key={item.id} className="flex min-w-[640px] items-center gap-3">
            <div className="w-24 shrink-0 text-right">
              <div className="font-display truncate text-sm text-rapid-400">{item.name}</div>
            </div>
            <div className="flex flex-1 gap-[3px]">
              {dayList.map((day) => {
                const hit = dayState(item.id, day);
                let cls = "bg-zinc-800/60";
                let title = `${parseISO(day).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · open`;
                if (hit) {
                  const { booking } = hit;
                  if (booking.type === "block") {
                    cls = "hazard";
                    title = `${parseISO(day).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · block — ${booking.reason ?? "owner use"}`;
                  } else {
                    cls = booking.status === "requested" ? "bg-rapid-500/40" : "bg-rapid-500";
                    title = `${parseISO(day).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${
                      booking.status === "requested" ? "REQUEST" : "reserved"
                    } — ${booking.customer_name ?? ""}`;
                  }
                }
                return (
                  <div
                    key={day}
                    title={title}
                    className={`h-7 flex-1 rounded-sm ${cls} ${day === today ? "ring-1 ring-zinc-100" : ""}`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400">
        <Legend className="bg-rapid-500">Reserved</Legend>
        <Legend className="bg-rapid-500/40">Pending request</Legend>
        <Legend className="hazard">Your block</Legend>
        <Legend className="bg-zinc-800/60">Open</Legend>
      </div>
    </div>
  );
}

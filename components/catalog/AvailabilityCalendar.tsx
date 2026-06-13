"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthGrid, parseISO, todayISO } from "@/lib/dates";
import { Legend, NavBtn } from "@/components/ui";

export function AvailabilityCalendar({
  isBooked,
  hasConflict,
  start,
  end,
  onPick,
  loading,
}: {
  /** Is this single day unavailable for the current item? */
  isBooked: (day: string) => boolean;
  /** Does [start, day] cross any unavailable day? */
  hasConflict: (start: string, end: string) => boolean;
  start: string | null;
  end: string | null;
  onPick: (start: string | null, end: string | null) => void;
  loading?: boolean;
}) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [error, setError] = useState<string | null>(null);

  const today = todayISO();
  const cells = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const clickDay = (day: string) => {
    setError(null);
    if (day < today || isBooked(day)) return;
    if (!start || (start && end)) return onPick(day, null);
    if (day < start) return onPick(day, null);
    if (hasConflict(start, day)) {
      setError("Those dates run into a booked day. Pick a clear stretch.");
      return onPick(null, null);
    }
    onPick(start, day);
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-display text-base tracking-wide">
          {monthLabel}
          {loading && <span className="ml-2 text-xs font-normal text-zinc-500">loading availability…</span>}
        </div>
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
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-zinc-500">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const past = day < today;
          const booked = !past && isBooked(day);
          const inRange = start ? (end ? day >= start && day <= end : day === start) : false;
          let cls = "text-zinc-200 hover:bg-zinc-800";
          if (past) cls = "text-zinc-700 cursor-not-allowed";
          else if (booked) cls = "bg-zinc-700 text-zinc-400 line-through cursor-not-allowed";
          if (inRange) cls = "bg-rapid-500 text-zinc-950 font-bold";
          return (
            <button
              key={i}
              type="button"
              disabled={past || booked}
              onClick={() => clickDay(day)}
              className={`grid aspect-square place-items-center rounded text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rapid-400 ${cls}`}
            >
              {parseISO(day).getDate()}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400">
        <Legend className="bg-rapid-500">Your pick</Legend>
        <Legend className="bg-zinc-700">Unavailable</Legend>
      </div>
      {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
    </div>
  );
}

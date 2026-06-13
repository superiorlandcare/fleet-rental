"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  BookingWithItems,
  Category,
  Compatibility,
  Item,
  ItemPhoto,
  Settings,
} from "@/lib/types";
import { ScheduleBoard } from "./ScheduleBoard";
import { BookingsPanel } from "./BookingsPanel";
import { CatalogPanel } from "./CatalogPanel";
import { SettingsPanel } from "./SettingsPanel";

const TABS = [
  ["schedule", "Schedule"],
  ["bookings", "Bookings"],
  ["catalog", "Catalog"],
  ["settings", "Settings"],
] as const;
type Tab = (typeof TABS)[number][0];

export type AdminData = {
  categories: Category[];
  items: Item[];
  photos: ItemPhoto[];
  compat: Compatibility[];
  settings: Settings | null;
  bookings: BookingWithItems[];
};

export function AdminApp() {
  const [tab, setTab] = useState<Tab>("schedule");
  const [data, setData] = useState<AdminData | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  const flash = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [categories, items, photos, compat, settings, bookings] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("items").select("*").order("sort_order"),
      supabase.from("item_photos").select("*").order("sort_order"),
      supabase.from("item_compatibility").select("*"),
      supabase.from("settings").select("*").single(),
      supabase
        .from("bookings")
        .select("*, booking_items(*)")
        .order("created_at", { ascending: false }),
    ]);
    setData({
      categories: (categories.data ?? []) as Category[],
      items: (items.data ?? []) as Item[],
      photos: (photos.data ?? []) as ItemPhoto[],
      compat: (compat.data ?? []) as Compatibility[],
      settings: (settings.data ?? null) as Settings | null,
      bookings: (bookings.data ?? []) as BookingWithItems[],
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!data)
    return <div className="py-20 text-center text-sm text-zinc-500">Loading the schedule…</div>;

  return (
    <div>
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

      <div className="mb-6 flex w-fit rounded-md border border-zinc-800 bg-zinc-900 p-1 text-sm">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`font-display rounded px-3 py-1.5 tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rapid-400 ${
              tab === k ? "bg-rapid-500 font-semibold text-zinc-950" : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "schedule" && <ScheduleBoard data={data} />}
      {tab === "bookings" && <BookingsPanel data={data} refresh={refresh} flash={flash} />}
      {tab === "catalog" && <CatalogPanel data={data} refresh={refresh} flash={flash} />}
      {tab === "settings" && <SettingsPanel data={data} refresh={refresh} flash={flash} />}
    </div>
  );
}

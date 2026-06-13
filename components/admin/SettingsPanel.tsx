"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdminData } from "./AdminApp";

const FIELDS = [
  { key: "shop_address", label: "Shop address (delivery origin & pickup location)", type: "text" },
  { key: "delivery_min_fee", label: "Delivery minimum fee ($)", type: "number" },
  { key: "delivery_included_radius", label: "Miles included in the minimum (one-way)", type: "number" },
  { key: "delivery_per_mile", label: "Per-mile rate beyond the radius ($)", type: "number" },
  { key: "deposit_amount", label: "Deposit on every rental ($)", type: "number" },
  { key: "request_window_hours", label: "Request window (hours — sooner starts need approval)", type: "number" },
  { key: "hour_cap_per_day", label: "Machine hours included per rental day", type: "number" },
  { key: "overage_per_hour", label: "Overage rate per machine hour ($)", type: "number" },
  { key: "venmo", label: "Venmo handle", type: "text" },
  { key: "cashapp", label: "CashApp handle", type: "text" },
  { key: "zelle", label: "Zelle handle", type: "text" },
] as const;

export function SettingsPanel({
  data,
  refresh,
  flash,
}: {
  data: AdminData;
  refresh: () => Promise<void>;
  flash: (msg: string, kind?: "ok" | "err") => void;
}) {
  const s = data.settings;
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      FIELDS.map(({ key }) => [key, s ? String((s as Record<string, unknown>)[key] ?? "") : ""])
    )
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const row: Record<string, string | number | null> = {};
    for (const { key, type } of FIELDS) {
      const v = form[key].trim();
      if (type === "number") {
        const n = Number(v);
        if (v === "" || Number.isNaN(n)) return flash(`"${v}" isn't a number — check the fields.`, "err");
        row[key] = n;
      } else {
        row[key] = v || null;
      }
    }
    if (!row.shop_address) return flash("The shop address can't be empty.", "err");
    setBusy(true);
    const { error } = await createClient().from("settings").update(row).eq("id", true);
    setBusy(false);
    if (error) return flash("Couldn't save settings.", "err");
    flash("Settings saved");
    await refresh();
  };

  return (
    <div className="max-w-xl rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="font-display mb-4 text-sm uppercase tracking-wider text-zinc-400">
        Business settings
      </div>
      <div className="space-y-3">
        {FIELDS.map(({ key, label, type }) => (
          <div key={key}>
            <div className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
            <input
              type={type}
              value={form[key]}
              onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-rapid-500 focus:outline-none"
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={save}
        className="font-display mt-4 w-full rounded-md bg-rapid-500 py-2.5 font-semibold tracking-wide text-zinc-950 transition hover:bg-rapid-400 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save settings"}
      </button>
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
        Changes apply immediately to new quotes, bookings, and emails. Existing bookings keep
        the prices they were quoted.
      </p>
    </div>
  );
}

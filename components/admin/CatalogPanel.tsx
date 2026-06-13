"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resizeToJpeg } from "@/lib/image";
import type { Item } from "@/lib/types";
import { ratesLine } from "@/lib/format";
import type { AdminData } from "./AdminApp";

type Flash = (msg: string, kind?: "ok" | "err") => void;

export function CatalogPanel({
  data,
  refresh,
  flash,
}: {
  data: AdminData;
  refresh: () => Promise<void>;
  flash: Flash;
}) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [newCategoryId, setNewCategoryId] = useState<string | null>(null);

  const addCategory = async () => {
    const name = prompt("Category name (e.g. Excavators)?")?.trim();
    if (!name) return;
    const { error } = await createClient()
      .from("categories")
      .insert({ name, sort_order: data.categories.length + 1 });
    if (error) flash("Couldn't add that category.", "err");
    else {
      flash(`Category "${name}" added`);
      await refresh();
    }
  };

  return (
    <div className="space-y-6">
      {data.categories.map((cat) => {
        const items = data.items.filter((i) => i.category_id === cat.id);
        return (
          <div key={cat.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-display text-base tracking-wide">{cat.name}</div>
              <button
                type="button"
                onClick={() => {
                  setNewCategoryId(cat.id);
                  setEditingId("new");
                }}
                className="flex items-center gap-1 rounded bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 transition hover:text-zinc-100"
              >
                <Plus className="h-3 w-3" /> New item
              </button>
            </div>
            <div className="divide-y divide-zinc-800">
              {editingId === "new" && newCategoryId === cat.id && (
                <ItemEditor
                  data={data}
                  item={null}
                  categoryId={cat.id}
                  onClose={() => {
                    setEditingId(null);
                    setNewCategoryId(null);
                  }}
                  refresh={refresh}
                  flash={flash}
                />
              )}
              {items.map((item) =>
                editingId === item.id ? (
                  <ItemEditor
                    key={item.id}
                    data={data}
                    item={item}
                    categoryId={cat.id}
                    onClose={() => setEditingId(null)}
                    refresh={refresh}
                    flash={flash}
                  />
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setEditingId(item.id)}
                    className={`flex w-full items-center justify-between gap-3 py-2.5 text-left transition hover:bg-zinc-800/30 ${
                      item.active ? "" : "opacity-45"
                    }`}
                  >
                    <div>
                      <span className="text-sm text-zinc-100">{item.name}</span>
                      <span className="ml-2 text-xs text-zinc-500">
                        {[item.maker, item.subtitle].filter(Boolean).join(" ")}
                        {item.is_addon && " · add-on"}
                        {!item.active && " · hidden"}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-500">{ratesLine(item)}</span>
                  </button>
                )
              )}
              {items.length === 0 && editingId !== "new" && (
                <div className="py-3 text-xs text-zinc-600">No items yet.</div>
              )}
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={addCategory}
        className="flex items-center gap-1.5 rounded-md border border-dashed border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
      >
        <Plus className="h-4 w-4" /> Add category
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- editor

function ItemEditor({
  data,
  item,
  categoryId,
  onClose,
  refresh,
  flash,
}: {
  data: AdminData;
  item: Item | null;
  categoryId: string;
  onClose: () => void;
  refresh: () => Promise<void>;
  flash: Flash;
}) {
  const [f, setF] = useState({
    name: item?.name ?? "",
    maker: item?.maker ?? "",
    subtitle: item?.subtitle ?? "",
    description: item?.description ?? "",
    is_addon: item?.is_addon ?? false,
    daily_rate: item?.daily_rate?.toString() ?? "",
    weekly_rate: item?.weekly_rate?.toString() ?? "",
    four_hour_rate: item?.four_hour_rate?.toString() ?? "",
    pricing_enabled: item?.pricing_enabled ?? true,
    active: item?.active ?? true,
    sort_order: item?.sort_order?.toString() ?? "0",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  const save = async () => {
    if (!f.name.trim()) return flash("The item needs a name.", "err");
    const row = {
      category_id: categoryId,
      name: f.name.trim(),
      maker: f.maker.trim() || null,
      subtitle: f.subtitle.trim() || null,
      description: f.description.trim() || null,
      is_addon: f.is_addon,
      daily_rate: num(f.daily_rate),
      weekly_rate: num(f.weekly_rate),
      four_hour_rate: num(f.four_hour_rate),
      pricing_enabled: f.pricing_enabled,
      active: f.active,
      sort_order: Number(f.sort_order) || 0,
    };
    setBusy(true);
    const supabase = createClient();
    const { error } = item
      ? await supabase.from("items").update(row).eq("id", item.id)
      : await supabase.from("items").insert(row);
    setBusy(false);
    if (error) return flash("Couldn't save the item.", "err");
    flash(`${row.name} saved`);
    await refresh();
    onClose();
  };

  const input =
    "w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-rapid-500 focus:outline-none";
  const label = "mb-1 text-[11px] uppercase tracking-wider text-zinc-500";

  return (
    <div className="my-2 rounded-md border border-rapid-500/40 bg-zinc-950/60 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className={label}>Name</div>
          <input className={input} value={f.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <div className={label}>Maker</div>
          <input className={input} value={f.maker} onChange={(e) => set("maker", e.target.value)} placeholder="Bobcat" />
        </div>
        <div>
          <div className={label}>Subtitle</div>
          <input className={input} value={f.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder="Compact Track Loader" />
        </div>
        <div>
          <div className={label}>Sort order</div>
          <input className={input} type="number" value={f.sort_order} onChange={(e) => set("sort_order", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <div className={label}>Description</div>
          <textarea className={`${input} min-h-16`} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        {!f.is_addon && (
          <>
            <div>
              <div className={label}>Daily rate ($)</div>
              <input className={input} type="number" value={f.daily_rate} onChange={(e) => set("daily_rate", e.target.value)} />
            </div>
            <div>
              <div className={label}>Weekly rate ($)</div>
              <input className={input} type="number" value={f.weekly_rate} onChange={(e) => set("weekly_rate", e.target.value)} />
            </div>
            <div>
              <div className={label}>4-hour rate ($, blank = no 4-hour option)</div>
              <input className={input} type="number" value={f.four_hour_rate} onChange={(e) => set("four_hour_rate", e.target.value)} />
            </div>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-300">
        <Toggle label="Add-on (books with a machine)" checked={f.is_addon} onChange={(v) => set("is_addon", v)} />
        <Toggle label="Pricing shown on site" checked={f.pricing_enabled} onChange={(v) => set("pricing_enabled", v)} />
        <Toggle label="Active (visible to customers)" checked={f.active} onChange={(v) => set("active", v)} />
      </div>
      {!f.pricing_enabled && (
        <div className="mt-1 text-[11px] text-zinc-500">
          Pricing off — shows as &quot;priced at pickup,&quot; still bookable, excluded from totals.
        </div>
      )}

      {item && f.is_addon && <PairingsEditor data={data} attachment={item} refresh={refresh} flash={flash} />}
      {item && <PhotoManager data={data} item={item} refresh={refresh} flash={flash} />}
      {!item && (
        <div className="mt-3 text-[11px] text-zinc-500">
          Save the item first, then photos{f.is_addon ? " and machine pairings" : ""} unlock here.
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="font-display rounded-md bg-rapid-500 px-4 py-2 text-sm font-semibold tracking-wide text-zinc-950 transition hover:bg-rapid-400 disabled:opacity-50"
        >
          {item ? "Save changes" : "Create item"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[#1ba0e2]"
      />
      <span className="text-xs">{label}</span>
    </label>
  );
}

// ---------------------------------------------------------------- pairings

function PairingsEditor({
  data,
  attachment,
  refresh,
  flash,
}: {
  data: AdminData;
  attachment: Item;
  refresh: () => Promise<void>;
  flash: Flash;
}) {
  const machines = data.items.filter((i) => !i.is_addon && i.active);
  const [busy, setBusy] = useState(false);

  const pairingFor = (machineId: string) =>
    data.compat.find((c) => c.machine_id === machineId && c.attachment_id === attachment.id);

  const setPairing = async (
    machineId: string,
    enabled: boolean,
    daily: number | null,
    weekly: number | null,
    included: boolean
  ) => {
    setBusy(true);
    const supabase = createClient();
    const { error } = enabled
      ? await supabase.from("item_compatibility").upsert({
          machine_id: machineId,
          attachment_id: attachment.id,
          daily_rate: daily,
          weekly_rate: weekly,
          included,
        })
      : await supabase
          .from("item_compatibility")
          .delete()
          .eq("machine_id", machineId)
          .eq("attachment_id", attachment.id);
    setBusy(false);
    if (error) return flash("Couldn't save that pairing.", "err");
    flash("Pairing saved");
    await refresh();
  };

  return (
    <div className="mt-4 border-t border-zinc-800 pt-3">
      <div className="font-display mb-2 text-xs uppercase tracking-wider text-zinc-400">
        Fits on · price per machine
      </div>
      <div className="space-y-2">
        {machines.map((m) => (
          <PairingRow
            key={m.id}
            machine={m}
            pairing={pairingFor(m.id)}
            busy={busy}
            onSave={(enabled, daily, weekly, included) =>
              setPairing(m.id, enabled, daily, weekly, included)
            }
          />
        ))}
      </div>
      <div className="mt-2 text-[11px] text-zinc-500">
        Attachment weekly pricing convention: 4.5 × daily (the wk button fills it in).
      </div>
    </div>
  );
}

function PairingRow({
  machine,
  pairing,
  busy,
  onSave,
}: {
  machine: Item;
  pairing: { daily_rate: number | null; weekly_rate: number | null; included: boolean } | undefined;
  busy: boolean;
  onSave: (enabled: boolean, daily: number | null, weekly: number | null, included: boolean) => void;
}) {
  const [enabled, setEnabled] = useState(!!pairing);
  const [daily, setDaily] = useState(pairing?.daily_rate?.toString() ?? "");
  const [weekly, setWeekly] = useState(pairing?.weekly_rate?.toString() ?? "");
  const [included, setIncluded] = useState(pairing?.included ?? false);

  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const dirty =
    enabled !== !!pairing ||
    (enabled &&
      (num(daily) !== (pairing?.daily_rate ?? null) ||
        num(weekly) !== (pairing?.weekly_rate ?? null) ||
        included !== (pairing?.included ?? false)));

  const cell =
    "w-20 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-rapid-500 focus:outline-none disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <label className="flex w-32 cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-3.5 w-3.5 accent-[#1ba0e2]"
        />
        <span className="truncate text-zinc-200">{machine.name}</span>
      </label>
      <input
        className={cell}
        disabled={!enabled || included}
        placeholder="$/day"
        type="number"
        value={daily}
        onChange={(e) => setDaily(e.target.value)}
      />
      <button
        type="button"
        disabled={!enabled || included || !daily}
        title="Weekly = 4.5 × daily"
        onClick={() => setWeekly((Number(daily) * 4.5).toString())}
        className="rounded bg-zinc-800 px-1.5 py-1 text-[10px] text-zinc-400 transition hover:text-zinc-100 disabled:opacity-40"
      >
        wk=4.5×
      </button>
      <input
        className={cell}
        disabled={!enabled || included}
        placeholder="$/wk"
        type="number"
        value={weekly}
        onChange={(e) => setWeekly(e.target.value)}
      />
      <label className="flex cursor-pointer items-center gap-1.5">
        <input
          type="checkbox"
          disabled={!enabled}
          checked={included}
          onChange={(e) => setIncluded(e.target.checked)}
          className="h-3.5 w-3.5 accent-[#1ba0e2]"
        />
        <span className="text-zinc-400">included free</span>
      </label>
      {dirty && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave(enabled, included ? 0 : num(daily), included ? 0 : num(weekly), included)}
          className="font-display rounded bg-rapid-500 px-2.5 py-1 text-[11px] font-semibold text-zinc-950 transition hover:bg-rapid-400 disabled:opacity-50"
        >
          Save
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- photos

function PhotoManager({
  data,
  item,
  refresh,
  flash,
}: {
  data: AdminData;
  item: Item;
  refresh: () => Promise<void>;
  flash: Flash;
}) {
  const photos = data.photos
    .filter((p) => p.item_id === item.id)
    .sort((a, b) => a.sort_order - b.sort_order);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const blob = await resizeToJpeg(file);
      const path = `items/${item.id}/${crypto.randomUUID()}.jpg`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("photos")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("photos").getPublicUrl(path);
      const { error: rowErr } = await supabase.from("item_photos").insert({
        item_id: item.id,
        url: pub.publicUrl,
        sort_order: photos.length,
      });
      if (rowErr) throw rowErr;
      flash("Photo added");
      await refresh();
    } catch {
      flash("Couldn't upload that photo.", "err");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (photoId: string, url: string) => {
    setBusy(true);
    const supabase = createClient();
    const path = url.split("/object/public/photos/")[1];
    if (path) await supabase.storage.from("photos").remove([decodeURIComponent(path)]);
    const { error } = await supabase.from("item_photos").delete().eq("id", photoId);
    setBusy(false);
    if (error) return flash("Couldn't remove that photo.", "err");
    flash("Photo removed");
    await refresh();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= photos.length) return;
    setBusy(true);
    const supabase = createClient();
    await Promise.all([
      supabase.from("item_photos").update({ sort_order: j }).eq("id", photos[index].id),
      supabase.from("item_photos").update({ sort_order: index }).eq("id", photos[j].id),
    ]);
    setBusy(false);
    await refresh();
  };

  return (
    <div className="mt-4 border-t border-zinc-800 pt-3">
      <div className="font-display mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-zinc-400">
        Photos
        <label className="flex cursor-pointer items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-[11px] normal-case tracking-normal text-zinc-300 transition hover:text-zinc-100">
          <ImagePlus className="h-3.5 w-3.5" /> {busy ? "Working…" : "Upload"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {photos.length === 0 ? (
        <div className="text-[11px] text-zinc-600">
          No photos yet — the site shows placeholder art until you add some.
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <div key={p.id} className="relative h-16 w-24 shrink-0 overflow-hidden rounded border border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-zinc-950/70 px-1 py-0.5">
                <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} className="text-zinc-300 disabled:opacity-30">
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <button type="button" disabled={busy} onClick={() => remove(p.id, p.url)} className="text-zinc-300 hover:text-red-400">
                  <X className="h-3 w-3" />
                </button>
                <button type="button" disabled={busy || i === photos.length - 1} onClick={() => move(i, 1)} className="text-zinc-300 disabled:opacity-30">
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

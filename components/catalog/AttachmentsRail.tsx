"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Compatibility, Item, ItemPhoto } from "@/lib/types";
import { money } from "@/lib/format";
import { NavBtn, SmartImg } from "@/components/ui";
import { AttachmentIcon } from "./art";

export type RailEntry = {
  attachment: Item;
  pairing: Compatibility;
  photo: ItemPhoto | null;
};

function AddButton({
  state,
  onClick,
}: {
  state: { ok: boolean; reason?: string };
  onClick: () => void;
}) {
  return (
    <>
      <button
        type="button"
        disabled={!state.ok}
        onClick={onClick}
        className="font-display mt-3 flex w-full items-center justify-center gap-1 rounded bg-rapid-500 py-1.5 text-xs font-semibold tracking-wide text-zinc-950 transition hover:bg-rapid-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
      >
        <Plus className="h-3.5 w-3.5" /> Add to rental
      </button>
      {!state.ok && state.reason && (
        <div className="mt-1.5 text-[10px] leading-snug text-zinc-500">{state.reason}</div>
      )}
    </>
  );
}

/**
 * Contextual add-on scroller: only the attachments compatible with the
 * selected machine, priced per pairing (the shared backhoe shows $95/day on
 * the MT-100 and $120/day on the T66). Included gear (smooth bucket) shows
 * as free.
 */
export function AttachmentsRail({
  machineName,
  entries,
  canAdd,
  onAdd,
}: {
  machineName: string;
  entries: RailEntry[];
  /** Why an add-on can't be added right now (machine not in cart, dates taken). */
  canAdd: (entry: RailEntry) => { ok: boolean; reason?: string };
  onAdd: (entry: RailEntry) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) =>
    ref.current?.scrollBy({ left: dir * 240, behavior: "smooth" });

  if (!entries.length) return null;

  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="font-display text-lg tracking-wide">Attachments for the {machineName}</div>
          <div className="mt-0.5 text-xs text-zinc-500">
            Add any of these to your rental. Weekly attachment pricing is 4.5× the daily rate.
          </div>
        </div>
        <div className="hidden gap-1 sm:flex">
          <NavBtn label="Scroll attachments left" onClick={() => scroll(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </NavBtn>
          <NavBtn label="Scroll attachments right" onClick={() => scroll(1)}>
            <ChevronRight className="h-4 w-4" />
          </NavBtn>
        </div>
      </div>
      <div ref={ref} className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3">
        {entries.map(({ attachment, pairing, photo }) => (
          <div
            key={attachment.id}
            className="w-56 shrink-0 snap-start overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40 transition hover:border-zinc-700"
          >
            <div className="relative grid h-28 place-items-center bg-zinc-950 text-rapid-400">
              <SmartImg
                src={photo?.url ?? null}
                alt={attachment.name}
                className="h-full w-full object-cover"
                fallback={<AttachmentIcon name={attachment.name} />}
              />
            </div>
            <div className="p-4">
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-display text-base tracking-wide">{attachment.name}</div>
                {pairing.included ? (
                  <span className="rounded bg-rapid-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-rapid-400">
                    Included
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-xs leading-relaxed text-zinc-400">
                {attachment.description}
              </div>
              <div className="mt-2 text-xs font-medium text-zinc-300">
                {pairing.included
                  ? "Free with this machine"
                  : !attachment.pricing_enabled
                    ? "Priced at pickup"
                    : pairing.daily_rate != null
                      ? `${money(pairing.daily_rate)}/day${pairing.weekly_rate != null ? ` · ${money(pairing.weekly_rate)}/wk` : ""}`
                      : "Priced at pickup"}
              </div>
              {!pairing.included && (
                <AddButton
                  state={canAdd({ attachment, pairing, photo })}
                  onClick={() => onAdd({ attachment, pairing, photo })}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

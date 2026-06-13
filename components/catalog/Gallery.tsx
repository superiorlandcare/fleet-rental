"use client";

import { useEffect, useState } from "react";
import type { Item, ItemPhoto } from "@/lib/types";
import { SmartImg } from "@/components/ui";
import { ItemArt, type ArtKind } from "./art";

export function Gallery({
  item,
  photos,
  artKind,
}: {
  item: Item;
  photos: ItemPhoto[];
  artKind: ArtKind;
}) {
  const [hero, setHero] = useState(0);
  useEffect(() => setHero(0), [item.id]);

  // Placeholder art is always the first slide until real photos exist.
  const slides: (string | null)[] = photos.length
    ? photos.map((p) => p.url)
    : [null];
  const safe = Math.min(hero, slides.length - 1);
  const label = [item.maker, item.name].filter(Boolean).join(" ");

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="font-display text-sm uppercase tracking-wider text-zinc-400">{label}</div>
        {item.subtitle && <div className="text-xs text-zinc-500">{item.subtitle}</div>}
      </div>
      <div className="relative grid aspect-video place-items-center overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
        <SmartImg
          src={slides[safe]}
          alt={label}
          className="h-full w-full object-cover"
          fallback={
            <>
              <ItemArt kind={artKind} />
              <span className="absolute bottom-2 right-3 text-[10px] uppercase tracking-wider text-zinc-600">
                Photos coming soon
              </span>
            </>
          }
        />
      </div>
      {slides.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {slides.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setHero(i)}
              className={`relative grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded border bg-zinc-950 ${
                safe === i ? "border-rapid-500/60" : "border-zinc-800"
              }`}
            >
              <SmartImg
                src={s}
                alt=""
                className="h-full w-full object-cover"
                fallback={<ItemArt kind={artKind} mini />}
              />
            </button>
          ))}
        </div>
      )}
      {item.description && (
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.description}</p>
      )}
    </div>
  );
}

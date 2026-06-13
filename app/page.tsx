import { createClient } from "@/lib/supabase/server";
import { CatalogView } from "@/components/catalog/CatalogView";
import type { Category, Compatibility, Item, ItemPhoto, Settings } from "@/lib/types";

// Catalog edits in admin should show up immediately.
export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();

  const [categories, items, photos, compat, settings] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("items").select("*").eq("active", true).order("sort_order"),
    supabase.from("item_photos").select("*").order("sort_order"),
    supabase.from("item_compatibility").select("*"),
    supabase.from("settings").select("*").single(),
  ]);

  return (
    <CatalogView
      categories={(categories.data ?? []) as Category[]}
      items={(items.data ?? []) as Item[]}
      photos={(photos.data ?? []) as ItemPhoto[]}
      compat={(compat.data ?? []) as Compatibility[]}
      settings={(settings.data ?? null) as Settings | null}
    />
  );
}

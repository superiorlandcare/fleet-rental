import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliveryFee } from "@/lib/pricing";
import type { Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Driving distance from the shop via the Google Routes API (key stays
 * server-side) and the resulting delivery fee. POST { address: string }.
 */
export async function POST(req: Request) {
  let address: unknown;
  try {
    ({ address } = await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (typeof address !== "string" || address.trim().length < 8) {
    return NextResponse.json({ error: "Enter a full delivery address." }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Delivery quoting isn't configured yet — choose pickup or call us." },
      { status: 503 }
    );
  }

  const supabase = createAdminClient();
  const { data: settings, error } = await supabase
    .from("settings")
    .select("*")
    .single<Settings>();
  if (error || !settings) {
    return NextResponse.json({ error: "Settings unavailable" }, { status: 500 });
  }

  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "routes.distanceMeters",
    },
    body: JSON.stringify({
      origin: { address: settings.shop_address },
      destination: { address: address.trim() },
      travelMode: "DRIVE",
    }),
  });

  if (!res.ok) {
    console.error("routes api:", res.status, await res.text().catch(() => ""));
    return NextResponse.json(
      { error: "Couldn't find a driving route to that address. Check it and try again." },
      { status: 422 }
    );
  }

  const data = await res.json();
  const meters: number | undefined = data?.routes?.[0]?.distanceMeters;
  if (typeof meters !== "number") {
    return NextResponse.json(
      { error: "Couldn't find a driving route to that address. Check it and try again." },
      { status: 422 }
    );
  }

  const miles = Math.round((meters / 1609.344) * 10) / 10;
  return NextResponse.json({ miles, fee: deliveryFee(miles, settings) });
}

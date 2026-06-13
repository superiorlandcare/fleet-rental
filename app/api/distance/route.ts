import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { drivingMiles } from "@/lib/distance";
import { deliveryFee } from "@/lib/pricing";
import type { Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Live delivery-fee quote for the cart. POST { address: string }.
 * The Google key stays server-side in lib/distance.
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

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return NextResponse.json(
      { error: "Delivery quoting isn't configured yet — you can still book and we'll confirm the fee with you." },
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

  const miles = await drivingMiles(settings.shop_address, address.trim());
  if (miles == null) {
    return NextResponse.json(
      { error: "Couldn't find a driving route to that address. Check it and try again." },
      { status: 422 }
    );
  }

  return NextResponse.json({ miles, fee: deliveryFee(miles, settings) });
}

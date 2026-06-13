import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * Public availability feed: active line items (reservations, requests, and
 * owner blocks all hold dates) as bare ranges. Never returns customer data.
 */
export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("booking_items")
    .select("item_id,start_date,end_date")
    .eq("active", true)
    .gte("end_date", todayISO());

  if (error) {
    console.error("availability:", error.message);
    return NextResponse.json({ error: "Failed to load availability" }, { status: 500 });
  }

  return NextResponse.json(data);
}

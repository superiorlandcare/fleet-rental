import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { drivingMiles } from "@/lib/distance";
import { fmtRange, overlaps, rentalDays, todayISO } from "@/lib/dates";
import { money } from "@/lib/format";
import { deliveryFee, isInstantConfirm, linePrice } from "@/lib/pricing";
import { notifyEmails, notifyPhones, sendEmail, sendSms } from "@/lib/notify";
import type { Compatibility, Item, Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type LinePayload = {
  itemId: string;
  attachedToItemId: string | null;
  start: string;
  end: string;
  rateMode?: "daily" | "four_hour";
};

type Payload = {
  lines: LinePayload[];
  fulfillment: "delivery" | "pickup";
  address?: string;
  customer: { name: string; phone: string; email: string };
};

const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

/**
 * Public booking endpoint. Everything is re-validated and re-priced
 * server-side — the client's quote is never trusted. The DB exclusion
 * constraint is the final word on overlaps.
 */
export async function POST(req: Request) {
  let p: Payload;
  try {
    p = await req.json();
  } catch {
    return bad("Bad request");
  }

  // ---- shape validation ----
  if (!Array.isArray(p.lines) || p.lines.length === 0 || p.lines.length > 20)
    return bad("Add at least one item to your rental.");
  if (p.fulfillment !== "delivery" && p.fulfillment !== "pickup")
    return bad("Choose delivery or pickup.");
  const address = typeof p.address === "string" ? p.address.trim() : "";
  if (p.fulfillment === "delivery" && address.length < 8)
    return bad("Enter a full delivery address.");
  const name = typeof p.customer?.name === "string" ? p.customer.name.trim() : "";
  const phone = typeof p.customer?.phone === "string" ? p.customer.phone.trim() : "";
  const email = typeof p.customer?.email === "string" ? p.customer.email.trim() : "";
  if (!name) return bad("Add your name.");
  if (phone.replace(/\D/g, "").length < 10) return bad("Add a valid phone number.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return bad("Add a valid email address.");

  const today = todayISO();
  for (const l of p.lines) {
    if (
      typeof l.itemId !== "string" ||
      typeof l.start !== "string" ||
      typeof l.end !== "string" ||
      !DATE_RE.test(l.start) ||
      !DATE_RE.test(l.end)
    )
      return bad("Bad request");
    if (l.end < l.start) return bad("Each item needs an end date on or after its start.");
    if (l.start < today) return bad("Rental dates can't be in the past.");
  }

  // ---- load catalog + settings ----
  const supabase = createAdminClient();
  const [itemsRes, compatRes, settingsRes] = await Promise.all([
    supabase.from("items").select("*").eq("active", true),
    supabase.from("item_compatibility").select("*"),
    supabase.from("settings").select("*").single<Settings>(),
  ]);
  if (itemsRes.error || compatRes.error || settingsRes.error || !settingsRes.data)
    return bad("Something went wrong on our end. Try again.", 500);
  const items = itemsRes.data as Item[];
  const compat = compatRes.data as Compatibility[];
  const settings = settingsRes.data;

  // ---- semantic validation + pricing per line ----
  const nonAddonIds = new Set<string>();
  for (const l of p.lines) {
    const item = items.find((i) => i.id === l.itemId);
    if (item && !item.is_addon) nonAddonIds.add(item.id);
  }

  const priced: {
    line: LinePayload;
    item: Item;
    pairing: Compatibility | null;
    days: number;
    fourHour: boolean;
    price: number | null;
  }[] = [];

  for (const l of p.lines) {
    const item = items.find((i) => i.id === l.itemId);
    if (!item) return bad("An item in your rental is no longer available.", 409);

    let pairing: Compatibility | null = null;
    if (item.is_addon) {
      if (!l.attachedToItemId || !nonAddonIds.has(l.attachedToItemId))
        return bad(`${item.name} has to be added together with its machine.`);
      pairing =
        compat.find(
          (c) => c.machine_id === l.attachedToItemId && c.attachment_id === item.id
        ) ?? null;
      if (!pairing) return bad(`${item.name} doesn't fit that machine.`);
      if (pairing.included)
        return bad(`${item.name} is already included free with the machine.`);
    } else if (l.attachedToItemId) {
      return bad("Bad request");
    }

    const days = rentalDays(l.start, l.end);
    const fourHour =
      l.rateMode === "four_hour" &&
      p.fulfillment === "pickup" &&
      days === 1 &&
      !item.is_addon &&
      item.four_hour_rate != null;

    priced.push({
      line: l,
      item,
      pairing,
      days,
      fourHour,
      price: linePrice({ item, pairing, days, rateMode: fourHour ? "four_hour" : "daily" }),
    });
  }

  // Same item twice in one request can't overlap with itself.
  for (let a = 0; a < p.lines.length; a++)
    for (let b = a + 1; b < p.lines.length; b++)
      if (
        p.lines[a].itemId === p.lines[b].itemId &&
        overlaps(p.lines[a].start, p.lines[a].end, p.lines[b].start, p.lines[b].end)
      )
        return bad("You have the same item twice on overlapping dates.");

  // Friendly pre-check against existing holds (the DB constraint still backstops).
  const itemIds = [...new Set(p.lines.map((l) => l.itemId))];
  const { data: existing, error: existErr } = await supabase
    .from("booking_items")
    .select("item_id,start_date,end_date")
    .in("item_id", itemIds)
    .eq("active", true)
    .gte("end_date", today);
  if (existErr) return bad("Something went wrong on our end. Try again.", 500);
  for (const l of p.lines) {
    const taken = (existing ?? []).some(
      (r) => r.item_id === l.itemId && overlaps(l.start, l.end, r.start_date, r.end_date)
    );
    if (taken) {
      const item = items.find((i) => i.id === l.itemId);
      return bad(`${item?.name ?? "An item"} just got booked for those dates. Pick different days.`, 409);
    }
  }

  // ---- totals ----
  const itemsSubtotal = priced.reduce((s, l) => s + (l.price ?? 0), 0);
  const unpricedCount = priced.filter((l) => l.price === null).length;
  let miles: number | null = null;
  let fee: number | null = null;
  if (p.fulfillment === "delivery") {
    miles = await drivingMiles(settings.shop_address, address);
    // Distance API down or unconfigured: take the booking, flag fee as TBD.
    fee = miles != null ? deliveryFee(miles, settings) : null;
  }
  const deposit = settings.deposit_amount;
  const total = itemsSubtotal + (fee ?? 0) + deposit;

  const earliestStart = p.lines.reduce((m, l) => (l.start < m ? l.start : m), p.lines[0].start);
  const latestEnd = p.lines.reduce((m, l) => (l.end > m ? l.end : m), p.lines[0].end);
  const instant = isInstantConfirm(earliestStart, settings.request_window_hours);
  const status = instant ? "confirmed" : "requested";

  // ---- insert (booking, then line items; constraint failure rolls back) ----
  const { data: booking, error: insertErr } = await supabase
    .from("bookings")
    .insert({
      type: "reservation",
      status,
      customer_name: name,
      customer_phone: phone,
      customer_email: email,
      fulfillment: p.fulfillment,
      address: p.fulfillment === "delivery" ? address : null,
      distance_miles: miles,
      delivery_fee: fee,
      items_subtotal: itemsSubtotal,
      deposit,
      estimated_total: total,
    })
    .select("id")
    .single();
  if (insertErr || !booking) return bad("Something went wrong on our end. Try again.", 500);

  const { error: linesErr } = await supabase.from("booking_items").insert(
    priced.map((l) => ({
      booking_id: booking.id,
      item_id: l.item.id,
      attached_to_item_id: l.line.attachedToItemId,
      start_date: l.line.start,
      end_date: l.line.end,
      four_hour: l.fourHour,
    }))
  );
  if (linesErr) {
    await supabase.from("bookings").delete().eq("id", booking.id);
    if (linesErr.code === "23P01")
      return bad("Someone grabbed one of those items for those dates just now. Pick different days.", 409);
    console.error("booking_items insert:", linesErr.message);
    return bad("Something went wrong on our end. Try again.", 500);
  }

  // ---- notifications (never fail the booking) ----
  const lineText = priced
    .map((l) => {
      const onMachine = l.line.attachedToItemId
        ? ` (on ${items.find((i) => i.id === l.line.attachedToItemId)?.name ?? "machine"})`
        : "";
      const span = l.fourHour
        ? `${fmtRange(l.line.start, l.line.end)} · 4-hour`
        : `${fmtRange(l.line.start, l.line.end)} · ${l.days} day${l.days > 1 ? "s" : ""}`;
      const cost = l.price === null ? "priced at pickup" : money(l.price);
      return `• ${l.item.name}${onMachine} — ${span} — ${cost}`;
    })
    .join("\n");

  const fulfillText =
    p.fulfillment === "delivery"
      ? `Delivery to ${address}${miles != null ? ` (${miles} mi one way, ${money(fee!)})` : " (fee TBD — distance lookup unavailable)"}`
      : `Pickup at ${settings.shop_address}`;

  const headline = instant ? "NEW BOOKING (instant confirm)" : "NEW REQUEST — needs approval";
  const ownerBody = [
    headline,
    "",
    lineText,
    "",
    fulfillText,
    `Items: ${money(itemsSubtotal)}${unpricedCount ? ` (+${unpricedCount} priced at pickup)` : ""}`,
    fee != null ? `Delivery: ${money(fee)}` : null,
    `Deposit: ${money(deposit)}`,
    `Estimated total: ${money(total)}`,
    "",
    `Customer: ${name}`,
    `Phone: ${phone}`,
    `Email: ${email}`,
  ]
    .filter((x): x is string => x !== null)
    .join("\n");

  const smsBody = `Superior Landcare: ${instant ? "New booking" : "New REQUEST"} — ${name}, ${
    priced.length
  } item${priced.length > 1 ? "s" : ""} ${fmtRange(earliestStart, latestEnd)}, est ${money(
    total
  )}. ${p.fulfillment === "delivery" ? "Delivery" : "Pickup"}. ${phone}`;

  const payLines = [
    settings.venmo ? `Venmo: ${settings.venmo}` : null,
    settings.cashapp ? `CashApp: ${settings.cashapp}` : null,
    settings.zelle ? `Zelle: ${settings.zelle}` : null,
  ].filter((x): x is string => x !== null);

  const customerBody = [
    instant
      ? `You're booked, ${name}!`
      : `We got your request, ${name}! It starts soon, so we'll confirm it personally — watch for a call or text.`,
    "",
    "Your rental:",
    lineText,
    "",
    fulfillText,
    "",
    `Items: ${money(itemsSubtotal)}${unpricedCount ? ` (+${unpricedCount} item${unpricedCount > 1 ? "s" : ""} priced at pickup)` : ""}`,
    fee != null ? `Delivery: ${money(fee)}` : p.fulfillment === "delivery" ? "Delivery: we'll confirm the fee with you" : null,
    `Deposit: ${money(deposit)} (paid upfront with the rental)`,
    `Estimated total: ${money(total)}`,
    "",
    "How to pay:",
    ...payLines,
    "",
    "The fine print:",
    `• ${money(deposit)} deposit is due upfront with every rental.`,
    "• Return equipment with a full tank of fuel.",
    "• Rentals include up to 7 machine hours per day — overages are billed at return.",
    "• Bring it back clean — cleaning fees apply otherwise.",
    "• The rental form is signed and keys are handed off in person at pickup or delivery.",
    "",
    "Questions? Just reply to this email.",
    "— Superior Landcare LLC",
  ]
    .filter((x): x is string => x !== null)
    .join("\n");

  await Promise.allSettled([
    sendEmail({
      to: notifyEmails(),
      subject: `${instant ? "New booking" : "New request (approve/decline)"} — ${name} — ${fmtRange(earliestStart, latestEnd)}`,
      text: ownerBody,
    }),
    ...notifyPhones().map((to) => sendSms(to, smsBody)),
    sendEmail({
      to: email,
      subject: instant
        ? "You're booked — Superior Landcare LLC"
        : "We got your request — Superior Landcare LLC",
      text: customerBody,
    }),
  ]);

  return NextResponse.json({
    id: booking.id,
    status,
    quote: {
      lines: priced.map((l) => ({
        name: l.item.name,
        machine: l.line.attachedToItemId
          ? items.find((i) => i.id === l.line.attachedToItemId)?.name ?? null
          : null,
        start: l.line.start,
        end: l.line.end,
        days: l.days,
        fourHour: l.fourHour,
        price: l.price,
      })),
      itemsSubtotal,
      unpricedCount,
      deliveryMiles: miles,
      deliveryFee: fee,
      deposit,
      total,
    },
    payment: { venmo: settings.venmo, cashapp: settings.cashapp, zelle: settings.zelle },
    fulfillment: p.fulfillment,
    address: p.fulfillment === "delivery" ? address : null,
    shopAddress: settings.shop_address,
  });
}

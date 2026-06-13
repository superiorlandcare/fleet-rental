import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtRange } from "@/lib/dates";
import { money } from "@/lib/format";
import { sendEmail, sendSms } from "@/lib/notify";
import type { BookingWithItems, Item, Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

type Action = "approve" | "decline" | "cancel" | "paid" | "unpaid";

/**
 * Admin booking actions. Status changes that the customer should hear
 * about (approve / decline / cancel) live here so the emails come from
 * the server; simple flag flips ride along for consistency.
 */
export async function PATCH(req: Request) {
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let id: unknown, action: unknown;
  try {
    ({ id, action } = await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (
    typeof id !== "string" ||
    !["approve", "decline", "cancel", "paid", "unpaid"].includes(action as string)
  )
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const act = action as Action;

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("*, booking_items(*)")
    .eq("id", id)
    .single<BookingWithItems>();
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (act === "paid" || act === "unpaid") {
    const { error } = await admin.from("bookings").update({ paid: act === "paid" }).eq("id", id);
    if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (booking.type !== "reservation")
    return NextResponse.json({ error: "Not a reservation" }, { status: 400 });
  if (booking.status === "cancelled")
    return NextResponse.json({ error: "Already cancelled" }, { status: 400 });
  if (act === "approve" && booking.status !== "requested")
    return NextResponse.json({ error: "Not a pending request" }, { status: 400 });

  const nextStatus = act === "approve" ? "confirmed" : "cancelled";
  const { error } = await admin.from("bookings").update({ status: nextStatus }).eq("id", id);
  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  // ---- tell the customer (best effort) ----
  const [{ data: items }, { data: settings }] = await Promise.all([
    admin.from("items").select("id,name"),
    admin.from("settings").select("*").single<Settings>(),
  ]);
  const itemName = (itemId: string) =>
    (items as Pick<Item, "id" | "name">[] | null)?.find((i) => i.id === itemId)?.name ?? "item";
  const lineText = booking.booking_items
    .map((l) => `• ${itemName(l.item_id)} — ${fmtRange(l.start_date, l.end_date)}`)
    .join("\n");
  const first = booking.customer_name?.split(" ")[0] ?? "there";

  if (booking.customer_email) {
    if (act === "approve") {
      const payLines = [
        settings?.venmo ? `Venmo: ${settings.venmo}` : null,
        settings?.cashapp ? `CashApp: ${settings.cashapp}` : null,
        settings?.zelle ? `Zelle: ${settings.zelle}` : null,
      ].filter((x): x is string => x !== null);
      await sendEmail({
        to: booking.customer_email,
        subject: "You're confirmed — Superior Landcare LLC",
        text: [
          `Good news, ${first} — your rental is confirmed:`,
          "",
          lineText,
          "",
          booking.estimated_total != null
            ? `Estimated total: ${money(booking.estimated_total)}${booking.paid ? " (paid — thank you!)" : ""}`
            : null,
          ...(booking.paid ? [] : ["", "If you haven't paid yet:", ...payLines]),
          "",
          "Questions? Just reply to this email.",
          "— Superior Landcare LLC",
        ]
          .filter((x): x is string => x !== null)
          .join("\n"),
      });
    } else {
      await sendEmail({
        to: booking.customer_email,
        subject:
          act === "decline"
            ? "About your rental request — Superior Landcare LLC"
            : "Your rental was cancelled — Superior Landcare LLC",
        text: [
          act === "decline"
            ? `Hi ${first} — we couldn't fit your request this time:`
            : `Hi ${first} — your rental has been cancelled:`,
          "",
          lineText,
          "",
          booking.paid
            ? "You're marked as paid — we'll square up your refund with you directly."
            : null,
          "If you'd like different dates or have questions, just reply to this email.",
          "— Superior Landcare LLC",
        ]
          .filter((x): x is string => x !== null)
          .join("\n"),
      });
    }
  }
  if (act === "approve" && booking.customer_phone) {
    const digits = booking.customer_phone.replace(/\D/g, "");
    if (digits.length >= 10)
      await sendSms(
        digits.length === 10 ? `+1${digits}` : `+${digits}`,
        `Superior Landcare: you're confirmed — ${booking.booking_items
          .map((l) => itemName(l.item_id))
          .join(", ")} ${fmtRange(
          booking.booking_items.reduce(
            (m, l) => (l.start_date < m ? l.start_date : m),
            booking.booking_items[0].start_date
          ),
          booking.booking_items.reduce(
            (m, l) => (l.end_date > m ? l.end_date : m),
            booking.booking_items[0].end_date
          )
        )}.`
      );
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}

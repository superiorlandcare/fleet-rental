import "server-only";

/**
 * Thin Resend (email) and Twilio (SMS) helpers. Notification failures are
 * logged, never thrown — a booking must not fail because a text bounced.
 * SMS sits behind SMS_ENABLED until A2P 10DLC registration clears.
 */

export function notifyEmails(): string[] {
  return (process.env.NOTIFY_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function notifyPhones(): string[] {
  return (process.env.NOTIFY_PHONES ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\D/g, ""))
    .filter(Boolean)
    .map((d) => (d.length === 10 ? `+1${d}` : d.startsWith("+") ? d : `+${d}`));
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  text: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.warn("email skipped: RESEND_API_KEY / EMAIL_FROM not set");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, text: opts.text }),
    });
    if (!res.ok) console.error("resend:", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.error("resend:", e);
    return false;
  }
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  if (process.env.SMS_ENABLED !== "true") {
    console.warn("sms skipped (SMS_ENABLED != true):", to);
    return false;
  }
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    console.warn("sms skipped: Twilio env vars not set");
    return false;
  }
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
      }
    );
    if (!res.ok) console.error("twilio:", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.error("twilio:", e);
    return false;
  }
}

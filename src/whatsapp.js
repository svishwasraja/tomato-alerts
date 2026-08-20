/**
 * Sends a WhatsApp message via Twilio.
 *
 * NOTE on WhatsApp rules: Meta requires business-initiated messages sent
 * outside a 24h customer-service window to use a pre-approved template.
 * The Twilio *Sandbox* number (whatsapp:+14155238886) is exempt from this
 * for testing/personal use, but:
 *   1. Each recipient must "join" the sandbox once by sending the sandbox's
 *      join code to it from their own WhatsApp.
 *   2. The sandbox session expires after 72h of inactivity — rejoin if needed.
 * For a permanent, always-on setup, register a WhatsApp sender in Twilio
 * and create an approved Content Template, then swap the send call below
 * to use that template.
 */

async function sendWhatsApp({ to, body }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  const params = new URLSearchParams({
    To: to,
    From: from,
    Body: body,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio send failed: ${res.status} ${text}`);
  }

  return res.json();
}

module.exports = { sendWhatsApp };

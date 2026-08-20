/**
 * Sends a push notification via ntfy.sh — no account, no approval,
 * just posts plain text to your private topic name.
 */

async function sendNotification({ body }) {
  const topic = process.env.NTFY_TOPIC;

  const res = await fetch(`https://ntfy.sh/${topic}`, {
    method: "POST",
    body: body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ntfy send failed: ${res.status} ${text}`);
  }
}

module.exports = { sendNotification };

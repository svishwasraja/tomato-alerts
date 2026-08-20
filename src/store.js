/**
 * Thin wrapper around Upstash Redis's REST API (works from GitHub Actions
 * without needing a persistent connection or a running server).
 */

const BASE = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command) {
  const res = await fetch(`${BASE}/${command.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Upstash request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.result;
}

async function getLastPrice(key) {
  const raw = await redis(["get", key]);
  return raw ? JSON.parse(raw) : null;
}

async function setLastPrice(key, value) {
  await redis(["set", key, JSON.stringify(value)]);
}

module.exports = { getLastPrice, setLastPrice };

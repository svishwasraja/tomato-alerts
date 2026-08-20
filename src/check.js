require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { getPrice } = require("./priceApi");
const { getLastPrice, setLastPrice } = require("./store");
const { sendNotification } = require("./notify");

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "config.json"), "utf-8")
);

function arrow(oldPrice, newPrice) {
  if (oldPrice == null) return "🆕 first check";
  if (newPrice > oldPrice) return `📈 up ₹${(newPrice - oldPrice).toFixed(2)}`;
  if (newPrice < oldPrice) return `📉 down ₹${(oldPrice - newPrice).toFixed(2)}`;
  return "➡️ no change";
}

async function checkItemAtLocation(item, location) {
  const results = {};

  for (const platform of config.platforms) {
    try {
      results[platform] = await getPrice({
        query: item.query,
        platform,
        lat: location.lat,
        lon: location.lon,
      });
    } catch (err) {
      console.error(`[${item.label} / ${platform} / ${location.label}] fetch failed:`, err.message);
      results[platform] = null;
    }
  }

  const lines = [];
  for (const platform of config.platforms) {
    const result = results[platform];
    const key = `grocery:${item.label}:${platform}:${location.label}`;
    const last = await getLastPrice(key);

    if (!result || result.price == null) {
      lines.push(`  ${platform}: ⚠️ couldn't fetch price`);
      continue;
    }

    const stockNote = result.inStock ? "" : " (OUT OF STOCK)";
    const trend = arrow(last?.price ?? null, result.price);
    lines.push(`  ${platform}: ₹${result.price}${stockNote} — ${trend}`);

    await setLastPrice(key, result);
  }

  return `${item.label}\n` + lines.join("\n");
}

async function checkLocation(location) {
  const itemBlocks = [];
  for (const item of config.items) {
    const block = await checkItemAtLocation(item, location);
    itemBlocks.push(block);
  }

  const message =
    `🛒 Grocery morning report (${location.label})\n\n` + itemBlocks.join("\n\n");
  console.log(message);
  await sendNotification({ body: message });
}

async function main() {
  const tasks = config.locations.map((location) => checkLocation(location));
  await Promise.all(tasks);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

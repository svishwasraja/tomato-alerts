require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { getPrice } = require("./priceApi");
const { getLastPrice, setLastPrice } = require("./store");
const { sendWhatsApp } = require("./whatsapp");

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "config.json"), "utf-8")
);

function formatChangeMessage({ productName, platform, location, oldPrice, newPrice }) {
  const arrow = newPrice > oldPrice ? "📈 up" : "📉 down";
  const diff = Math.abs(newPrice - oldPrice).toFixed(2);
  return (
    `🍅 Tomato price alert (${platform} · ${location})\n` +
    `${productName || "Tomato"}: ₹${oldPrice} → ₹${newPrice} (${arrow} ₹${diff})`
  );
}

function formatStockMessage({ productName, platform, location, inStock }) {
  return (
    `🍅 Tomato stock alert (${platform} · ${location})\n` +
    `${productName || "Tomato"} is now ${inStock ? "back IN STOCK" : "OUT OF STOCK"}`
  );
}

async function checkOne(location, platform) {
  const key = `tomato:${platform}:${location.label}`;

  let result;
  try {
    result = await getPrice({
      query: config.query,
      platform,
      lat: location.lat,
      lon: location.lon,
    });
  } catch (err) {
    console.error(`[${platform} / ${location.label}] fetch failed:`, err.message);
    return;
  }

  const last = await getLastPrice(key);

  if (result.price == null) {
    console.log(`[${platform} / ${location.label}] no listing found`);
    return;
  }

  if (last === null) {
    // First run for this key — just record the baseline, no alert.
    await setLastPrice(key, result);
    console.log(`[${platform} / ${location.label}] baseline set: ₹${result.price}`);
    return;
  }

  const priceChanged = last.price !== result.price;
  const stockChanged = last.inStock !== result.inStock;

  if (priceChanged) {
    const msg = formatChangeMessage({
      productName: result.productName,
      platform,
      location: location.label,
      oldPrice: last.price,
      newPrice: result.price,
    });
    console.log(msg);
    await sendWhatsApp({ to: location.whatsappTo, body: msg });
  }

  if (stockChanged) {
    const msg = formatStockMessage({
      productName: result.productName,
      platform,
      location: location.label,
      inStock: result.inStock,
    });
    console.log(msg);
    await sendWhatsApp({ to: location.whatsappTo, body: msg });
  }

  if (!priceChanged && !stockChanged) {
    console.log(`[${platform} / ${location.label}] no change (₹${result.price})`);
  }

  await setLastPrice(key, result);
}

async function main() {
  const tasks = [];
  for (const location of config.locations) {
    for (const platform of config.platforms) {
      tasks.push(checkOne(location, platform));
    }
  }
  await Promise.all(tasks);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

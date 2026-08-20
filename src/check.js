require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { getPrice } = require("./priceApi");
const { getLastPrice, setLastPrice } = require("./store");
const { sendWhatsApp } = require("./whatsapp");

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "config.json"), "utf-8")
);

function otherPlatformsBlock(otherPrices) {
  if (!otherPrices || otherPrices.length === 0) return "";
  let block = `\n\nOther platforms right now:`;
  for (const p of otherPrices) {
    block += `\n${p.platform}: ₹${p.price}`;
  }
  return block;
}

function formatChangeMessage({ productName, platform, location, oldPrice, newPrice, otherPrices }) {
  const arrow = newPrice > oldPrice ? "📈 up" : "📉 down";
  const diff = Math.abs(newPrice - oldPrice).toFixed(2);
  return (
    `🍅 Tomato price alert (${platform} · ${location})\n` +
    `${productName || "Tomato"}: ₹${oldPrice} → ₹${newPrice} (${arrow} ₹${diff})` +
    otherPlatformsBlock(otherPrices)
  );
}

function formatStockMessage({ productName, platform, location, inStock, otherPrices }) {
  return (
    `🍅 Tomato stock alert (${platform} · ${location})\n` +
    `${productName || "Tomato"} is now ${inStock ? "back IN STOCK" : "OUT OF STOCK"}` +
    otherPlatformsBlock(otherPrices)
  );
}

async function checkLocation(location) {
  // Step 1: fetch every platform's current price for this location first
  const results = {};
  for (const platform of config.platforms) {
    try {
      results[platform] = await getPrice({
        query: config.query,
        platform,
        lat: location.lat,
        lon: location.lon,
      });
    } catch (err) {
      console.error(`[${platform} / ${location.label}] fetch failed:`, err.message);
    }
  }

  // Step 2: compare each platform to its own last price, using the others as context
  for (const platform of config.platforms) {
    const result = results[platform];
    if (!result || result.price == null) {
      console.log(`[${platform} / ${location.label}] no listing found`);
      continue;
    }

    const key = `tomato:${platform}:${location.label}`;
    const last = await getLastPrice(key);

    if (last === null) {
      await setLastPrice(key, result);
      console.log(`[${platform} / ${location.label}] baseline set: ₹${result.price}`);
      continue;
    }

    const priceChanged = last.price !== result.price;
    const stockChanged = last.inStock !== result.inStock;

    const otherPrices = config.platforms
      .filter((p) => p !== platform && results[p] && results[p].price != null)
      .map((p) => ({ platform: p, price: results[p].price }));

    if (priceChanged) {
      const msg = formatChangeMessage({
        productName: result.productName,
        platform,
        location: location.label,
        oldPrice: last.price,
        newPrice: result.price,
        otherPrices,
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
        otherPrices,
      });
      console.log(msg);
      await sendWhatsApp({ to: location.whatsappTo, body: msg });
    }

    if (!priceChanged && !stockChanged) {
      console.log(`[${platform} / ${location.label}] no change (₹${result.price})`);
    }

    await setLastPrice(key, result);
  }
}

async function main() {
  const tasks = config.locations.map((location) => checkLocation(location));
  await Promise.all(tasks);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

/**
 * Fetches the current price of a product on a quick-commerce platform
 * for a given location.
 *
 * Uses a hosted proxy API (quickcommerceapi.com) rather than scraping
 * Blinkit/Zepto directly, because:
 *  - Blinkit/Zepto have no public API
 *  - Direct scraping needs residential proxies + constant selector maintenance
 *  - A hosted provider already deals with that churn
 *
 * Swap this module out if you'd rather run your own Apify actor or
 * Puppeteer scraper — everything downstream just expects
 * { price, inStock, productName } back from getPrice().
 */

const PROVIDER = process.env.PRICE_PROVIDER || "quickcommerceapi";

async function getPriceFromQuickCommerceApi({ query, platform, lat, lon }) {
  const url = new URL("https://api.quickcommerceapi.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lon);
  // Provider expects platform names like "BlinkIt" / "Zepto"
  const platformMap = { blinkit: "BlinkIt", zepto: "Zepto" };
  url.searchParams.set("platform", platformMap[platform] || platform);

  const res = await fetch(url, {
    headers: { "X-API-Key": process.env.QUICKCOMMERCEAPI_KEY },
  });

  if (!res.ok) {
    throw new Error(
      `quickcommerceapi request failed: ${res.status} ${res.statusText}`
    );
  }

  const data = await res.json();
  const item = data?.results?.[0] || data?.data?.[0];

  if (!item) {
    return { price: null, inStock: false, productName: null };
  }

  return {
    price: Number(item.price ?? item.offer_price ?? item.sellingPrice),
    inStock: item.inStock ?? item.available ?? true,
    productName: item.name ?? item.title ?? query,
  };
}

async function getPrice({ query, platform, lat, lon }) {
  if (PROVIDER === "quickcommerceapi") {
    return getPriceFromQuickCommerceApi({ query, platform, lat, lon });
  }
  throw new Error(`Unknown PRICE_PROVIDER: ${PROVIDER}`);
}

module.exports = { getPrice };

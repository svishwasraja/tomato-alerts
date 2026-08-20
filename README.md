# 🍅 Tomato Alerts

Watches the price of tomatoes on Blinkit and Zepto for your location, checks
every 15 minutes, and pings you on WhatsApp the moment the price changes
(up or down) or stock status flips.

Same shape as an IMAX-drop watcher: pick a target → poll on a schedule →
alert the instant the condition changes. The only real difference is the
data source — Blinkit/Zepto don't expose a public API, so this uses a
hosted proxy API instead of scraping directly (see "Why not scrape
directly?" below).

## How it works

```
GitHub Actions (every 15 min)
        │
        ▼
  src/check.js
        │
        ├─► priceApi.js  ──► quickcommerceapi.com  (current price/stock)
        ├─► store.js     ──► Upstash Redis          (last known price)
        └─► whatsapp.js  ──► Twilio WhatsApp         (send alert if changed)
```

No server to keep running — GitHub Actions' cron does the polling for free,
Upstash's free tier holds the tiny bit of state, and Twilio sends the message.

## Setup

### 1. Get a price data API key
Sign up at [quickcommerceapi.com](https://quickcommerceapi.com) (new accounts
get free credits) and grab an API key. This is a paid third-party service
that already handles Blinkit/Zepto's location logic and anti-bot measures —
much less brittle than scraping directly.

*Alternative:* if you'd rather run your own scraper, swap out
`src/priceApi.js` for an [Apify](https://apify.com) actor call (there are
several pre-built Blinkit/Zepto product actors) or your own Puppeteer script.
Just keep the same return shape: `{ price, inStock, productName }`.

### 2. Set up storage
Create a free [Upstash Redis](https://upstash.com) database. Copy the REST
URL and REST token from the dashboard.

### 3. Set up WhatsApp (Twilio)
1. Create a free [Twilio](https://twilio.com) account.
2. Go to **Messaging → Try it out → Send a WhatsApp message** to activate
   the sandbox.
3. From your own WhatsApp, send the given join code (e.g. `join
   xxx-xxx`) to the sandbox number shown there.
4. Copy your Account SID and Auth Token from the Twilio console.

The sandbox is free and works immediately, but two limits to know about:
- Each recipient has to send the join code once.
- The sandbox session expires after 72h of inactivity — just re-send the
  join code if that happens.

For an always-on setup with no rejoining, register a proper WhatsApp
sender in Twilio and get a message template approved — then swap the
plain-text send in `src/whatsapp.js` for that template.

### 4. Configure what to watch
Edit `config.json`:

```json
{
  "query": "tomato",
  "platforms": ["blinkit", "zepto"],
  "locations": [
    {
      "label": "Home",
      "lat": 19.0760,
      "lon": 72.8777,
      "whatsappTo": "whatsapp:+91XXXXXXXXXX"
    }
  ]
}
```

Add more entries to `locations` if you want to watch multiple addresses
(e.g. home + office) — each gets checked and alerted independently.

### 5. Deploy
1. Push this repo to GitHub.
2. In the repo's **Settings → Secrets and variables → Actions**, add:
   - `QUICKCOMMERCEAPI_KEY`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_WHATSAPP_FROM` (sandbox number is `whatsapp:+14155238886`)
3. That's it — the workflow in `.github/workflows/check-prices.yml` runs
   every 15 minutes automatically. You can also trigger it manually from
   the **Actions** tab to test.

### Local testing
```bash
npm install
cp .env.example .env   # fill in your keys
npm run check
```

## Why not scrape directly?

Blinkit and Zepto don't publish a public API, and their apps actively push
back on scraping — datacenter IPs get 403'd, endpoints move, and prices are
hyperlocal (tied to a specific dark store, not just a city). A Puppeteer
script that works today commonly breaks within weeks. Going through a
maintained provider trades a small amount of cost/dependency for a lot
less maintenance — but if you want full control, `src/priceApi.js` is a
single, isolated place to swap in your own scraper.

## Notes
- "Any price change" is the current alert rule (up or down). To alert only
  on drops, or only past a threshold, tweak the condition in
  `src/check.js` (`priceChanged`).
- GitHub Actions' free cron can drift a few minutes under load — fine for
  a 15-minute check, not fine if you need second-level precision.

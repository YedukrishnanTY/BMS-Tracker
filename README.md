# 🛰️ Bothan Spy (`bms-pulse`) — Two-Tier BookMyShow Ticket Notifier

> *"Many Bothans died to bring us this showtime information."*

A self-hosted, real-time BookMyShow ticket availability radar built with **Next.js (App Router)**, **MongoDB**, **Tailwind CSS**, and **Playwright**. 

Designed with a sleek, non-blocky command-bar UI to track multiple upcoming movies across multiple theatres simultaneously and fire instant **Telegram** and **Email** transmissions the moment bookings go live.

---

## ✨ Core Features

* **Two-Tier Notification Engine:**
  * **Tier 1 (City-Wide Alert):** Fires a notification the moment *any* venue in your target city (e.g., Kochi) opens bookings for your target date.
  * **Tier 2 (Specific Theatre Alert):** Continues polling and sends separate notifications with showtimes and direct booking links as each of your selected theatres (e.g., *PVR: Lulu*, *Shenoys*, *Vanitha Cineplex*) opens up.
* **Smart URL Command Bar:** Paste any BookMyShow movie URL and automatically extract the Movie Title, Slug, and `ET` Event Code.
* **Silent Date-Redirect Protection:** Guards against BookMyShow's default behavior of silently redirecting un-opened future dates back to today's date, preventing false-positive alerts.
* **Low-Memory Stealth Playwright Worker:** Uses low-memory Chromium flags (`--single-process`, `--no-zygote`), blocks heavy image/font/CSS assets for 3x faster checks, and masks headless browser fingerprints to fit comfortably inside Render's 512 MB free tier.
* **Modern Swimlane UI:** Built with a dark slate/violet atmospheric canvas, horizontal tracker strips, inline status pills, and a slide-over alert history drawer.

---

## 🏗️ System Architecture (100% Free Stack)

| Layer | Technology | Role | Free Hosting |
| :--- | :--- | :--- | :--- |
| **Dashboard & API** | Next.js (App Router), Tailwind CSS | Manage watchlist, parse BMS URLs, view alert logs | **Vercel (Hobby)** |
| **Database** | MongoDB Atlas + Mongoose | Store movie trackers, theatre states, and notification logs | **MongoDB Atlas (`M0`)** |
| **Scraper Worker** | Node.js, Playwright, `node-cron` | Poll BMS every 2 mins, detect openings, dispatch alerts | **Render (Free Docker Web Service)** |
| **Keep-Alive Pinger** | HTTP Health Check (`/` & `/check`) | Ping Render every 14 mins so the container never sleeps | **cron-job.org** |
| **Notifications** | Telegram Bot API + Nodemailer | Deliver one-tap booking buttons to phone & inbox | Built-in |

---

## 📂 Project Structure

```text
bothan-spy/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── trackers/
│   │   │       ├── route.js          # GET all trackers, POST new tracker
│   │   │       └── [id]/route.js     # PATCH pause/resume, DELETE tracker
│   │   └── page.jsx                  # Modern Command-Bar & Swimlane UI
│   ├── lib/
│   │   ├── mongodb.js                # Cached Mongoose connection
│   │   └── notifier.js               # Concurrent Telegram + Email dispatcher
│   └── models/
│       └── Tracker.js                # Two-tier state & log Mongoose schema
├── worker/
│   └── bms-worker.mjs                # Playwright scraper + HTTP health server
├── Dockerfile                        # Container config for Render Free Tier
└── package.json
```

---

## ⚙️ Environment Variables

Create a `.env.local` file in the root directory:

```env
# 1. MongoDB Atlas Connection String
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/bms_notifier

# 2. Telegram Bot Credentials
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
TELEGRAM_CHAT_ID=987654321

# 3. Email Credentials (Gmail App Password)
SMTP_EMAIL=your-email@gmail.com
SMTP_PASSWORD=your-16-digit-gmail-app-password
NOTIFY_RECEIVER_EMAIL=your-email@gmail.com
```

### How to Get Telegram Credentials (1 Minute)
1. Open Telegram and message **[@BotFather](https://t.me/BotFather)** → send `/newbot` → copy the **HTTP API Token** (`TELEGRAM_BOT_TOKEN`).
2. Open a chat with your newly created bot and send `Hello`.
3. Open `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` in your browser and copy the `"id"` field inside `"chat"` (`TELEGRAM_CHAT_ID`).

---

## 🚀 Running Locally

1. **Install dependencies & Playwright Chromium:**
   ```bash
   npm install
   npx playwright install chromium
   ```

2. **Start the Next.js Dashboard (Terminal 1):**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to add movies and toggle theatres.

3. **Start the Background Worker (Terminal 2):**
   ```bash
   npm run worker
   ```



## 📜 License

MIT License — free for personal use.
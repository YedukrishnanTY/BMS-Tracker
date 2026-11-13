import http from "http";
import cron from "node-cron";
import { chromium } from "playwright";
import { connectDB } from "../src/lib/mongodb.js";
import Tracker from "../src/models/Tracker.js";
import { triggerNotifications } from "../src/lib/notifier.js";

let isRunning = false;
let lastRunTime = null;

function buildBmsUrl(tracker) {
  return `https://in.bookmyshow.com/buytickets/${tracker.movieSlug}-${tracker.citySlug}/movie-${tracker.cityCode.toLowerCase()}-${tracker.movieCode}-MT/${tracker.targetDate}`;
}

async function checkTrackers() {
  if (isRunning) {
    console.log("⏳ Previous check still running, skipping overlapping cycle...");
    return;
  }

  isRunning = true;
  let browser = null;

  try {
    await connectDB();
    const activeTrackers = await Tracker.find({ status: "watching" });
    lastRunTime = new Date().toISOString();

    if (activeTrackers.length === 0) {
      console.log(`[${new Date().toLocaleTimeString()}] No active trackers.`);
      return;
    }

    console.log(`[${new Date().toLocaleTimeString()}] Checking ${activeTrackers.length} tracker(s)...`);

    // Launch Chromium with Stealth & Container-Safe Flags
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1366, height: 768 },
      locale: "en-IN",
      timezoneId: "Asia/Kolkata",
      extraHTTPHeaders: {
        "Accept-Language": "en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    // Mask headless automation fingerprint from Cloudflare
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    for (const tracker of activeTrackers) {
      const page = await context.newPage();

      // Block heavy media/fonts to cut load time & bandwidth by 70%
      await page.route("**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,css}", (route) =>
        route.abort()
      );

      const targetUrl = buildBmsUrl(tracker);

      try {
        await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(2500);

        const finalUrl = page.url();

        // Guard against silent redirects when date is not yet open
        const isBuyTicketsPage = finalUrl.includes("/buytickets/");
        const isExactDateLoaded = finalUrl.endsWith(`/${tracker.targetDate}`);

        if (!isBuyTicketsPage || !isExactDateLoaded) {
          tracker.lastCheckedAt = new Date();
          await tracker.save();
          await page.close();
          continue;
        }

        const scrapedVenues = await page.evaluate(() => {
          const venues = [];
          const venueElements = document.querySelectorAll(
            "ul#venuelist > li, [data-id='venue-item'], .ReactVirtualized__Grid__innerScrollContainer > div"
          );

          venueElements.forEach((el) => {
            const textContent = el.innerText || "";
            const codeAttr = el.getAttribute("data-id") || "";
            const timeMatches =
              textContent.match(/\b(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)\b/gi) || [];

            if (textContent.trim().length > 0) {
              venues.push({
                rawText: textContent.toLowerCase(),
                code: codeAttr.toUpperCase(),
                showtimes: [...new Set(timeMatches)],
              });
            }
          });

          if (venues.length === 0) {
            document.querySelectorAll("a[href*='/cinemas/']").forEach((a) => {
              const container = a.closest("li, div") || a;
              const rawText = (container.innerText || a.innerText || "").toLowerCase();
              const href = a.getAttribute("href") || "";
              const timeMatches =
                rawText.match(/\b(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)\b/gi) || [];
              venues.push({
                rawText,
                code: href.toUpperCase(),
                showtimes: [...new Set(timeMatches)],
              });
            });
          }

          return venues;
        });

        // TIER 1: City-level opening alert
        if (scrapedVenues.length > 0 && !tracker.cityBookingOpen) {
          console.log(`🟢 [CITY OPEN] ${tracker.movieTitle} in ${tracker.citySlug}`);
          tracker.cityBookingOpen = true;
          tracker.cityNotifiedAt = new Date();
          tracker.logs.unshift({
            type: "CITY_OPEN",
            message: `Bookings opened in ${tracker.citySlug.toUpperCase()} (${scrapedVenues.length} venues live)`,
            bookingUrl: targetUrl,
          });

          await triggerNotifications({
            tracker,
            tier: "CITY",
            bookingUrl: targetUrl,
          });
        }

        // TIER 2: Specific Theatre opening alerts
        for (const targetTheatre of tracker.targetTheatres) {
          if (targetTheatre.isNotified) continue;

          const matchedVenue = scrapedVenues.find(
            (v) =>
              v.rawText.includes(targetTheatre.matchKeyword.toLowerCase()) ||
              (targetTheatre.theatreCode &&
                v.code.includes(targetTheatre.theatreCode.toUpperCase()))
          );

          if (matchedVenue) {
            console.log(`🎟️ [THEATRE OPEN] ${tracker.movieTitle} @ ${targetTheatre.theatreName}`);
            targetTheatre.isNotified = true;
            targetTheatre.notifiedAt = new Date();
            targetTheatre.showtimes = matchedVenue.showtimes;

            tracker.logs.unshift({
              type: "THEATRE_OPEN",
              message: `${targetTheatre.theatreName} opened bookings`,
              bookingUrl: targetUrl,
            });

            await triggerNotifications({
              tracker,
              tier: "THEATRE",
              theatreName: targetTheatre.theatreName,
              showtimes: matchedVenue.showtimes,
              bookingUrl: targetUrl,
            });
          }
        }

        const allTheatresNotified =
          tracker.targetTheatres.length > 0 &&
          tracker.targetTheatres.every((t) => t.isNotified);

        if (tracker.cityBookingOpen && allTheatresNotified) {
          tracker.status = "completed";
        }

        tracker.lastCheckedAt = new Date();
        await tracker.save();
      } catch (err) {
        console.error(`Error checking ${tracker.movieTitle}:`, err.message);
      } finally {
        await page.close();
      }
    }
  } catch (err) {
    console.error("Worker cycle error:", err.message);
  } finally {
    if (browser) await browser.close();
    isRunning = false;
  }
}

// 1. Start HTTP Health-Check Server on Port 7860 (Required by Hugging Face Spaces)
const PORT = process.env.PORT || 7860;
http
  .createServer((req, res) => {
    if (req.url === "/check") {
      checkTrackers();
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "Triggered manual check", lastRunTime }));
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        service: "BMS Pulse Playwright Worker",
        status: "healthy",
        isRunning,
        lastRunTime,
      })
    );
  })
  .listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Health server listening on port ${PORT}`);
  });

// 2. Run immediately and schedule every 2 minutes with slight random jitter
checkTrackers();
cron.schedule("*/2 * * * *", () => {
  const jitterMs = Math.floor(Math.random() * 8000);
  setTimeout(checkTrackers, jitterMs);
});
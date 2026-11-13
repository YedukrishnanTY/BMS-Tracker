import http from "http";
import cron from "node-cron";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { connectDB } from "../src/lib/mongodb.js";
import Tracker from "../src/models/Tracker.js";
import { triggerNotifications } from "../src/lib/notifier.js";

// Enable full stealth evasion patches
chromium.use(StealthPlugin());

let isRunning = false;
let lastRunTime = null;

function buildBmsUrl(tracker) {
  const cleanSlug = (tracker.movieSlug || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const cleanCity = (tracker.citySlug || "kochi").toLowerCase().trim();
  const cleanCode = (tracker.movieCode || "").toUpperCase().trim();

  return `https://in.bookmyshow.com/movies/${cleanCity}/${cleanSlug}/buytickets/${cleanCode}/${tracker.targetDate}`;
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
      console.log(`[${new Date().toLocaleTimeString()}] No active trackers in DB.`);
      return;
    }

    console.log(`[${new Date().toLocaleTimeString()}] 🔍 Checking ${activeTrackers.length} tracker(s)...`);

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
    });

    const page = await context.newPage();

    // Warm up session on BMS home page to pass Cloudflare cookie check
    await page.goto("https://in.bookmyshow.com/explore/home/kochi", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    for (const tracker of activeTrackers) {
      const targetUrl = buildBmsUrl(tracker);
      console.log(`➡️ [${tracker.movieTitle.trim()}] Navigating to: ${targetUrl}`);

      try {
        await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        // Wait 5s to allow any Cloudflare JS challenge to auto-resolve
        await page.waitForTimeout(5000);

        const finalUrl = page.url();
        const pageTitle = await page.title();
        console.log(`📄 [${tracker.movieTitle.trim()}] Loaded Title: "${pageTitle}" | Final URL: ${finalUrl}`);

        if (
          pageTitle.toLowerCase().includes("just a moment") ||
          pageTitle.toLowerCase().includes("attention required")
        ) {
          console.warn(`⚠️ [${tracker.movieTitle.trim()}] Still blocked by Cloudflare Datacenter IP filter.`);
          continue;
        }

        const isBuyTicketsPage = finalUrl.includes("/buytickets/");
        const isExactDateLoaded = finalUrl.includes(`/${tracker.targetDate}`);

        if (!isBuyTicketsPage || !isExactDateLoaded) {
          console.log(
            `⏸️ [${tracker.movieTitle.trim()}] Date ${tracker.targetDate} not open yet (redirected to ${finalUrl}).`
          );
          tracker.lastCheckedAt = new Date();
          await tracker.save();
          continue;
        }

        const scrapedVenues = await page.evaluate(() => {
          const venues = [];
          const timeRegex = /\b(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)\b/gi;

          const candidates = document.querySelectorAll(
            "ul#venuelist > li, [data-id='venue-item'], .ReactVirtualized__Grid__innerScrollContainer > div, a[href*='/cinemas/']"
          );

          candidates.forEach((el) => {
            const container = el.tagName === "A" ? el.closest("li, div") || el : el;
            const rawText = (container.innerText || "").toLowerCase();
            const showtimes = rawText.match(timeRegex) || [];

            if (showtimes.length > 0) {
              const codeAttr =
                container.getAttribute("data-id") || el.getAttribute("href") || "";
              venues.push({
                rawText,
                code: codeAttr.toUpperCase(),
                showtimes: [...new Set(showtimes.map((s) => s.toUpperCase()))],
              });
            }
          });

          if (venues.length === 0) {
            const bodyText = document.body.innerText || "";
            const allTimes = bodyText.match(timeRegex) || [];
            if (allTimes.length > 0) {
              venues.push({
                rawText: bodyText.toLowerCase(),
                code: "BODY_SCAN",
                showtimes: [...new Set(allTimes.map((s) => s.toUpperCase()))],
              });
            }
          }

          return venues;
        });

        console.log(
          `🎭 [${tracker.movieTitle.trim()}] Active venue blocks with showtimes found: ${scrapedVenues.length}`
        );

        if (scrapedVenues.length > 0 && !tracker.cityBookingOpen) {
          console.log(`🟢 [CITY OPEN] Sending notification for ${tracker.movieTitle.trim()} in ${tracker.citySlug}!`);
          tracker.cityBookingOpen = true;
          tracker.cityNotifiedAt = new Date();
          tracker.logs.unshift({
            type: "CITY_OPEN",
            message: `Bookings opened in ${tracker.citySlug.toUpperCase()}`,
            bookingUrl: targetUrl,
          });

          await triggerNotifications({
            tracker,
            tier: "CITY",
            bookingUrl: targetUrl,
          });
        }

        for (const targetTheatre of tracker.targetTheatres) {
          if (targetTheatre.isNotified) continue;

          const matchedVenue = scrapedVenues.find(
            (v) =>
              v.rawText.includes(targetTheatre.matchKeyword.toLowerCase()) ||
              (targetTheatre.theatreCode &&
                v.code.includes(targetTheatre.theatreCode.toUpperCase()))
          );

          if (matchedVenue) {
            console.log(
              `🎟️ [THEATRE OPEN] Sending notification for ${tracker.movieTitle.trim()} @ ${targetTheatre.theatreName}!`
            );
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
          } else {
            console.log(
              `⏳ [${tracker.movieTitle.trim()}] Watched theatre "${targetTheatre.theatreName}" not found on page yet.`
            );
          }
        }

        const allTheatresNotified =
          tracker.targetTheatres.length > 0 &&
          tracker.targetTheatres.every((t) => t.isNotified);

        if (tracker.cityBookingOpen && allTheatresNotified) {
          console.log(
            `🏁 [${tracker.movieTitle.trim()}] All watched theatres notified! Marking tracker completed.`
          );
          tracker.status = "completed";
        }

        tracker.lastCheckedAt = new Date();
        await tracker.save();
      } catch (err) {
        console.error(`❌ Error checking ${tracker.movieTitle.trim()}:`, err.message);
      }
    }

    await page.close();
    console.log(`[${new Date().toLocaleTimeString()}] ✅ Scan cycle finished.`);
  } catch (err) {
    console.error("❌ Worker cycle error:", err.message);
  } finally {
    if (browser) await browser.close();
    isRunning = false;
  }
}

const PORT = process.env.PORT || 10000;
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

checkTrackers();
cron.schedule("*/2 * * * *", () => {
  const jitterMs = Math.floor(Math.random() * 5000);
  setTimeout(checkTrackers, jitterMs);
});
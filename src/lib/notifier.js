import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
    },
});

export async function sendTelegramAlert({ title, body, bookingUrl }) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    const text = `🎬 *${title}*\n\n${body}`;

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [[{ text: "🎟️ Book Tickets Now", url: bookingUrl }]],
            },
        }),
    });
}

export async function sendEmailAlert({ subject, heading, details, bookingUrl }) {
    if (!process.env.SMTP_EMAIL || !process.env.NOTIFY_RECEIVER_EMAIL) return;

    const html = `
    <div style="font-family: Inter, sans-serif; background: #0f172a; color: #f8fafc; padding: 32px; border-radius: 12px; max-width: 520px;">
      <span style="background: rgba(167, 139, 250, 0.15); color: #a78bfa; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600;">
        BMS LIVE ALERT
      </span>
      <h2 style="margin: 16px 0 8px; color: #ffffff;">${heading}</h2>
      <p style="color: #94a3b8; line-height: 1.6; margin-bottom: 24px;">${details}</p>
      <a href="${bookingUrl}" style="display: inline-block; background: #8b5cf6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
        Open BookMyShow →
      </a>
    </div>
  `;

    await transporter.sendMail({
        from: `"BMS Pulse Notifier" <${process.env.SMTP_EMAIL}>`,
        to: process.env.NOTIFY_RECEIVER_EMAIL,
        subject,
        html,
    });
}

export async function triggerNotifications({
    tracker,
    tier, // "CITY" | "THEATRE"
    theatreName = null,
    showtimes = [],
    bookingUrl,
}) {
    const formattedDate = `${tracker.targetDate.slice(6, 8)}/${tracker.targetDate.slice(4, 6)}/${tracker.targetDate.slice(0, 4)}`;
    const cityUpper = tracker.citySlug.toUpperCase();
    const tasks = [];

    if (tier === "CITY") {
        const title = `🟢 BOOKINGS LIVE • ${cityUpper}`;
        const body = [
            `🎬 *${tracker.movieTitle}*`,
            `📅 *Date:* ${formattedDate}`,
            `📍 *City:* ${cityUpper}`,
            ``,
            `⏳ _Tickets are live in your city! We're still actively watching your preferred theatres._`,
        ].join("\n");

        if (tracker.notifyTelegram) {
            tasks.push(sendTelegramAlert({ title, body, bookingUrl }));
        }
        if (tracker.notifyEmail) {
            tasks.push(
                sendEmailAlert({
                    subject: `🟢 [${cityUpper}] ${tracker.movieTitle} Bookings Started!`,
                    heading: `${tracker.movieTitle} is now live in ${cityUpper}`,
                    details: `Bookings have officially opened in ${tracker.citySlug} for ${formattedDate}. Your specific theatres are still being monitored.`,
                    bookingUrl,
                })
            );
        }
    } else if (tier === "THEATRE") {
        const title = `🎟️ TICKETS OPEN • ${theatreName.toUpperCase()}`;
        const showsSection = showtimes.length
            ? `\n🕒 *Available Shows:*\n${showtimes.map((time) => `   • \`${time}\``).join("\n")}`
            : "";

        const body = [
            `🎬 *${tracker.movieTitle}*`,
            `🏛️ *Theatre:* ${theatreName}`,
            `📅 *Date:* ${formattedDate}`,
            showsSection,
        ]
            .filter(Boolean)
            .join("\n");

        if (tracker.notifyTelegram) {
            tasks.push(sendTelegramAlert({ title, body, bookingUrl }));
        }
        if (tracker.notifyEmail) {
            tasks.push(
                sendEmailAlert({
                    subject: `🎟️ [${theatreName}] ${tracker.movieTitle} Tickets Open!`,
                    heading: `${theatreName} just opened bookings!`,
                    details: `Tickets for ${tracker.movieTitle} on ${formattedDate} are now available at ${theatreName}. ${
                        showtimes.length ? `Available slots: ${showtimes.join(", ")}` : ""
                    }`,
                    bookingUrl,
                })
            );
        }
    }

    await Promise.allSettled(tasks);
}
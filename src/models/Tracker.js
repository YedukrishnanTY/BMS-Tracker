import mongoose from "mongoose";

const TargetTheatreSchema = new mongoose.Schema({
  theatreCode: { type: String, required: true }, // e.g., "PVLK", "SNYK", "VMHE"
  theatreName: { type: String, required: true }, // e.g., "PVR: Lulu, Kochi"
  matchKeyword: { type: String, required: true }, // e.g., "pvr: lulu"
  isNotified: { type: Boolean, default: false },
  notifiedAt: { type: Date, default: null },
  showtimes: [{ type: String }],
});

const LogEntrySchema = new mongoose.Schema({
  type: { type: String, enum: ["CITY_OPEN", "THEATRE_OPEN"], required: true },
  message: { type: String, required: true },
  bookingUrl: { type: String },
  timestamp: { type: Date, default: Date.now },
});

const TrackerSchema = new mongoose.Schema(
  {
    movieTitle: { type: String, required: true },
    movieCode: { type: String, required: true }, // e.g., "ET00384234"
    movieSlug: { type: String, required: true }, // e.g., "empuraan"
    citySlug: { type: String, default: "kochi" },
    cityCode: { type: String, default: "KOCH" },
    targetDate: { type: String, required: true }, // Format: "YYYYMMDD"

    // Tier 1: City-wide state
    cityBookingOpen: { type: Boolean, default: false },
    cityNotifiedAt: { type: Date, default: null },

    // Tier 2: Specific Theatres state
    targetTheatres: [TargetTheatreSchema],

    // Notification Preferences
    notifyTelegram: { type: Boolean, default: true },
    notifyEmail: { type: Boolean, default: true },

    status: {
      type: String,
      enum: ["watching", "completed", "paused"],
      default: "watching",
    },
    lastCheckedAt: { type: Date, default: null },
    logs: [LogEntrySchema],
  },
  { timestamps: true }
);

export default mongoose.models.Tracker || mongoose.model("Tracker", TrackerSchema);
"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Bell,
  Send,
  Mail,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Clock,
  Activity,
  Plus,
  MapPin,
  Calendar,
  Pause,
  Play,
  X,
} from "lucide-react";
import logo from '/public/logo.png';
import Image from "next/image";

// Real BookMyShow Kochi Venue Presets
const KOCHI_THEATRE_PRESETS = [
  { theatreCode: "PVLC", theatreName: "PVR: Lulu Kochi (Audi 4, 9-All New 3D Projection)", matchKeyword: "pvr-lulu-kochi-audi-4-9-all-new-3d-projection" },
  { theatreCode: "SNYK", theatreName: "Shenoys: Kochi", matchKeyword: "shenoys" },
  { theatreCode: "VMHE", theatreName: "Vanitha Cineplex: Edappally", matchKeyword: "vanitha cineplex" },
  { theatreCode: "CICS", theatreName: "Cinepolis: Centre Square", matchKeyword: "centre square" },
  { theatreCode: "PVFO", theatreName: "PVR: Forum Mall, Kochi", matchKeyword: "forum mall" },
  { theatreCode: "PVOB", theatreName: "PVR: Oberon Mall, Kochi", matchKeyword: "oberon" },
  { theatreCode: "PANC", theatreName: "PAN Cinemas: Nucleus Mall", matchKeyword: "pan cinemas" },
  { theatreCode: "KAVI", theatreName: "Kavitha Theatre: Ernakulam", matchKeyword: "kavitha" },
];

export default function BMSNotifierDashboard() {
  const [trackers, setTrackers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Command Bar State
  const [bmsInput, setBmsInput] = useState("");
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [movieTitle, setMovieTitle] = useState("");
  const [movieSlug, setMovieSlug] = useState("");
  const [movieCode, setMovieCode] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [selectedTheatres, setSelectedTheatres] = useState([
    KOCHI_THEATRE_PRESETS[0], // Default PVR Lulu selected
  ]);
  const [customTheatreName, setCustomTheatreName] = useState("");
  const [notifyTelegram, setNotifyTelegram] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);

  async function fetchTrackers() {
    try {
      const res = await fetch("/api/trackers");
      const data = await res.json();
      setTrackers(data);
    } catch (err) {
      console.error("Failed to load trackers", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTrackers();
    const interval = setInterval(fetchTrackers, 15000);
    return () => clearInterval(interval);
  }, []);

  // Auto-parse BookMyShow URL when pasted into the command bar
  function handleUrlPasteOrChange(val) {
    setBmsInput(val);
    setComposerExpanded(true);

    // Matches URLs like: https://in.bookmyshow.com/kochi/movies/pushpa-2-the-rule/ET00356724
    // or /buytickets/pushpa-2-the-rule-kochi/movie-koch-ET00356724-MT/20261205
    const codeMatch = val.match(/(ET\d{8})/i);
    const moviesSlugMatch = val.match(/\/movies\/([^\/]+)\/ET\d+/i);
    const buyTicketsSlugMatch = val.match(/\/buytickets\/([^\/]+)-[a-z]+\/movie-/i);

    if (codeMatch) {
      setMovieCode(codeMatch[1].toUpperCase());
    }
    const extractedSlug = moviesSlugMatch?.[1] || buyTicketsSlugMatch?.[1];
    if (extractedSlug) {
      setMovieSlug(extractedSlug.toLowerCase());
      const prettyTitle = extractedSlug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      setMovieTitle(prettyTitle);
    } else if (!val.startsWith("http")) {
      setMovieTitle(val);
      setMovieSlug(val.toLowerCase().trim().replace(/\s+/g, "-"));
    }
  }

  function togglePresetTheatre(preset) {
    const exists = selectedTheatres.some((t) => t.theatreCode === preset.theatreCode);
    if (exists) {
      setSelectedTheatres(selectedTheatres.filter((t) => t.theatreCode !== preset.theatreCode));
    } else {
      setSelectedTheatres([...selectedTheatres, preset]);
    }
  }

  function addCustomTheatre() {
    if (!customTheatreName.trim()) return;
    const customObj = {
      theatreCode: customTheatreName.slice(0, 4).toUpperCase(),
      theatreName: customTheatreName.trim(),
      matchKeyword: customTheatreName.trim().toLowerCase(),
    };
    setSelectedTheatres([...selectedTheatres, customObj]);
    setCustomTheatreName("");
  }

  async function handleCreateTracker(e) {
    e.preventDefault();
    if (!movieTitle || !movieCode || !targetDate) return;

    const formattedDate = targetDate.replaceAll("-", ""); // YYYY-MM-DD -> YYYYMMDD

    const res = await fetch("/api/trackers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        movieTitle,
        movieCode,
        movieSlug: movieSlug || movieTitle.toLowerCase().replace(/\s+/g, "-"),
        citySlug: "kochi",
        cityCode: "KOCH",
        targetDate: formattedDate,
        targetTheatres: selectedTheatres,
        notifyTelegram,
        notifyEmail,
      }),
    });

    if (res.ok) {
      setBmsInput("");
      setMovieTitle("");
      setMovieCode("");
      setMovieSlug("");
      setComposerExpanded(false);
      fetchTrackers();
    }
  }

  async function handleDelete(id) {
    await fetch(`/api/trackers/${id}`, { method: "DELETE" });
    fetchTrackers();
  }

  async function handleTogglePause(tracker) {
    const nextStatus = tracker.status === "paused" ? "watching" : "paused";
    await fetch(`/api/trackers/${tracker._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    fetchTrackers();
  }

  const allLogs = trackers
    .flatMap((t) =>
      (t.logs || []).map((l) => ({
        ...l,
        movieTitle: t.movieTitle,
        targetDate: t.targetDate,
      }))
    )
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 selection:bg-violet-500/30 selection:text-violet-200 relative overflow-x-hidden">
      {/* Subtle Top Radial Atmosphere */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(167,139,250,0.14),transparent)]" />

      <div className="max-w-5xl mx-auto px-6 py-10 relative z-10">
        {/* Top Minimal Header */}
        <header className="flex items-center justify-between pb-8 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            {/* <div className="h-9 w-9 rounded-xl bg-violet-500/10 border border-violet-400/20 flex items-center justify-center text-violet-400"> */}
              <Image src={'/logo.png'} alt="logo" width={150} height={20} />
            {/* </div> */}
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
                BMS Tracker
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-800/90 text-violet-300 border border-violet-500/20">
                  Kochi
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                city & theatre showtime radar
              </p>
            </div>
          </div>

          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-zinc-900/70 hover:bg-zinc-800/80 border border-white/[0.07] text-xs text-slate-300 transition"
          >
            <Activity className="w-3.5 h-3.5 text-violet-400" />
            <span>Alert Stream</span>
            {allLogs.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-violet-500/20 text-violet-300 text-[10px]">
                {allLogs.length}
              </span>
            )}
          </button>
        </header>

        {/* Floating Spotlight Command Bar */}
        <section className="my-8">
          <div className="rounded-2xl bg-zinc-900/60 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/40 transition-all overflow-hidden">
            <div className="flex items-center px-4 py-3.5 gap-3">
              <Bell className="w-4 h-4 text-violet-400 shrink-0" />
              <input
                type="text"
                value={bmsInput}
                onFocus={() => setComposerExpanded(true)}
                onChange={(e) => handleUrlPasteOrChange(e.target.value)}
                placeholder="Paste BookMyShow movie URL (e.g. https://in.bookmyshow.com/kochi/movies/empuraan/ET00384234)..."
                className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              {composerExpanded && (
                <button
                  onClick={() => setComposerExpanded(false)}
                  className="text-slate-500 hover:text-slate-300 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Expandable Configuration Drawer inside Command Bar */}
            {composerExpanded && (
              <form
                onSubmit={handleCreateTracker}
                className="px-5 pb-5 pt-3 border-t border-white/[0.05] space-y-5 bg-zinc-950/40"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">
                      Movie Title
                    </label>
                    <input
                      type="text"
                      required
                      value={movieTitle}
                      onChange={(e) => setMovieTitle(e.target.value)}
                      placeholder="e.g. L2: Empuraan"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900/90 border border-white/[0.07] text-sm text-white focus:border-violet-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">
                      BMS Event Code
                    </label>
                    <input
                      type="text"
                      required
                      value={movieCode}
                      onChange={(e) => setMovieCode(e.target.value.toUpperCase())}
                      placeholder="e.g. ET00384234"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900/90 border border-white/[0.07] text-sm font-mono text-violet-300 focus:border-violet-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">
                      Target Date
                    </label>
                    <input
                      type="date"
                      required
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900/90 border border-white/[0.07] text-sm text-white focus:border-violet-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Theatre Pill Selector */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] uppercase tracking-wider text-slate-400">
                      Tier 2: Watch Specific Kochi Theatres (Tap to toggle)
                    </label>
                    <span className="text-[11px] text-violet-400">
                      {selectedTheatres.length} selected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {KOCHI_THEATRE_PRESETS.map((preset) => {
                      const active = selectedTheatres.some(
                        (t) => t.theatreCode === preset.theatreCode
                      );
                      return (
                        <button
                          type="button"
                          key={preset.theatreCode}
                          onClick={() => togglePresetTheatre(preset)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${active
                            ? "bg-violet-500/20 text-violet-200 border border-violet-400/40 shadow-sm shadow-violet-500/10"
                            : "bg-zinc-900/80 text-slate-400 border border-white/[0.05] hover:border-white/15"
                            }`}
                        >
                          <span>{preset.theatreName}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Custom Theatre Inline */}
                  {/* <div className="mt-3 flex items-center gap-2 max-w-sm">
                    <input
                      type="text"
                      value={customTheatreName}
                      onChange={(e) => setCustomTheatreName(e.target.value)}
                      placeholder="Add another theatre (e.g. Padma Cinema)..."
                      className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-900/60 border border-white/[0.06] text-xs text-white focus:outline-none focus:border-violet-400"
                    />
                    <button
                      type="button"
                      onClick={addCustomTheatre}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-slate-300 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div> */}
                </div>

                {/* Channels & Submit Footer */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/[0.05]">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyTelegram}
                        onChange={(e) => setNotifyTelegram(e.target.checked)}
                        className="accent-violet-500 rounded"
                      />
                      <Send className="w-3.5 h-3.5 text-sky-400" /> Telegram Bot
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyEmail}
                        onChange={(e) => setNotifyEmail(e.target.checked)}
                        className="accent-violet-500 rounded"
                      />
                      <Mail className="w-3.5 h-3.5 text-amber-400" /> Email Alert
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs transition shadow-lg shadow-violet-600/25"
                  >
                    Start Monitoring Movie
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* Active Watchlist Swimlanes (No Brick Grid) */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-2 mb-3">
            <h2 className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Active Watchlist ({trackers.length})
            </h2>
            <span className="text-[11px] text-slate-500">
              Worker polls every 15 mins • Tier 1 (City) + Tier 2 (Theatres)
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Loading watchlist...
            </div>
          ) : trackers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.07] py-14 text-center">
              <p className="text-sm text-slate-400">
                No movies being tracked yet. Paste a BookMyShow link above to begin.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06] rounded-2xl bg-zinc-900/40 backdrop-blur-md border border-white/[0.06] overflow-hidden">
              {trackers.map((tracker) => {
                const formattedDate = `${tracker.targetDate.slice(6, 8)}/${tracker.targetDate.slice(4, 6)}/${tracker.targetDate.slice(0, 4)}`;
                const bmsUrl = `https://in.bookmyshow.com/buytickets/${tracker.movieSlug}-${tracker.citySlug}/movie-${tracker.cityCode.toLowerCase()}-${tracker.movieCode}-MT/${tracker.targetDate}`;

                return (
                  <div
                    key={tracker._id}
                    className="p-5 hover:bg-white/[0.02] transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    {/* Left Column: Movie Info & Tier 1 City Status */}
                    <div className="space-y-1.5 min-w-[260px]">
                      <div className="flex items-center gap-2.5">
                        {/* Live Status Pulse Dot */}
                        <span className="relative flex h-2.5 w-2.5">
                          {tracker.status === "watching" && (
                            <span
                              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${tracker.cityBookingOpen ? "bg-emerald-400" : "bg-amber-400"
                                }`}
                            />
                          )}
                          <span
                            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${tracker.status === "paused"
                              ? "bg-slate-600"
                              : tracker.cityBookingOpen
                                ? "bg-emerald-400"
                                : "bg-amber-400"
                              }`}
                          />
                        </span>

                        <h3 className="font-semibold text-white text-base tracking-tight">
                          {tracker.movieTitle}
                        </h3>

                        <span className="text-[11px] font-mono text-slate-500">
                          {tracker.movieCode}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pl-5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {formattedDate}
                        </span>

                        {/* Tier 1 Badge: City Status */}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${tracker.cityBookingOpen
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-amber-500/10 text-amber-300/90 border border-amber-500/20"
                            }`}
                        >
                          <MapPin className="w-3 h-3" />
                          {tracker.cityBookingOpen
                            ? "Kochi City Open (Notified)"
                            : "Waiting for Kochi"}
                        </span>
                      </div>
                    </div>

                    {/* Middle Column: Inline Stream of Watched Theatres (Tier 2) */}
                    <div className="flex flex-wrap items-center gap-2 flex-1 lg:justify-end">
                      {tracker.targetTheatres.map((theatre, idx) => (
                        <a
                          key={idx}
                          href={bmsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`group px-3 py-1.5 rounded-full text-xs transition-all flex items-center gap-1.5 ${theatre.isNotified
                            ? "bg-violet-500/20 text-violet-200 border border-violet-400/40 shadow-sm shadow-violet-500/10"
                            : "bg-zinc-800/70 text-slate-400 border border-white/[0.05] hover:border-white/15"
                            }`}
                        >
                          {theatre.isNotified ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          )}
                          <span>{theatre.theatreName}</span>
                          {theatre.showtimes?.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-violet-400/20 text-violet-200">
                              {theatre.showtimes.length} shows
                            </span>
                          )}
                        </a>
                      ))}
                    </div>

                    {/* Right Column: Quick Controls */}
                    <div className="flex items-center gap-1.5 self-end lg:self-center shrink-0">
                      <a
                        href={bmsUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Open BMS Page"
                        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-zinc-800/80 transition"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleTogglePause(tracker)}
                        title={tracker.status === "paused" ? "Resume" : "Pause"}
                        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-zinc-800/80 transition"
                      >
                        {tracker.status === "paused" ? (
                          <Play className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Pause className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(tracker._id)}
                        title="Remove Tracker"
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Slide-Over Notification Log Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#111827] border-l border-white/[0.08] h-full p-6 flex flex-col justify-between">
            <div className="overflow-y-auto space-y-6">
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Dispatched Alerts History
                  </h3>
                  <p className="text-xs text-slate-400">
                    Chronological log of Telegram & Email triggers
                  </p>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-zinc-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {allLogs.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-12">
                  No alerts fired yet. As soon as Kochi or a watched theatre opens, it will appear here.
                </p>
              ) : (
                <div className="relative border-l border-white/10 ml-3 space-y-6 pl-5">
                  {allLogs.map((log, index) => (
                    <div key={index} className="relative group">
                      <span
                        className={`absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full ${log.type === "CITY_OPEN" ? "bg-emerald-400" : "bg-violet-400"
                          }`}
                      />
                      <div className="text-[11px] text-slate-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                      <div className="text-xs font-medium text-white mt-0.5">
                        {log.movieTitle}
                      </div>
                      <div className="text-xs text-slate-300 mt-0.5">
                        {log.message}
                      </div>
                      {log.bookingUrl && (
                        <a
                          href={log.bookingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-violet-400 hover:underline mt-1"
                        >
                          Direct Booking Page <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
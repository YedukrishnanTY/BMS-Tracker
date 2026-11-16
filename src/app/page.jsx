"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Toaster, toast } from "sonner";
import {
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  Pause,
  Play,
  Send,
  Trash2,
  X,
} from "lucide-react";

// Real BookMyShow Kochi Venue Presets
const KOCHI_THEATRE_PRESETS = [
  { theatreCode: "PVLC", theatreName: "PVR: Lulu Kochi (Audi 4, 9-All New 3D Projection)", matchKeyword: "Lulu" },
  { theatreCode: "SNYK", theatreName: "Shenoys: Kochi", matchKeyword: "shenoys" },
  { theatreCode: "VMHE", theatreName: "Vanitha Cineplex: Edappally", matchKeyword: "vanitha cineplex" },
  { theatreCode: "CICS", theatreName: "Cinepolis: Centre Square", matchKeyword: "centre square" },
  { theatreCode: "PVFO", theatreName: "PVR: Forum Mall, Kochi", matchKeyword: "forum mall" },
  { theatreCode: "PVOB", theatreName: "PVR: Oberon Mall, Kochi", matchKeyword: "oberon" },
  { theatreCode: "PANC", theatreName: "PAN Cinemas: Nucleus Mall", matchKeyword: "pan cinemas" },
  { theatreCode: "KAVI", theatreName: "Kavitha Theatre: Ernakulam", matchKeyword: "kavitha" },
  { theatreCode: "PMNK", theatreName: "PVR: Mymoon, Kochi", matchKeyword: "Mymoon" },
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
  const [theatreMode, setTheatreMode] = useState("presets");
  const [selectedTheatres, setSelectedTheatres] = useState([
    KOCHI_THEATRE_PRESETS[0], // Default PVR Lulu selected
  ]);
  const [customCitySlug, setCustomCitySlug] = useState("");
  const [customTheatreCode, setCustomTheatreCode] = useState("");
  const [customTheatreName, setCustomTheatreName] = useState("");
  const [customMatchKeyword, setCustomMatchKeyword] = useState("");
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

  async function handleCreateTracker(e) {
    e.preventDefault();
    if (!movieTitle.trim()) {
      toast.error("Enter a movie title.");
      return;
    }
    if (!movieCode.trim()) {
      toast.error("Enter the BookMyShow event code.");
      return;
    }
    if (!targetDate) {
      toast.error("Choose a show date.");
      return;
    }
    if (theatreMode === "custom") {
      if (!customCitySlug.trim()) {
        toast.error("Enter a city.");
        return;
      }
      if (!customTheatreCode.trim()) {
        toast.error("Enter the theatre code.");
        return;
      }
      if (!customTheatreName.trim()) {
        toast.error("Enter the theatre name.");
        return;
      }
      if (!customMatchKeyword.trim()) {
        toast.error("Enter a listing match keyword.");
        return;
      }
    } else if (selectedTheatres.length === 0) {
      toast.error("Select at least one theatre before saving.");
      return;
    }

    const formattedDate = targetDate.replaceAll("-", ""); // YYYY-MM-DD -> YYYYMMDD
    const targetTheatres =
      theatreMode === "custom"
        ? [
          {
            theatreCode: customTheatreCode.trim().toUpperCase(),
            theatreName: customTheatreName.trim(),
            matchKeyword: customMatchKeyword.trim(),
          },
        ]
        : selectedTheatres;

    const res = await fetch("/api/trackers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        movieTitle,
        movieCode,
        movieSlug: movieSlug || movieTitle.toLowerCase().replace(/\s+/g, "-"),
        citySlug: theatreMode === "custom" ? customCitySlug.trim().toLowerCase() : "kochi",
        cityCode: theatreMode === "custom" ? customCitySlug.trim().toUpperCase() : "KOCH",
        targetDate: formattedDate,
        targetTheatres,
        notifyTelegram,
        notifyEmail,
      }),
    });

    if (res.ok) {
      setBmsInput("");
      setMovieTitle("");
      setMovieCode("");
      setMovieSlug("");
      setTargetDate("");
      setTheatreMode("presets");
      setCustomCitySlug("");
      setCustomTheatreCode("");
      setCustomTheatreName("");
      setCustomMatchKeyword("");
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
    <main className="app-shell">
      <div className="app-container">
        <header className="topbar">
          <div className="brand">
            <Image src="/logo.png" alt="BMS Spy logo" width={612} height={408} className="brand-logo" priority />
            <span>BMS Tracker</span>
          </div>
          <button className="alerts-button" onClick={() => setDrawerOpen(true)}>
            <Bell size={16} />
            <span>Alerts</span>
            <span className="alert-count">{allLogs.length}</span>
          </button>
        </header>

        <section className="intro">
          <h1>Your movie watchlist</h1>
          <p>You&apos;ll be notified when the movie becomes available.</p>
        </section>

        <section className="add-section" aria-labelledby="add-heading">
          <h2 id="add-heading">Add a movie</h2>
          <div className={`composer ${composerExpanded ? "composer-open" : ""}`}>
            <div className="composer-bar">
              <input
                type="text"
                value={bmsInput}
                onFocus={() => setComposerExpanded(true)}
                onChange={(e) => handleUrlPasteOrChange(e.target.value)}
                aria-label="BookMyShow movie URL or movie title"
                placeholder="Paste a BookMyShow link or type a movie title..."
              />
              {composerExpanded ? (
                <button className="icon-button" aria-label="Close movie details" onClick={() => setComposerExpanded(false)}>
                  <X size={17} />
                </button>
              ) : (
                <button className="add-button" onClick={() => setComposerExpanded(true)}>Add</button>
              )}
            </div>

            {composerExpanded && (
              <form onSubmit={handleCreateTracker} className="composer-form" noValidate>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="movie-title">Movie title</label>
                    <input id="movie-title" type="text" required value={movieTitle} onChange={(e) => setMovieTitle(e.target.value)} placeholder="e.g. L2: Empuraan" />
                  </div>
                  <div className="field">
                    <label htmlFor="movie-code">BMS event code</label>
                    <input id="movie-code" type="text" required value={movieCode} onChange={(e) => setMovieCode(e.target.value.toUpperCase())} placeholder="ET00384234" />
                  </div>
                  <div className="field">
                    <label htmlFor="target-date">Show date</label>
                    <input id="target-date" type="date" required value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
                  </div>
                </div>

                <div className="form-block">
                  <span className="form-label">Theatres</span>
                  <div className="mode-tabs">
                    <button type="button" onClick={() => setTheatreMode("presets")} aria-pressed={theatreMode === "presets"} className={theatreMode === "presets" ? "mode-tab active" : "mode-tab"}>Kochi</button>
                    <button type="button" onClick={() => setTheatreMode("custom")} aria-pressed={theatreMode === "custom"} className={theatreMode === "custom" ? "mode-tab active" : "mode-tab"}>Another city</button>
                  </div>
                </div>

                {theatreMode === "presets" ? (
                  <fieldset className="theatre-options">
                    <legend>Choose the theatres to watch</legend>
                    {KOCHI_THEATRE_PRESETS.map((preset) => {
                      const active = selectedTheatres.some((t) => t.theatreCode === preset.theatreCode);
                      return (
                        <button type="button" key={preset.theatreCode} title={preset.theatreName} onClick={() => togglePresetTheatre(preset)} className={active ? "theatre-chip selected" : "theatre-chip"} aria-pressed={active}>
                          {active && <CheckCircle2 size={14} />}
                          <span>{preset.theatreName}</span>
                        </button>
                      );
                    })}
                  </fieldset>
                ) : (
                  <div className="custom-fields">
                    <div className="form-grid custom-grid">
                      <div className="field"><label htmlFor="custom-city">City</label><input id="custom-city" type="text" required value={customCitySlug} onChange={(e) => setCustomCitySlug(e.target.value)} placeholder="e.g. Bangalore" /></div>
                      <div className="field"><label htmlFor="custom-theatre-code">Theatre code</label><input id="custom-theatre-code" type="text" required value={customTheatreCode} onChange={(e) => setCustomTheatreCode(e.target.value)} placeholder="e.g. PVRM" /></div>
                      <div className="field"><label htmlFor="custom-theatre-name">Theatre name</label><input id="custom-theatre-name" type="text" required value={customTheatreName} onChange={(e) => setCustomTheatreName(e.target.value)} placeholder="e.g. PVR: Lulu Mall" /></div>
                      <div className="field"><label htmlFor="custom-match-keyword">Listing match keyword</label><input id="custom-match-keyword" type="text" required value={customMatchKeyword} onChange={(e) => setCustomMatchKeyword(e.target.value)} placeholder="Text in the theatre listing" /></div>
                    </div>
                  </div>
                )}

                <div className="form-footer">
                  <div className="notification-options">
                    <label className="check-option"><input type="checkbox" checked={notifyTelegram} onChange={(e) => setNotifyTelegram(e.target.checked)} /><Send size={14} /> Telegram</label>
                    <label className="check-option"><input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} /><Mail size={14} /> Email</label>
                  </div>
                  <button type="submit" className="save-button">Save movie</button>
                </div>
              </form>
            )}
          </div>
        </section>

        <section className="watchlist-section" aria-labelledby="watchlist-heading">
          <div className="watchlist-heading">
            <h2 id="watchlist-heading">Watching <span>{trackers.length}</span></h2>
            <p><span className="poll-dot" /> Updates every 2 minutes</p>
          </div>

          {loading ? (
            <div className="empty-state">Loading your watchlist…</div>
          ) : trackers.length === 0 ? (
            <div className="empty-state">No movies yet. Add one above to get started.</div>
          ) : (
            <div className="watchlist">
              {trackers.map((tracker) => {
                const formattedDate = `${tracker.targetDate.slice(6, 8)}/${tracker.targetDate.slice(4, 6)}/${tracker.targetDate.slice(0, 4)}`;
                const bmsUrl = `https://in.bookmyshow.com/buytickets/${tracker.movieSlug}-${tracker.citySlug}/movie-${tracker.cityCode.toLowerCase()}-${tracker.movieCode}-MT/${tracker.targetDate}`;
                return (
                  <article key={tracker._id} className="watch-row">
                    <div className="movie-info">
                      <div className="movie-heading">
                        <span className={`status-dot ${tracker.status === "paused" ? "paused" : tracker.cityBookingOpen ? "open" : ""}`} />
                        <h3>{tracker.movieTitle}</h3>
                        <span className="movie-code">{tracker.movieCode}</span>
                      </div>
                      <div className="movie-meta">
                        <span><Calendar size={14} /> {formattedDate}</span>
                        <span><MapPin size={14} /> {tracker.citySlug}</span>
                        <span className={tracker.cityBookingOpen ? "booking-status open-status" : "booking-status"}>
                          {tracker.cityBookingOpen ? "Tickets open" : tracker.status === "paused" ? "Paused" : "Waiting"}
                        </span>
                      </div>
                    </div>

                    <div className="theatre-list">
                      {tracker.targetTheatres.map((theatre, idx) => (
                        <a key={idx} href={bmsUrl} target="_blank" rel="noreferrer" className={theatre.isNotified ? "theatre-link theatre-open" : "theatre-link"}>
                          {theatre.isNotified ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                          <span>{theatre.theatreName}</span>
                          {theatre.showtimes?.length > 0 && <span className="show-count">{theatre.showtimes.length} shows</span>}
                        </a>
                      ))}
                    </div>

                    <div className="row-actions">
                      <a href={bmsUrl} target="_blank" rel="noreferrer" title="Open BookMyShow" aria-label={`Open BookMyShow for ${tracker.movieTitle}`} className="icon-button"><ExternalLink size={16} /></a>
                      <button onClick={() => handleTogglePause(tracker)} title={tracker.status === "paused" ? "Resume watching" : "Pause watching"} aria-label={tracker.status === "paused" ? "Resume watching" : "Pause watching"} className="icon-button">
                        {tracker.status === "paused" ? <Play size={16} /> : <Pause size={16} />}
                      </button>
                      <button onClick={() => handleDelete(tracker._id)} title="Remove from watchlist" aria-label={`Remove ${tracker.movieTitle}`} className="icon-button remove-button"><Trash2 size={16} /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {drawerOpen && (
        <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <aside className="alert-drawer" onClick={(e) => e.stopPropagation()} aria-label="Alert history" role="dialog" aria-modal="true">
            <div className="drawer-heading">
              <div><h2>Alert history</h2><p>Recent booking notifications</p></div>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close alert history" className="icon-button"><X size={18} /></button>
            </div>
            {allLogs.length === 0 ? (
              <div className="drawer-empty">No alerts yet.</div>
            ) : (
              <div className="alert-list">
                {allLogs.map((log, index) => (
                  <article key={`${log.timestamp}-${index}`} className="alert-item">
                    <time>{new Date(log.timestamp).toLocaleString()}</time>
                    <h3>{log.movieTitle}</h3>
                    <p>{log.message}</p>
                    {log.bookingUrl && <a href={log.bookingUrl} target="_blank" rel="noreferrer">Open booking page <ExternalLink size={14} /></a>}
                  </article>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
      <Toaster position="bottom-right"  theme="dark"/>
    </main>
  );
}   
import { useState, useEffect, useRef, useCallback } from "react";
import { detectStreamType } from "../BellaTV";

const ICONS = {
  play:  "M5 3l14 9-14 9V3z",
  pause: "M6 4h4v16H6zM14 4h4v16h-4z",
  vol:   "M11 5L6 9H2v6h4l5 4V5z M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07",
  full:  "M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3",
  x:     "M18 6L6 18M6 6l12 12",
};
const Icon = ({ name, size = 22, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={ICONS[name]} />
  </svg>
);

const StreamBadge = ({ type }) => {
  const cfg = {
    dash:   { label: "MPD",    color: "#A78BFA" },
    hls:    { label: "M3U",    color: "#34D399" },
    mp4:    { label: "MP4",    color: "#60A5FA" },
    magnet: { label: "MAGNET", color: "#F97316" },
  }[type] || { label: type?.toUpperCase() || "?", color: "#888" };
  return (
    <span style={{
      background: cfg.color + "22", color: cfg.color,
      border: `1px solid ${cfg.color}55`, borderRadius: 4,
      fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: "2px 8px",
    }}>
      {cfg.label}
    </span>
  );
};

export default function Player({ channel, onClose, accent }) {
  const videoRef   = useRef(null);
  const hlsRef     = useRef(null);
  const dashRef    = useRef(null);
  const timerRef   = useRef(null);
  const [playing, setPlaying]       = useState(false);
  const [status, setStatus]         = useState("Cargando...");
  const [vol, setVol]               = useState(1);
  const [showCtrl, setShowCtrl]     = useState(true);
  const [progress, setProgress]     = useState(0);
  const [duration, setDuration]     = useState(0);

  const hideCtrl = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowCtrl(false), 3500);
  }, []);

  const showCtrlTemp = () => {
    setShowCtrl(true);
    hideCtrl();
  };

  // ── Carga y destrucción del stream ──────────────────────────────────────────
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !channel?.url) { setStatus("Sin URL de stream"); return; }

    setStatus("Iniciando...");
    setPlaying(false);
    setProgress(0);

    const cleanup = () => {
      if (hlsRef.current)  { hlsRef.current.destroy(); hlsRef.current = null; }
      if (dashRef.current) { try { dashRef.current.reset(); } catch {} dashRef.current = null; }
      vid.src = "";
    };
    cleanup();

    const type = channel.streamType || detectStreamType(channel.url);

    const initHLS = (Hls) => {
      if (vid.canPlayType("application/vnd.apple.mpegurl")) {
        vid.src = channel.url;
        vid.play().catch(() => setStatus("Error HLS nativo"));
      } else if (Hls.isSupported()) {
        const hls = new Hls({ debug: false, enableWorker: true });
        hls.loadSource(channel.url);
        hls.attachMedia(vid);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          vid.play().then(() => { setStatus(""); setPlaying(true); }).catch(() => setStatus("Autoplay bloqueado — pulsa ▶"));
        });
        hls.on(Hls.Events.ERROR, (_, d) => {
          if (d.fatal) setStatus("Error HLS: " + d.details);
        });
        hlsRef.current = hls;
      } else {
        setStatus("HLS no soportado en este navegador");
      }
    };

    const initDASH = (dashjs) => {
      const player = dashjs.MediaPlayer().create();
      player.initialize(vid, channel.url, true);
      player.on("playbackError", (e) => setStatus("Error MPD: " + (e.error?.message || "desconocido")));
      player.on("playbackStarted", () => { setStatus(""); setPlaying(true); });
      dashRef.current = player;
    };

    const loadScript = (src, cb) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) { cb(); return; }
      const s = document.createElement("script");
      s.src = src; s.onload = cb;
      document.head.appendChild(s);
    };

    if (type === "dash") {
      if (window.dashjs) initDASH(window.dashjs);
      else loadScript("https://cdnjs.cloudflare.com/ajax/libs/dashjs/4.7.4/dash.all.min.js",
        () => initDASH(window.dashjs));
    } else if (type === "hls") {
      if (window.Hls) initHLS(window.Hls);
      else loadScript("https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.13/hls.min.js",
        () => initHLS(window.Hls));
    } else if (type === "mp4" || type === "unknown") {
      vid.src = channel.url;
      vid.play().catch(() => setStatus("Pulsa ▶ para reproducir"));
    } else if (type === "magnet") {
      setStatus("Stream magnet — requiere Real-Debrid para reproducirse directamente");
    }

    vid.onplaying  = () => { setStatus(""); setPlaying(true); };
    vid.onpause    = () => setPlaying(false);
    vid.onerror    = () => setStatus("Error al cargar el stream");
    vid.ontimeupdate = () => { setProgress(vid.currentTime); setDuration(vid.duration || 0); };

    hideCtrl();
    return () => { cleanup(); clearTimeout(timerRef.current); };
  }, [channel]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  };

  const seek = (e) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    v.currentTime = ratio * duration;
  };

  const fmt = (s) => {
    if (!s || isNaN(s)) return "--:--";
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Teclado
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" || e.key === "Backspace") { e.preventDefault(); onClose(); }
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); togglePlay(); }
      if (e.key === "ArrowRight" && videoRef.current) videoRef.current.currentTime += 10;
      if (e.key === "ArrowLeft"  && videoRef.current) videoRef.current.currentTime -= 10;
      if (e.key === "ArrowUp")   setVol(v => { const nv = Math.min(1, v + 0.1); if (videoRef.current) videoRef.current.volume = nv; return nv; });
      if (e.key === "ArrowDown") setVol(v => { const nv = Math.max(0, v - 0.1); if (videoRef.current) videoRef.current.volume = nv; return nv; });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 200, display: "flex", flexDirection: "column" }}
      onMouseMove={showCtrlTemp} onClick={showCtrlTemp}>

      <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "contain", cursor: "pointer" }}
        onClick={togglePlay} />

      {/* STATUS OVERLAY */}
      {status && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "#fff", fontSize: 16, background: "rgba(0,0,0,.75)", padding: "14px 28px", borderRadius: 10, textAlign: "center" }}>
          {status}
        </div>
      )}

      {/* TOP BAR */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        background: "linear-gradient(rgba(0,0,0,.8),transparent)",
        padding: "20px 28px 40px",
        opacity: showCtrl ? 1 : 0, transition: "opacity .3s",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        {channel?.logo && <img src={channel.logo} style={{ height: 30, objectFit: "contain" }} alt="" />}
        <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 22, color: "#fff", letterSpacing: 2 }}>{channel?.name}</span>
        <StreamBadge type={channel?.streamType} />
        <button onClick={onClose} style={{ marginLeft: "auto", background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <Icon name="x" size={16} /> Cerrar
        </button>
      </div>

      {/* BOTTOM CONTROLS */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "linear-gradient(transparent, rgba(0,0,0,.9))",
        padding: "40px 28px 24px",
        opacity: showCtrl ? 1 : 0, transition: "opacity .3s",
      }}>
        {/* PROGRESS BAR (solo VOD) */}
        {duration > 0 && (
          <div onClick={seek} style={{ height: 4, background: "rgba(255,255,255,.2)", borderRadius: 2, cursor: "pointer", marginBottom: 16, position: "relative" }}>
            <div style={{ height: "100%", width: `${(progress / duration) * 100}%`, background: accent, borderRadius: 2 }} />
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* PLAY / PAUSE */}
          <button onClick={togglePlay} style={{ width: 50, height: 50, borderRadius: "50%", background: accent, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name={playing ? "pause" : "play"} size={22} color="#000" />
          </button>

          {/* TIEMPO */}
          {duration > 0 && (
            <span style={{ fontSize: 13, color: "#aaa", whiteSpace: "nowrap" }}>{fmt(progress)} / {fmt(duration)}</span>
          )}

          <div style={{ flex: 1 }} />

          {/* VOLUMEN */}
          <Icon name="vol" size={18} color="#aaa" />
          <input type="range" min={0} max={1} step={0.05} value={vol}
            onChange={e => { const v = +e.target.value; setVol(v); if (videoRef.current) videoRef.current.volume = v; }}
            style={{ width: 90, accentColor: accent }} />

          {/* FULLSCREEN */}
          <button onClick={() => document.fullscreenElement ? document.exitFullscreen() : videoRef.current?.requestFullscreen?.()}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa" }}>
            <Icon name="full" size={20} color="#aaa" />
          </button>
        </div>

        <div style={{ marginTop: 8, fontSize: 11, color: "#555" }}>
          ← → ±10s · Espacio = Play/Pause · ↑↓ Volumen · ESC Cerrar
        </div>
      </div>
    </div>
  );
}

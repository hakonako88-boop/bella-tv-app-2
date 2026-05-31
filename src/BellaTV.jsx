import { useState, useEffect, useRef, useCallback } from "react";
import StremioManager from "./components/StremioManager";
import ImportModal    from "./components/ImportModal";
import Player         from "./components/Player";

// ─── UTILS ────────────────────────────────────────────────────────────────────
export function detectStreamType(url) {
  if (!url) return "unknown";
  const u = url.toLowerCase().split("?")[0];
  if (u.endsWith(".mpd"))  return "dash";
  if (u.endsWith(".m3u8") || u.endsWith(".m3u") || u.endsWith(".ts")) return "hls";
  if (u.endsWith(".mp4") || u.endsWith(".mkv") || u.endsWith(".avi")) return "mp4";
  if (u.includes("/dash/") || u.includes("manifest.mpd")) return "dash";
  if (u.includes(".m3u8") || u.includes("hls")) return "hls";
  if (u.startsWith("magnet:")) return "magnet";
  return "hls";
}

export function parseM3U(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const channels = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith("#EXTM3U")) continue;
    if (line.startsWith("#EXTINF:")) {
      const attrStr = line.slice(8);
      const getAttr = (key) => { const m = attrStr.match(new RegExp(`${key}="([^"]*)"`, "i")); return m ? m[1] : ""; };
      const commaIdx = attrStr.lastIndexOf(",");
      current = {
        id: `ch_${Date.now()}_${Math.random()}`,
        name:  getAttr("tvg-name") || (commaIdx !== -1 ? attrStr.slice(commaIdx + 1).trim() : "Canal"),
        logo:  getAttr("tvg-logo"),
        group: getAttr("group-title") || "Sin grupo",
        epgId: getAttr("tvg-id"),
        url: "", type: "live",
      };
      continue;
    }
    if (line.startsWith("#")) continue;
    if (line.length > 0) {
      const ch = current || { id: `ch_${Date.now()}_${Math.random()}`, name: line.split("/").pop().split("?")[0] || "Canal", logo: "", group: "Sin grupo", type: "live" };
      ch.url = line;
      ch.streamType = detectStreamType(line);
      channels.push(ch);
      current = null;
    }
  }
  return channels;
}

export async function fetchM3U(url) {
  try {
    const r = await fetch(url);
    if (r.ok) return r.text();
  } catch {}
  const r2 = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
  return r2.text();
}

// ─── STREMIO ADDON ENGINE ─────────────────────────────────────────────────────
// Stremio addons exponen una API REST JSON:
//   GET {baseUrl}/manifest.json          → info del addon
//   GET {baseUrl}/catalog/{type}/{id}.json → lista de contenidos
//   GET {baseUrl}/stream/{type}/{id}.json  → streams de un contenido
//   GET {baseUrl}/meta/{type}/{id}.json    → metadatos

export async function fetchAddonManifest(baseUrl) {
  const url = baseUrl.replace(/\/$/, "") + "/manifest.json";
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();  // { id, name, version, description, resources, types, catalogs, ... }
}

export async function fetchAddonCatalog(baseUrl, type, catalogId, extra = {}) {
  const base = baseUrl.replace(/\/$/, "");
  let extraStr = "";
  if (Object.keys(extra).length) {
    extraStr = "/" + Object.entries(extra).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  }
  const url = `${base}/catalog/${type}/${catalogId}${extraStr}.json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return data.metas || [];  // array de { id, type, name, poster, background, description, ... }
}

export async function fetchAddonStreams(baseUrl, type, id) {
  const base = baseUrl.replace(/\/$/, "");
  const url = `${base}/stream/${type}/${id}.json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return data.streams || [];  // array de { url, title, infoHash, fileIdx, ... }
}

export async function fetchAddonMeta(baseUrl, type, id) {
  const base = baseUrl.replace(/\/$/, "");
  const url = `${base}/meta/${type}/${id}.json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return data.meta || null;
}

// Addons públicos por defecto
export const DEFAULT_ADDONS = [
  { id: "com.linvo.cinemeta",   name: "Cinemeta",   url: "https://v3-cinemeta.strem.io",      logo: "🎬", types: ["movie","series"], enabled: true },
  { id: "com.stremio.torrentio", name: "Torrentio",  url: "https://torrentio.strem.fun",       logo: "⚡", types: ["movie","series"], enabled: true },
  { id: "community.peerflix",   name: "Peerflix",   url: "https://peerflix-addon.herokuapp.com", logo: "🌊", types: ["movie","series"], enabled: true },
  { id: "org.stremio.opensubtitles", name: "OpenSubtitles", url: "https://opensubtitles-v3.strem.io", logo: "💬", types: ["movie","series"], enabled: false },
];

// ─── DATOS DEMO ───────────────────────────────────────────────────────────────
const MOVIES_DEMO = [
  { id: "tt1877830", title: "The Batman",          year: 2022, rating: 7.8, genre: "Acción",   poster: "https://image.tmdb.org/t/p/w300/74xTEgt7R36Fpooo50r9T25onhq.jpg", backdrop: "https://image.tmdb.org/t/p/w1280/b0PlSFdDwbyK0cf5RxwDpaOJQvQ.jpg", desc: "Bruce Wayne investiga la corrupción en Gotham.", platform: "HBO",         runtime: "2h 56m" },
  { id: "tt9362722", title: "Spider-Man: No Way Home", year: 2021, rating: 8.2, genre: "Acción", poster: "https://image.tmdb.org/t/p/w300/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg", backdrop: "https://image.tmdb.org/t/p/w1280/iQFcwSGbZXMkeyKrxbPnwnRo5fl.jpg", desc: "Peter Parker pide a Doctor Strange que haga que el mundo olvide que él es Spider-Man.", platform: "Netflix",     runtime: "2h 28m" },
  { id: "tt15398776", title: "Oppenheimer",         year: 2023, rating: 8.3, genre: "Drama",    poster: "https://image.tmdb.org/t/p/w300/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", backdrop: "https://image.tmdb.org/t/p/w1280/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg", desc: "La historia del físico J. Robert Oppenheimer y el desarrollo de la bomba atómica.", platform: "Prime Video", runtime: "3h 0m" },
  { id: "tt6791350", title: "Guardianes Vol. 3",    year: 2023, rating: 8.0, genre: "Aventura", poster: "https://image.tmdb.org/t/p/w300/r2J02Z2OpNTctfOSN1Ydgd2YYev.jpg", backdrop: "https://image.tmdb.org/t/p/w1280/5YZbUmjbMa3ClvSW1Wj3D6XGkVA.jpg", desc: "Los Guardianes protegen a Rocket de su oscuro pasado.", platform: "Disney+",     runtime: "2h 30m" },
  { id: "tt1462764", title: "Barbie",               year: 2023, rating: 6.9, genre: "Comedia",  poster: "https://image.tmdb.org/t/p/w300/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg", backdrop: "https://image.tmdb.org/t/p/w1280/ctMserH8g2SeOAnCw5gFjdQF8mo.jpg", desc: "Barbie y Ken viajan al mundo real.",                   platform: "HBO",         runtime: "1h 54m" },
];
const SERIES_DEMO = [
  { id: "tt2442560", title: "Peaky Blinders", year: 2013, rating: 8.8, genre: "Drama",   poster: "https://image.tmdb.org/t/p/w300/vUUqzWa2LnHIVqkaKVlVGkPaQca.jpg", desc: "Gánsteres en Birmingham post-WWI.", platform: "Netflix", seasons: 6 },
  { id: "tt0944947", title: "Game of Thrones", year: 2011, rating: 9.2, genre: "Fantasía", poster: "https://image.tmdb.org/t/p/w300/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg", desc: "La lucha por el Trono de Hierro.", platform: "HBO",     seasons: 8 },
  { id: "tt5180504", title: "The Witcher",     year: 2019, rating: 8.2, genre: "Fantasía", poster: "https://image.tmdb.org/t/p/w300/cZ0d3rtvXPVvuiX22sP79K3Hmjz.jpg", desc: "El brujo Geralt en un mundo peligroso.", platform: "Netflix", seasons: 3 },
];

const ACCENT_COLORS = [
  "#F472B6","#A78BFA","#F59E0B","#3B82F6","#10B981","#EF4444","#06B6D4","#F97316",
];
const PLATFORM_COLORS = { "Netflix":"#E50914","HBO":"#B10DC9","Disney+":"#0063E5","Prime Video":"#00A8E1","BBC":"#C00000" };

// ─── ICONS ────────────────────────────────────────────────────────────────────
const ICONS = {
  home:"M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  tv:"M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z",
  film:"M19.82 2H4.18C2.97 2 2 2.97 2 4.18v15.64C2 21.03 2.97 22 4.18 22h15.64C21.03 22 22 21.03 22 19.82V4.18C22 2.97 21.03 2 19.82 2zM5 19V9h14v10H5z",
  series:"M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z",
  puzzle:"M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z",
  list:"M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  settings:"M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  play:"M5 3l14 9-14 9V3z",
  pause:"M6 4h4v16H6zM14 4h4v16h-4z",
  star:"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  upload:"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
  x:"M18 6L6 18M6 6l12 12",
  check:"M20 6L9 17l-5-5",
  search:"M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  info:"M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8h.01M11 12h1v4h1",
  chevronRight:"M9 18l6-6-6-6",
  plus:"M12 5v14M5 12h14",
  trash:"M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  refresh:"M23 4v6h-6M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  volume:"M11 5L6 9H2v6h4l5 4V5z M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07",
};
const Icon = ({ name, size = 24, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={ICONS[name] || ""} />
  </svg>
);

const StreamBadge = ({ type }) => {
  const cfg = { dash:{label:"MPD",color:"#A78BFA"}, hls:{label:"M3U",color:"#34D399"}, mp4:{label:"MP4",color:"#60A5FA"}, magnet:{label:"MAGNET",color:"#F97316"} }[type] || {label:type?.toUpperCase()||"?",color:"#888"};
  return <span style={{ background:cfg.color+"22", color:cfg.color, border:`1px solid ${cfg.color}44`, borderRadius:4, fontSize:10, fontWeight:700, letterSpacing:1, padding:"2px 7px" }}>{cfg.label}</span>;
};

// ─── MEDIA CARD ───────────────────────────────────────────────────────────────
function MediaCard({ item, onClick, accent }) {
  const [focused, setFocused] = useState(false);
  // Normalizar campos de Stremio (poster/name) vs demo (poster/title)
  const title   = item.name || item.title || "Sin título";
  const poster  = item.poster || "";
  const year    = item.year || item.releaseInfo || "";
  const rating  = item.imdbRating || item.rating || "";
  const genre   = item.genre || (item.genres && item.genres[0]) || "";
  const platform = item.platform || "";

  return (
    <div tabIndex={0} style={{ flexShrink:0, width:160, cursor:"pointer", borderRadius:10, overflow:"hidden", transition:"transform .2s, box-shadow .2s", transform:focused?"scale(1.07)":"scale(1)", boxShadow:focused?`0 0 0 2px ${accent}, 0 8px 24px rgba(0,0,0,.6)`:"none", outline:"none", background:"#10101a" }}
      onClick={() => onClick(item)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      onKeyDown={e => e.key === "Enter" && onClick(item)}>
      <div style={{ position:"relative", width:"100%", aspectRatio:"2/3", background:"#1a1a2e" }}>
        {poster
          ? <img src={poster} alt={title} style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e => { e.target.src=`https://placehold.co/200x300/1a1a2e/fff?text=${encodeURIComponent(title)}`; }} />
          : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:40 }}>🎬</div>
        }
        {focused && <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"center", justifyContent:"center" }}><div style={{ width:52, height:52, borderRadius:"50%", background:accent, display:"flex", alignItems:"center", justifyContent:"center" }}><Icon name="play" size={24} color="#000" /></div></div>}
        {platform && <div style={{ position:"absolute", top:8, left:8, background:PLATFORM_COLORS[platform]||"#333", padding:"2px 7px", borderRadius:4, fontSize:9, fontWeight:700, letterSpacing:1 }}>{platform}</div>}
        {rating && <div style={{ position:"absolute", bottom:8, right:8, background:"rgba(0,0,0,.75)", borderRadius:4, padding:"2px 6px", display:"flex", alignItems:"center", gap:3, fontSize:11 }}><Icon name="star" size={10} color="#F59E0B" />{rating}</div>}
      </div>
      <div style={{ padding:"10px" }}>
        <div style={{ fontSize:13, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{title}</div>
        <div style={{ fontSize:11, color:"#666", marginTop:2 }}>{[year, genre].filter(Boolean).join(" · ")}</div>
      </div>
    </div>
  );
}

// ─── STREMIO CATALOG PAGE ─────────────────────────────────────────────────────
function StremioCatalogPage({ addons, accent, onSelect }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [activeAddon, setActiveAddon] = useState(null);
  const [activeCatalog, setActiveCatalog] = useState(null);
  const [search, setSearch]   = useState("");

  const enabledAddons = addons.filter(a => a.enabled);

  const loadCatalog = async (addon, catalog) => {
    setLoading(true); setError(""); setResults([]);
    setActiveAddon(addon); setActiveCatalog(catalog);
    try {
      const extra = search ? { search } : {};
      const metas = await fetchAddonCatalog(addon.url, catalog.type, catalog.id, extra);
      setResults(metas);
    } catch (e) { setError("Error cargando catálogo: " + e.message); }
    finally { setLoading(false); }
  };

  // Cargar catálogo inicial si hay addons
  useEffect(() => {
    if (enabledAddons.length > 0 && enabledAddons[0].manifest?.catalogs?.length > 0) {
      loadCatalog(enabledAddons[0], enabledAddons[0].manifest.catalogs[0]);
    }
  }, [addons]);

  return (
    <div style={{ padding:"32px 40px" }}>
      <h2 style={{ fontFamily:"'Bebas Neue',cursive", fontSize:30, letterSpacing:2, color:accent, marginBottom:8 }}>Addons Stremio</h2>

      {enabledAddons.length === 0 ? (
        <div style={{ padding:60, textAlign:"center", border:`1px dashed ${accent}44`, borderRadius:16 }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🧩</div>
          <div style={{ fontSize:18, color:"#ccc", marginBottom:8 }}>Sin addons activos</div>
          <div style={{ fontSize:14, color:"#555" }}>Activa addons en Ajustes → Addons Stremio</div>
        </div>
      ) : (
        <>
          {/* SELECTOR ADDON / CATÁLOGO */}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
            {enabledAddons.map(addon => (
              addon.manifest?.catalogs?.map(cat => (
                <button key={`${addon.id}_${cat.id}_${cat.type}`}
                  onClick={() => loadCatalog(addon, cat)}
                  style={{ padding:"8px 14px", borderRadius:20, fontSize:12, cursor:"pointer", border:`1px solid ${activeAddon?.id===addon.id && activeCatalog?.id===cat.id ? accent : "#333"}`, background: activeAddon?.id===addon.id && activeCatalog?.id===cat.id ? accent+"22" : "transparent", color: activeAddon?.id===addon.id && activeCatalog?.id===cat.id ? accent : "#888", transition:"all .2s" }}>
                  {addon.logo} {cat.name || cat.id} · {cat.type}
                </button>
              )) || []
            ))}
          </div>

          {/* BUSCADOR */}
          <div style={{ display:"flex", gap:10, marginBottom:24 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, background:"#1a1a2e", border:"1px solid #2a2a3e", borderRadius:8, padding:"8px 14px", flex:1, maxWidth:360 }}>
              <Icon name="search" size={16} color="#888" />
              <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key==="Enter" && activeAddon && activeCatalog) loadCatalog(activeAddon, activeCatalog); }}
                placeholder="Buscar en el addon... (Enter)" style={{ background:"none", border:"none", outline:"none", color:"#e0e0e0", fontSize:14, flex:1 }} />
            </div>
            {activeAddon && activeCatalog && (
              <button onClick={() => loadCatalog(activeAddon, activeCatalog)} style={{ padding:"8px 16px", borderRadius:8, background:accent+"22", border:`1px solid ${accent}`, color:accent, fontSize:13, cursor:"pointer" }}>
                <Icon name="refresh" size={14} color={accent} />
              </button>
            )}
          </div>

          {loading && <div style={{ textAlign:"center", padding:60, color:"#888", fontSize:16 }}>Cargando desde addon...</div>}
          {error   && <div style={{ padding:"14px 20px", borderRadius:8, background:"#ff444422", border:"1px solid #ff4444", color:"#ff8888", marginBottom:20 }}>⚠ {error}</div>}

          {!loading && results.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px,1fr))", gap:20 }}>
              {results.map(item => (
                <MediaCard key={item.id} item={item} onClick={onSelect} accent={accent} />
              ))}
            </div>
          )}

          {!loading && !error && results.length === 0 && activeAddon && (
            <div style={{ textAlign:"center", padding:40, color:"#555" }}>Sin resultados</div>
          )}
        </>
      )}
    </div>
  );
}

// ─── DETAIL MODAL con streams Stremio ─────────────────────────────────────────
function DetailModal({ item, addons, accent, onClose, onPlay }) {
  const [streams, setStreams]   = useState([]);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [tab, setTab]           = useState("info");

  const title = item.name || item.title;
  const poster = item.poster || "";
  const backdrop = item.background || item.backdrop || poster;

  useEffect(() => {
    const handler = e => { if (e.key === "Escape" || e.key === "Backspace") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const loadStreams = async () => {
    setTab("streams"); setLoadingStreams(true); setStreams([]);
    const type = item.type || (item.seasons ? "series" : "movie");
    const id   = item.id || item.imdb_id;
    const all  = [];
    for (const addon of addons.filter(a => a.enabled)) {
      try {
        const s = await fetchAddonStreams(addon.url, type, id);
        all.push(...s.map(st => ({ ...st, addonName: addon.name, addonLogo: addon.logo })));
      } catch {}
    }
    setStreams(all);
    setLoadingStreams(false);
  };

  const playStream = (stream) => {
    const url = stream.url || (stream.infoHash ? `magnet:?xt=urn:btih:${stream.infoHash}` : null);
    if (!url) return;
    onPlay({ name: stream.title || title, url, streamType: detectStreamType(url), logo: "" });
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, background:"rgba(0,0,0,.88)", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(10px)" }} onClick={onClose}>
      <div style={{ position:"relative", width:"92%", maxWidth:940, maxHeight:"90vh", borderRadius:16, overflow:"hidden", background:"#10101a", border:`1px solid #2a2a3e` }} onClick={e => e.stopPropagation()}>
        {backdrop && <div style={{ position:"absolute", inset:0, backgroundImage:`url(${backdrop})`, backgroundSize:"cover", backgroundPosition:"center", opacity:.12 }} />}
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to right,#10101a 40%,transparent)" }} />

        <div style={{ position:"relative", zIndex:1, display:"flex", gap:32, padding:40, maxHeight:"90vh", overflowY:"auto" }}>
          <button onClick={onClose} style={{ position:"absolute", top:16, right:16, background:"none", border:"none", cursor:"pointer", color:"#888", fontSize:22 }}>✕</button>

          {/* POSTER */}
          <div style={{ flexShrink:0 }}>
            {poster
              ? <img src={poster} alt={title} style={{ width:180, borderRadius:10, aspectRatio:"2/3", objectFit:"cover" }} />
              : <div style={{ width:180, aspectRatio:"2/3", background:"#1a1a2e", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:48 }}>🎬</div>
            }
          </div>

          {/* INFO */}
          <div style={{ flex:1, minWidth:0 }}>
            {item.platform && <div style={{ display:"inline-block", background:PLATFORM_COLORS[item.platform]||"#555", padding:"4px 12px", borderRadius:4, fontSize:11, fontWeight:700, letterSpacing:1, marginBottom:12 }}>{item.platform}</div>}
            <h1 style={{ fontFamily:"'Bebas Neue',cursive", fontSize:42, letterSpacing:2, color:"#fff", lineHeight:1, marginBottom:10 }}>{title}</h1>
            <div style={{ display:"flex", gap:12, alignItems:"center", fontSize:14, color:"#aaa", flexWrap:"wrap", marginBottom:14 }}>
              {item.year && <span>{item.year}</span>}
              {(item.imdbRating||item.rating) && <><span style={{color:"#555"}}>·</span><span style={{color:"#F59E0B"}}>★ {item.imdbRating||item.rating}</span></>}
              {(item.genre||(item.genres&&item.genres[0])) && <><span style={{color:"#555"}}>·</span><span>{item.genre||(item.genres&&item.genres[0])}</span></>}
              {item.runtime && <><span style={{color:"#555"}}>·</span><span>{item.runtime}</span></>}
              {item.seasons && <><span style={{color:"#555"}}>·</span><span>{item.seasons} temporadas</span></>}
            </div>
            <p style={{ fontSize:14, lineHeight:1.7, color:"#bbb", marginBottom:20 }}>{item.description || item.desc || ""}</p>

            {/* TABS */}
            <div style={{ display:"flex", gap:8, borderBottom:"1px solid #2a2a3e", marginBottom:20 }}>
              {["info","streams","relacionados"].map(t => (
                <button key={t} onClick={() => { setTab(t); if (t==="streams") loadStreams(); }}
                  style={{ padding:"8px 16px", borderRadius:"6px 6px 0 0", background:"none", border:"none", borderBottom:`2px solid ${tab===t ? accent : "transparent"}`, color:tab===t ? accent : "#666", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all .2s" }}>
                  {t.charAt(0).toUpperCase()+t.slice(1)}
                </button>
              ))}
            </div>

            {tab === "info" && (
              <div>
                {item.cast && <div style={{ fontSize:13, color:"#888", marginBottom:8 }}><strong style={{color:"#aaa"}}>Reparto:</strong> {item.cast.join(", ")}</div>}
                {item.director && <div style={{ fontSize:13, color:"#888" }}><strong style={{color:"#aaa"}}>Director:</strong> {item.director}</div>}
                {!item.cast && <div style={{ color:"#555", fontSize:13 }}>Busca en streams para ver info completa desde los addons.</div>}
              </div>
            )}

            {tab === "streams" && (
              <div>
                {loadingStreams && <div style={{ color:"#888", fontSize:14 }}>Buscando streams en {addons.filter(a=>a.enabled).length} addons...</div>}
                {!loadingStreams && streams.length === 0 && <div style={{ color:"#555", fontSize:14 }}>Sin streams encontrados. Asegúrate de tener addons activos.</div>}
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {streams.map((st, i) => (
                    <button key={i} onClick={() => playStream(st)}
                      style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderRadius:8, background:"#1a1a2e", border:`1px solid #2a2a3e`, color:"#ccc", fontSize:13, cursor:"pointer", textAlign:"left", transition:"all .2s" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor=accent}
                      onMouseLeave={e => e.currentTarget.style.borderColor="#2a2a3e"}>
                      <span style={{ fontSize:16 }}>{st.addonLogo}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, color:"#e0e0e0" }}>{st.title || st.name || "Stream"}</div>
                        <div style={{ fontSize:11, color:"#666", marginTop:2 }}>{st.addonName} · {st.url ? detectStreamType(st.url).toUpperCase() : "MAGNET"}</div>
                      </div>
                      <div style={{ background:accent, borderRadius:20, padding:"4px 12px", fontSize:12, fontWeight:700, color:"#000" }}>▶ Ver</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tab === "relacionados" && (
              <div style={{ color:"#555", fontSize:13 }}>Los títulos relacionados se cargan desde Cinemeta. Actívalo en Ajustes.</div>
            )}

            <div style={{ display:"flex", gap:12, marginTop:24 }}>
              <button onClick={() => { loadStreams(); setTab("streams"); }}
                style={{ display:"flex", alignItems:"center", gap:8, padding:"13px 26px", borderRadius:8, background:accent, color:"#000", border:"none", fontWeight:700, fontSize:15, cursor:"pointer" }}>
                <Icon name="play" size={18} color="#000" /> Ver streams
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function BellaTV() {
  const [page, setPage]           = useState("home");
  const [accent, setAccent]       = useState("#F472B6");
  const [channels, setChannels]   = useState([]);
  const [addons, setAddons]       = useState(DEFAULT_ADDONS);
  const [playingCh, setPlayingCh] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [m3uUrl, setM3uUrl]       = useState("");
  const [epgUrl, setEpgUrl]       = useState("");
  const [debridToken, setDebridToken] = useState("");
  const [tmdbKey, setTmdbKey]     = useState("");

  // Persistencia en localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("bellatv") || "{}");
      if (saved.accent)   setAccent(saved.accent);
      if (saved.channels) setChannels(saved.channels);
      if (saved.addons)   setAddons(saved.addons);
      if (saved.m3uUrl)   setM3uUrl(saved.m3uUrl);
      if (saved.epgUrl)   setEpgUrl(saved.epgUrl);
    } catch {}
  }, []);

  const save = useCallback((patch) => {
    try {
      const prev = JSON.parse(localStorage.getItem("bellatv") || "{}");
      localStorage.setItem("bellatv", JSON.stringify({ ...prev, ...patch }));
    } catch {}
  }, []);

  const setAccentSave = v => { setAccent(v); save({ accent: v }); };
  const handleImport  = useCallback(chs => { setChannels(chs); save({ channels: chs }); setPage("live"); }, []);
  const handleAddons  = useCallback(a   => { setAddons(a);    save({ addons: a }); }, []);

  // Cargar manifiestos de addons habilitados
  useEffect(() => {
    addons.forEach(async (addon, i) => {
      if (!addon.enabled || addon.manifest) return;
      try {
        const manifest = await fetchAddonManifest(addon.url);
        setAddons(prev => {
          const next = [...prev];
          next[i] = { ...next[i], manifest };
          return next;
        });
      } catch {}
    });
  }, [addons.map(a => a.enabled).join(",")]);

  // Font
  useEffect(() => {
    if (!document.getElementById("bella-font")) {
      const l = document.createElement("link");
      l.id = "bella-font"; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600&display=swap";
      document.head.appendChild(l);
    }
  }, []);

  const NAV = [
    { id:"home",    label:"Inicio",        icon:"home" },
    { id:"live",    label:"TV en Vivo",    icon:"tv" },
    { id:"movies",  label:"Películas",     icon:"film" },
    { id:"series",  label:"Series",        icon:"series" },
    { id:"stremio", label:"Addons Stremio",icon:"puzzle" },
    { id:"epg",     label:"Guía EPG",      icon:"list" },
    { id:"settings",label:"Ajustes",       icon:"settings" },
  ];

  const generateEPG = () => {
    const progs = ["Telediario","El Hormiguero","La Ruleta de la Suerte","Noticias 24h","Supervivientes","MasterChef","Cine de acción"];
    const now = new Date(); const r = []; let t = new Date(now); t.setHours(t.getHours()-2,0,0,0);
    for (let i=0;i<7;i++) { const d=[30,60,90,120][i%4]; r.push({id:i,title:progs[i%progs.length],start:new Date(t),end:new Date(t.getTime()+d*60000)}); t=new Date(t.getTime()+d*60000); }
    return r;
  };

  const Section = ({ title, children }) => (
    <div style={{ padding:"0 40px 36px" }}>
      <h2 style={{ fontFamily:"'Bebas Neue',cursive", fontSize:26, letterSpacing:2, color:accent, marginBottom:20 }}>{title}</h2>
      <div style={{ display:"flex", gap:16, overflowX:"auto", paddingBottom:8, scrollbarWidth:"none" }}>{children}</div>
    </div>
  );

  const displayChannels = channels.length > 0 ? channels.slice(0,12) : [];
  const featured = MOVIES_DEMO[0];

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#0a0a0f", color:"#e8e8f0", fontFamily:"'Inter',sans-serif" }}>

      {/* ── SIDEBAR ── */}
      <nav onMouseEnter={() => setSidebarOpen(true)} onMouseLeave={() => setSidebarOpen(false)}
        style={{ width:sidebarOpen?240:72, minHeight:"100vh", background:"#0e0e1a", borderRight:"1px solid #1a1a2e", transition:"width .3s cubic-bezier(.4,0,.2,1)", overflow:"hidden", display:"flex", flexDirection:"column", position:"sticky", top:0, height:"100vh", flexShrink:0, zIndex:20 }}>
        {/* Logo */}
        <div style={{ padding:"22px 18px 18px", borderBottom:"1px solid #1a1a2e", display:"flex", alignItems:"center", gap:12, cursor:"pointer" }} onClick={() => setPage("home")}>
          <div style={{ width:36, height:36, background:`linear-gradient(135deg,${accent},${accent}88)`, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:`0 4px 16px ${accent}44` }}>
            <span style={{ fontFamily:"'Bebas Neue',cursive", fontSize:20, color:"#fff" }}>B</span>
          </div>
          {sidebarOpen && <div><div style={{ fontFamily:"'Bebas Neue',cursive", fontSize:22, color:"#fff", letterSpacing:3, lineHeight:1 }}>BELLA TV</div><div style={{ fontSize:9, color:accent, letterSpacing:3, textTransform:"uppercase", marginTop:2 }}>IPTV · STREMIO</div></div>}
        </div>
        {/* Nav */}
        <div style={{ padding:"12px 0", flex:1 }}>
          {NAV.map(item => (
            <div key={item.id} tabIndex={0} onClick={() => setPage(item.id)} onKeyDown={e => e.key==="Enter" && setPage(item.id)}
              style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 20px", cursor:"pointer", borderLeft:`3px solid ${page===item.id?accent:"transparent"}`, background:page===item.id?accent+"12":"transparent", color:page===item.id?accent:"#555", transition:"all .15s", outline:"none", whiteSpace:"nowrap" }}>
              <Icon name={item.icon} size={21} />
              {sidebarOpen && <span style={{ fontSize:14, fontWeight:500 }}>{item.label}</span>}
              {item.id==="stremio" && sidebarOpen && <span style={{ marginLeft:"auto", background:accent+"22", color:accent, borderRadius:10, fontSize:10, padding:"2px 7px" }}>{addons.filter(a=>a.enabled).length}</span>}
            </div>
          ))}
        </div>
        {/* Importar rápido */}
        {sidebarOpen && (
          <div style={{ padding:"14px 16px", borderTop:"1px solid #1a1a2e" }}>
            <button onClick={() => setShowImport(true)} style={{ width:"100%", padding:"10px 14px", borderRadius:8, background:accent+"22", border:`1px solid ${accent}44`, color:accent, fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:8 }}>
              <Icon name="upload" size={14} color={accent} /> Importar Lista
            </button>
          </div>
        )}
      </nav>

      {/* ── MAIN ── */}
      <main style={{ flex:1, overflowY:"auto", maxHeight:"100vh" }}>

        {/* HOME */}
        {page === "home" && (
          <div>
            <div style={{ position:"relative", height:490, backgroundImage:`url(${featured.backdrop})`, backgroundSize:"cover", backgroundPosition:"center top" }}>
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(to right,#0a0a0f 35%,transparent 70%),linear-gradient(to top,#0a0a0f 15%,transparent 60%)" }} />
              <div style={{ position:"relative", zIndex:1, padding:"70px 60px", maxWidth:560 }}>
                <div style={{ display:"inline-block", background:PLATFORM_COLORS[featured.platform], padding:"4px 12px", borderRadius:4, fontSize:11, fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:16 }}>{featured.platform}</div>
                <h1 style={{ fontFamily:"'Bebas Neue',cursive", fontSize:58, lineHeight:1, color:"#fff", letterSpacing:3, marginBottom:10 }}>{featured.title}</h1>
                <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:14, fontSize:14, color:"#aaa" }}><span style={{color:"#F59E0B"}}>★ {featured.rating}</span><span>·</span><span>{featured.year}</span><span>·</span><span>{featured.genre}</span></div>
                <p style={{ fontSize:15, color:"#bbb", lineHeight:1.6, marginBottom:26 }}>{featured.desc}</p>
                <div style={{ display:"flex", gap:14 }}>
                  <button style={{ display:"flex", alignItems:"center", gap:8, padding:"13px 28px", borderRadius:8, background:accent, color:"#000", border:"none", fontWeight:700, fontSize:15, cursor:"pointer" }}><Icon name="play" size={18} color="#000" /> Reproducir</button>
                  <button onClick={() => setSelectedItem(featured)} style={{ display:"flex", alignItems:"center", gap:8, padding:"13px 28px", borderRadius:8, background:"rgba(255,255,255,.12)", color:"#fff", border:"none", fontWeight:600, fontSize:15, cursor:"pointer" }}><Icon name="info" size={18} /> Más info</button>
                </div>
              </div>
            </div>

            {/* CANALES */}
            {displayChannels.length > 0 ? (
              <Section title={`TV en Vivo · ${channels.length} canales`}>
                {displayChannels.map(ch => (
                  <div key={ch.id} tabIndex={0} style={{ flexShrink:0, width:130, cursor:"pointer", borderRadius:10, overflow:"hidden", background:"#10101a", border:"1px solid #1e1e2e", padding:12, display:"flex", flexDirection:"column", alignItems:"center", gap:8, outline:"none" }} onClick={() => setPlayingCh(ch)}>
                    {ch.logo ? <img src={ch.logo} style={{ width:56, height:36, objectFit:"contain" }} alt="" /> : <div style={{ width:56, height:36, background:"#2a2a3e", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>📺</div>}
                    <div style={{ fontSize:11, fontWeight:600, textAlign:"center", color:"#ccc", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", width:"100%" }}>{ch.name}</div>
                    <StreamBadge type={ch.streamType} />
                  </div>
                ))}
              </Section>
            ) : (
              <div style={{ padding:"20px 40px 36px" }}>
                <div style={{ padding:24, borderRadius:12, background:"#10101a", border:`1px dashed ${accent}44`, display:"flex", alignItems:"center", gap:20 }}>
                  <span style={{ fontSize:36 }}>📡</span>
                  <div>
                    <div style={{ fontWeight:600, color:"#ccc", marginBottom:4 }}>Sin lista IPTV</div>
                    <div style={{ fontSize:13, color:"#555" }}>Importa una lista M3U, M3U8 o MPD</div>
                  </div>
                  <button onClick={() => setShowImport(true)} style={{ marginLeft:"auto", padding:"10px 20px", borderRadius:8, background:accent, color:"#000", border:"none", fontWeight:700, fontSize:13, cursor:"pointer" }}>+ Importar</button>
                </div>
              </div>
            )}

            <Section title="Películas populares">{MOVIES_DEMO.map(m => <MediaCard key={m.id} item={m} onClick={setSelectedItem} accent={accent} />)}</Section>
            <Section title="Series recomendadas">{SERIES_DEMO.map(s => <MediaCard key={s.id} item={s} onClick={setSelectedItem} accent={accent} />)}</Section>
          </div>
        )}

        {/* TV EN VIVO */}
        {page === "live" && (
          <div style={{ padding:"32px 40px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
              <h2 style={{ fontFamily:"'Bebas Neue',cursive", fontSize:30, letterSpacing:2, color:accent }}>TV en Vivo {channels.length > 0 && <span style={{ fontSize:18, color:"#666" }}>· {channels.length} canales</span>}</h2>
              <button onClick={() => setShowImport(true)} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:8, background:accent+"22", border:`1px solid ${accent}`, color:accent, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                <Icon name="upload" size={14} color={accent} /> Importar lista
              </button>
            </div>
            {channels.length === 0 ? (
              <div style={{ padding:60, textAlign:"center", border:`1px dashed ${accent}44`, borderRadius:16 }}>
                <div style={{ fontSize:50, marginBottom:16 }}>📡</div>
                <div style={{ fontSize:18, color:"#ccc", marginBottom:8 }}>Sin canales</div>
                <button onClick={() => setShowImport(true)} style={{ padding:"14px 32px", borderRadius:10, background:accent, color:"#000", border:"none", fontWeight:700, fontSize:16, cursor:"pointer" }}>+ Importar Lista</button>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px,1fr))", gap:10 }}>
                {channels.map(ch => (
                  <div key={ch.id} tabIndex={0} style={{ display:"flex", alignItems:"center", gap:14, padding:14, borderRadius:10, background:"#10101a", border:"1px solid #1e1e2e", cursor:"pointer", outline:"none", transition:"all .2s" }}
                    onClick={() => setPlayingCh(ch)}
                    onMouseEnter={e => { e.currentTarget.style.borderColor=accent; e.currentTarget.style.background=accent+"10"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor="#1e1e2e"; e.currentTarget.style.background="#10101a"; }}>
                    <div style={{ width:52, height:38, display:"flex", alignItems:"center", justifyContent:"center", background:"#1a1a2e", borderRadius:6, overflow:"hidden", flexShrink:0 }}>
                      {ch.logo ? <img src={ch.logo} style={{ maxWidth:48, maxHeight:34, objectFit:"contain" }} alt="" onError={e => e.target.style.display="none"} /> : <span style={{ fontSize:18 }}>📺</span>}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ch.name}</div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3 }}><span style={{ fontSize:11, color:"#666" }}>{ch.group}</span><StreamBadge type={ch.streamType} /></div>
                    </div>
                    <div style={{ width:34, height:34, borderRadius:"50%", background:accent, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Icon name="play" size={14} color="#000" /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PELÍCULAS */}
        {page === "movies" && (
          <div style={{ padding:"32px 40px" }}>
            <h2 style={{ fontFamily:"'Bebas Neue',cursive", fontSize:30, letterSpacing:2, color:accent, marginBottom:28 }}>Películas</h2>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px,1fr))", gap:20 }}>
              {MOVIES_DEMO.map(m => <MediaCard key={m.id} item={m} onClick={setSelectedItem} accent={accent} />)}
            </div>
          </div>
        )}

        {/* SERIES */}
        {page === "series" && (
          <div style={{ padding:"32px 40px" }}>
            <h2 style={{ fontFamily:"'Bebas Neue',cursive", fontSize:30, letterSpacing:2, color:accent, marginBottom:28 }}>Series</h2>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px,1fr))", gap:20 }}>
              {SERIES_DEMO.map(s => <MediaCard key={s.id} item={s} onClick={setSelectedItem} accent={accent} />)}
            </div>
          </div>
        )}

        {/* STREMIO */}
        {page === "stremio" && <StremioCatalogPage addons={addons} accent={accent} onSelect={setSelectedItem} />}

        {/* EPG */}
        {page === "epg" && (
          <div style={{ padding:"32px 40px" }}>
            <h2 style={{ fontFamily:"'Bebas Neue',cursive", fontSize:30, letterSpacing:2, color:accent, marginBottom:20 }}>Guía EPG</h2>
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {(channels.length > 0 ? channels.slice(0,12) : [{id:1,name:"La 1",logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/La_1_2021.svg/120px-La_1_2021.svg.png"}]).map(ch => {
                const now = new Date(); const progs = generateEPG();
                return (
                  <div key={ch.id} style={{ display:"flex", alignItems:"center", gap:0, minHeight:52 }}>
                    <div style={{ width:148, flexShrink:0, display:"flex", alignItems:"center", gap:8, padding:"6px 12px", background:"#10101a", borderRadius:"6px 0 0 6px", borderRight:"1px solid #1e1e2e" }}>
                      {ch.logo && <img src={ch.logo} style={{ width:26, height:18, objectFit:"contain" }} alt="" onError={e=>e.target.style.display="none"} />}
                      <span style={{ fontSize:12, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{ch.name}</span>
                    </div>
                    <div style={{ display:"flex", flex:1, gap:2, overflowX:"hidden" }}>
                      {progs.map(p => { const isNow = p.start<=now && p.end>now; return (
                        <div key={p.id} tabIndex={0} style={{ flex:1, minWidth:90, padding:"5px 9px", background:isNow?"#1a1a2e":"#10101a", border:`1px solid ${isNow?accent:"transparent"}`, borderRadius:4, cursor:"pointer", outline:"none" }}>
                          <div style={{ fontSize:10, color:"#666" }}>{p.start.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}</div>
                          <div style={{ fontSize:11, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:isNow?"#fff":"#aaa" }}>{p.title}</div>
                        </div>
                      ); })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {page === "settings" && (
          <StremioManager
            addons={addons} onAddonsChange={handleAddons}
            accent={accent} setAccent={setAccentSave}
            m3uUrl={m3uUrl} setM3uUrl={v=>{setM3uUrl(v);save({m3uUrl:v});}}
            epgUrl={epgUrl} setEpgUrl={v=>{setEpgUrl(v);save({epgUrl:v});}}
            debridToken={debridToken} setDebridToken={v=>{setDebridToken(v);save({debridToken:v});}}
            tmdbKey={tmdbKey} setTmdbKey={v=>{setTmdbKey(v);save({tmdbKey:v});}}
            onOpenImport={() => setShowImport(true)}
            channels={channels}
          />
        )}
      </main>

      {/* ── MODALS ── */}
      {showImport && <ImportModal onImport={handleImport} onClose={() => setShowImport(false)} accent={accent} parseM3U={parseM3U} fetchM3U={fetchM3U} detectStreamType={detectStreamType} />}
      {playingCh  && <Player channel={playingCh} onClose={() => setPlayingCh(null)} accent={accent} />}
      {selectedItem && <DetailModal item={selectedItem} addons={addons} accent={accent} onClose={() => setSelectedItem(null)} onPlay={ch => { setPlayingCh(ch); setSelectedItem(null); }} />}
    </div>
  );
}

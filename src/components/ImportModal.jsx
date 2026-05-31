import { useState, useRef } from "react";
import { fetchXtreamLive } from "../BellaTV";

const StreamBadge = ({ type }) => {
  const cfg = {
    dash:   { label: "MPD", color: "#A78BFA" },
    hls:    { label: "M3U", color: "#34D399" },
    mp4:    { label: "MP4", color: "#60A5FA" },
  }[type] || { label: type?.toUpperCase() || "?", color: "#888" };
  return (
    <span style={{ background: cfg.color+"22", color: cfg.color, border: `1px solid ${cfg.color}44`, borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: "2px 7px" }}>
      {cfg.label}
    </span>
  );
};

export default function ImportModal({ onImport, onClose, accent, parseM3U, fetchM3U, detectStreamType }) {
  const [url, setUrl]         = useState("");
  const [xtreamServer, setXtreamServer] = useState("");
  const [xtreamUser, setXtreamUser]     = useState("");
  const [xtreamPass, setXtreamPass]     = useState("");
  const [loading, setLoading] = useState(false);
  const [xtreamLoading, setXtreamLoading] = useState(false);
  const [error, setError]     = useState("");
  const [preview, setPreview] = useState(null);
  const fileRef               = useRef();

  const parseLoosePlaylist = (text, fallbackGroup = "Playlist") => {
    const urls = [...text.matchAll(/https?:\/\/[^\s"'<>\\]+/gi)].map(m => m[0]);
    return urls.map((url, i) => ({
      id: `loose_${i}`,
      name: `Canal ${i + 1}`,
      logo: "",
      group: fallbackGroup,
      url,
      streamType: detectStreamType(url),
      type: "live",
    }));
  };

  const parsePLS = (text) => {
    const lines = text.split(/\r?\n/).map(l => l.trim());
    const items = [];
    const files = {};
    const titles = {};
    for (const line of lines) {
      const file = line.match(/^File(\d+)=([^]+)$/i);
      if (file) files[file[1]] = file[2].trim();
      const title = line.match(/^Title(\d+)=([^]+)$/i);
      if (title) titles[title[1]] = title[2].trim();
    }
    Object.keys(files).sort((a,b)=>Number(a)-Number(b)).forEach((n, i) => {
      const url = files[n];
      if (!url) return;
      items.push({
        id: `pls_${i}`,
        name: titles[n] || `Canal ${i + 1}`,
        logo: "",
        group: "PLS",
        url,
        streamType: detectStreamType(url),
        type: "live",
      });
    });
    return items;
  };

  const parseXMLPlaylist = (text, group = "XML") => {
    try {
      const doc = new DOMParser().parseFromString(text, "application/xml");
      const tracks = [...doc.querySelectorAll("track")];
      if (tracks.length > 0) {
        return tracks.map((track, i) => {
          const url = track.querySelector("location")?.textContent?.trim() || track.querySelector("ref")?.getAttribute("href")?.trim() || "";
          const name = track.querySelector("title")?.textContent?.trim() || track.querySelector("annotation")?.textContent?.trim() || `Canal ${i + 1}`;
          if (!url) return null;
          return {
            id: `xml_${i}`,
            name,
            logo: "",
            group,
            url,
            streamType: detectStreamType(url),
            type: "live",
          };
        }).filter(Boolean);
      }
      return parseLoosePlaylist(text, group);
    } catch {
      return parseLoosePlaylist(text, group);
    }
  };

  // Cargar desde URL
  const handleURL = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true); setError(""); setPreview(null);
    try {
      // Soporte directo MPD: si es un .mpd, añadirlo como canal único
      if (detectStreamType(trimmed) === "dash") {
        const name = trimmed.split("/").pop().split("?")[0] || "Stream MPD";
        const channels = [{ id: `ch_${Date.now()}`, name, logo: "", group: "MPD", url: trimmed, streamType: "dash", type: "live" }];
        setPreview({ channels, source: trimmed });
      } else {
        const text = await fetchM3U(trimmed);
        const trimmedText = text.trim();
        // Detectar si es JSON (addon Stremio exportado)
        if (trimmedText.startsWith("{") || trimmedText.startsWith("[")) {
          const json = JSON.parse(text);
          const items = Array.isArray(json) ? json : (json.streams || json.metas || json.channels || []);
          const channels = items.map((item, i) => ({
            id: `json_${i}`,
            name:       item.name || item.title || `Canal ${i+1}`,
            logo:       item.logo || item.thumbnail || item.poster || "",
            group:      item.group || item.type || "JSON",
            url:        item.url || item.stream || "",
            streamType: detectStreamType(item.url || item.stream || ""),
            type:       "live",
          })).filter(c => c.url);
          setPreview({ channels, source: "JSON" });
        } else if (/^\[playlist\]/i.test(trimmedText)) {
          const channels = parsePLS(text);
          if (channels.length === 0) throw new Error("No se encontraron canales en el PLS");
          setPreview({ channels, source: "PLS" });
        } else if (trimmedText.startsWith("<") && /<(xspf|smil|asx|wpl|playlist)/i.test(trimmedText)) {
          const channels = parseXMLPlaylist(text, "XML");
          if (channels.length === 0) throw new Error("No se encontraron canales en el XML");
          setPreview({ channels, source: "XML" });
        } else {
          const channels = parseM3U(text);
          if (channels.length === 0) throw new Error("No se encontraron canales en la lista");
          setPreview({ channels, source: trimmed });
        }
      }
    } catch (e) {
      setError(e.message || "Error desconocido al cargar la lista");
    } finally { setLoading(false); }
  };

  const handleXtream = async () => {
    const server = xtreamServer.trim();
    const username = xtreamUser.trim();
    const password = xtreamPass.trim();
    if (!server || !username || !password) return;
    setXtreamLoading(true); setError(""); setPreview(null);
    try {
      const channels = await fetchXtreamLive({ server, username, password });
      if (channels.length === 0) throw new Error("No se encontraron canales en Xtream");
      setPreview({ channels, source: "Xtream Codes" });
    } catch (e) {
      setError(e.message || "Error cargando Xtream");
    } finally {
      setXtreamLoading(false);
    }
  };

  // Cargar desde archivo
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true); setError(""); setPreview(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const ext  = file.name.split(".").pop().toLowerCase();

        if (ext === "mpd") {
          // MPD como archivo local: añadir como blob URL
          const blob = new Blob([text], { type: "application/dash+xml" });
          const blobUrl = URL.createObjectURL(blob);
          setPreview({ channels: [{ id: "mpd_local", name: file.name, logo: "", group: "MPD Local", url: blobUrl, streamType: "dash", type: "live" }], source: file.name });
        } else if (ext === "json") {
          const json = JSON.parse(text);
          const items = Array.isArray(json) ? json : (json.streams || json.metas || json.channels || []);
          const channels = items.map((item, i) => ({
            id: `json_${i}`,
            name:       item.name || item.title || `Canal ${i+1}`,
            logo:       item.logo || item.thumbnail || item.poster || "",
            group:      item.group || item.type || "JSON",
            url:        item.url || item.stream || "",
            streamType: detectStreamType(item.url || item.stream || ""),
            type:       "live",
          })).filter(c => c.url);
          if (channels.length === 0) throw new Error("No se encontraron streams en el JSON");
          setPreview({ channels, source: file.name });
        } else if (ext === "pls") {
          const channels = parsePLS(text);
          if (channels.length === 0) throw new Error("No se encontraron canales en el PLS");
          setPreview({ channels, source: file.name });
        } else if (["xspf", "asx", "wpl"].includes(ext)) {
          const channels = parseXMLPlaylist(text, ext.toUpperCase());
          if (channels.length === 0) throw new Error(`No se encontraron canales en ${ext.toUpperCase()}`);
          setPreview({ channels, source: file.name });
        } else {
          // M3U / M3U8
          const channels = parseM3U(text);
          if (channels.length === 0) throw new Error("No se encontraron canales");
          setPreview({ channels, source: file.name });
        }
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    };
    reader.readAsText(file);
  };

  // Resumen por tipo
  const byType = preview
    ? preview.channels.reduce((acc, c) => { acc[c.streamType] = (acc[c.streamType] || 0) + 1; return acc; }, {})
    : {};

  const byGroup = preview
    ? [...new Set(preview.channels.map(c => c.group))].slice(0, 6)
    : [];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.88)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(10px)" }}
      onClick={onClose}>
      <div style={{ background:"#12121e", border:`1px solid ${accent}44`, borderRadius:16, padding:"36px 40px", width:580, maxWidth:"94vw", maxHeight:"92vh", overflowY:"auto", boxShadow:`0 0 60px ${accent}22` }}
        onClick={e => e.stopPropagation()}>

        {/* HEADER */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
          <div>
            <h2 style={{ fontFamily:"'Bebas Neue',cursive", fontSize:28, color:"#fff", letterSpacing:2, margin:0 }}>Importar Lista</h2>
            <p style={{ fontSize:12, color:"#666", margin:"4px 0 0" }}>M3U · M3U8 · MPD · JSON · Archivo local</p>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#666", cursor:"pointer", fontSize:22, lineHeight:1 }}>✕</button>
        </div>

        {/* FORMATOS */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:28 }}>
          {[
            { label:"M3U/M3U8", color:"#34D399", desc:"HLS · TS" },
            { label:"MPD",      color:"#A78BFA", desc:"MPEG-DASH" },
            { label:"Xtream",   color:"#EC4899", desc:"Live TV API" },
            { label:"JSON",     color:"#F59E0B", desc:"Stremio·API" },
          ].map(f => (
            <div key={f.label} style={{ padding:"10px 8px", borderRadius:8, background:f.color+"11", border:`1px solid ${f.color}33`, textAlign:"center" }}>
              <div style={{ color:f.color, fontWeight:700, fontSize:12 }}>{f.label}</div>
              <div style={{ color:"#666", fontSize:10, marginTop:2 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* XTREAM */}
        <div style={{ padding:14, borderRadius:10, background:"#0f0f1a", border:"1px solid #22243a", marginBottom:20 }}>
          <div style={{ fontSize:12, color:"#EC4899", fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:10 }}>
            Xtream Codes / IPTV API
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr 1fr auto", gap:8 }}>
            <input
              value={xtreamServer}
              onChange={e => setXtreamServer(e.target.value)}
              placeholder="https://servidor.com"
              style={{ padding:"12px 14px", borderRadius:8, background:"#1a1a2e", border:"1px solid #2a2a3e", color:"#e0e0e0", fontSize:13, outline:"none" }}
            />
            <input
              value={xtreamUser}
              onChange={e => setXtreamUser(e.target.value)}
              placeholder="usuario"
              style={{ padding:"12px 14px", borderRadius:8, background:"#1a1a2e", border:"1px solid #2a2a3e", color:"#e0e0e0", fontSize:13, outline:"none" }}
            />
            <input
              value={xtreamPass}
              onChange={e => setXtreamPass(e.target.value)}
              placeholder="contraseña"
              type="password"
              style={{ padding:"12px 14px", borderRadius:8, background:"#1a1a2e", border:"1px solid #2a2a3e", color:"#e0e0e0", fontSize:13, outline:"none" }}
            />
            <button
              onClick={handleXtream}
              disabled={xtreamLoading || !xtreamServer.trim() || !xtreamUser.trim() || !xtreamPass.trim()}
              style={{ padding:"12px 16px", borderRadius:8, border:"none", background: !xtreamServer.trim() || !xtreamUser.trim() || !xtreamPass.trim() ? "#2a2a3e" : accent, color: !xtreamServer.trim() || !xtreamUser.trim() || !xtreamPass.trim() ? "#666" : "#000", fontWeight:700, fontSize:13, cursor: !xtreamServer.trim() || !xtreamUser.trim() || !xtreamPass.trim() ? "default" : "pointer", opacity: xtreamLoading ? 0.6 : 1, whiteSpace:"nowrap" }}
            >
              {xtreamLoading ? "⏳" : "Cargar Xtream"}
            </button>
          </div>
          <div style={{ fontSize:11, color:"#666", marginTop:8 }}>
            Importa canales live desde servidores compatibles con OTT Navigator / Xtream Codes.
          </div>
        </div>

        {/* FORMATS */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:28 }}>
          {[
            { label:"M3U/M3U8", color:"#34D399", desc:"HLS · TS" },
            { label:"MPD",      color:"#A78BFA", desc:"MPEG-DASH" },
            { label:"JSON",     color:"#F59E0B", desc:"Stremio·API" },
            { label:"Archivo",  color:"#60A5FA", desc:"Local" },
          ].map(f => (
            <div key={f.label} style={{ padding:"10px 8px", borderRadius:8, background:f.color+"11", border:`1px solid ${f.color}33`, textAlign:"center" }}>
              <div style={{ color:f.color, fontWeight:700, fontSize:12 }}>{f.label}</div>
              <div style={{ color:"#666", fontSize:10, marginTop:2 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* URL */}
        <label style={{ display:"block", fontSize:11, color:"#888", fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>URL de la lista</label>
        <div style={{ display:"flex", gap:10, marginBottom:20 }}>
          <input
            value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleURL()}
            placeholder="https://ejemplo.com/lista.m3u   ó   .m3u8   ó   .mpd"
            style={{ flex:1, padding:"12px 16px", borderRadius:8, background:"#1a1a2e", border:`1px solid ${url ? accent+"66" : "#2a2a3e"}`, color:"#e0e0e0", fontSize:14, outline:"none", transition:"border-color .2s" }}
          />
          <button onClick={handleURL} disabled={loading || !url.trim()} style={{ padding:"12px 20px", borderRadius:8, border:"none", background: !url.trim() ? "#2a2a3e" : accent, color: !url.trim() ? "#666" : "#000", fontWeight:700, fontSize:14, cursor: !url.trim() ? "default" : "pointer", opacity: loading ? 0.6 : 1, whiteSpace:"nowrap", transition:"all .2s" }}>
            {loading ? "⏳" : "Cargar"}
          </button>
        </div>

        {/* SEPARADOR */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
          <div style={{ flex:1, height:1, background:"#2a2a3e" }} />
          <span style={{ color:"#555", fontSize:12 }}>o sube un archivo</span>
          <div style={{ flex:1, height:1, background:"#2a2a3e" }} />
        </div>

        {/* FILE */}
          <input ref={fileRef} type="file" accept=".m3u,.m3u8,.mpd,.json,.xspf,.pls,.wpl,.asx" style={{ display:"none" }} onChange={handleFile} />
          <button onClick={() => fileRef.current.click()} style={{ width:"100%", padding:16, borderRadius:8, background:"#1a1a2e", border:`1px dashed #3a3a5e`, color:"#888", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, transition:"all .2s" }}
          onMouseEnter={e => e.currentTarget.style.borderColor=accent}
          onMouseLeave={e => e.currentTarget.style.borderColor="#3a3a5e"}>
          📁 Seleccionar archivo M3U · M3U8 · MPD · JSON · XSPF · PLS · WPL · ASX
        </button>

        {/* ERROR */}
        {error && (
          <div style={{ marginTop:16, padding:"12px 16px", borderRadius:8, background:"#ff444418", border:"1px solid #ff4444", color:"#ff8888", fontSize:13 }}>
            ⚠ {error}
          </div>
        )}

        {/* PREVIEW */}
        {preview && (
          <div style={{ marginTop:20, padding:18, borderRadius:10, background:"#0a0a14", border:`1px solid ${accent}55` }}>
            {/* STATS */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <span style={{ color:"#fff", fontWeight:700, fontSize:16 }}>
                ✓ {preview.channels.length} canales
              </span>
              <div style={{ display:"flex", gap:8 }}>
                {Object.entries(byType).map(([type, count]) => (
                  <span key={type}><StreamBadge type={type} /> ×{count}</span>
                ))}
              </div>
            </div>

            {/* GRUPOS */}
            {byGroup.length > 0 && (
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
                {byGroup.map(g => (
                  <span key={g} style={{ padding:"3px 10px", borderRadius:12, background:"#1a1a2e", fontSize:11, color:"#aaa" }}>{g}</span>
                ))}
                {[...new Set(preview.channels.map(c => c.group))].length > 6 && (
                  <span style={{ fontSize:11, color:"#555", alignSelf:"center" }}>+{[...new Set(preview.channels.map(c => c.group))].length - 6} más</span>
                )}
              </div>
            )}

            {/* PRIMEROS CANALES */}
            <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:180, overflowY:"auto" }}>
              {preview.channels.slice(0, 6).map((ch, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius:6, background:"#12121e" }}>
                  {ch.logo
                    ? <img src={ch.logo} style={{ width:32, height:22, objectFit:"contain", flexShrink:0 }} alt="" onError={e => e.target.style.display="none"} />
                    : <div style={{ width:32, height:22, background:"#2a2a3e", borderRadius:4, flexShrink:0 }} />
                  }
                  <span style={{ flex:1, fontSize:13, color:"#ccc", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ch.name}</span>
                  <span style={{ fontSize:11, color:"#555" }}>{ch.group}</span>
                  <StreamBadge type={ch.streamType} />
                </div>
              ))}
              {preview.channels.length > 6 && (
                <div style={{ textAlign:"center", fontSize:12, color:"#555", padding:"6px 0" }}>
                  + {preview.channels.length - 6} canales más...
                </div>
              )}
            </div>

            {/* BOTÓN IMPORTAR */}
            <button onClick={() => { onImport(preview.channels); onClose(); }}
              style={{ marginTop:16, width:"100%", padding:"14px", borderRadius:8, border:"none", background:accent, color:"#000", fontWeight:700, fontSize:15, cursor:"pointer", transition:"opacity .2s" }}
              onMouseEnter={e => e.currentTarget.style.opacity="0.85"}
              onMouseLeave={e => e.currentTarget.style.opacity="1"}>
              ✓ Importar {preview.channels.length} canales a Bella TV
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

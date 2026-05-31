import { useState } from "react";
import { fetchAddonManifest, DEFAULT_ADDONS } from "../BellaTV";

const ACCENT_COLORS = [
  { name:"Rosa",    value:"#F472B6" },
  { name:"Violeta", value:"#A78BFA" },
  { name:"Ámbar",   value:"#F59E0B" },
  { name:"Azul",    value:"#3B82F6" },
  { name:"Verde",   value:"#10B981" },
  { name:"Rojo",    value:"#EF4444" },
  { name:"Cian",    value:"#06B6D4" },
  { name:"Naranja", value:"#F97316" },
];

export default function StremioManager({
  addons, onAddonsChange,
  accent, setAccent,
  m3uUrl, setM3uUrl,
  epgUrl, setEpgUrl,
  debridToken, setDebridToken,
  tmdbKey, setTmdbKey,
  onOpenImport, channels,
}) {
  const [newUrl, setNewUrl]       = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError]   = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [section, setSection]     = useState("addons");

  // ── Añadir addon por URL ──────────────────────────────────────────────────
  const handleAddAddon = async () => {
    const trimmed = newUrl.trim().replace(/\/manifest\.json$/, "");
    if (!trimmed) return;
    setAddLoading(true); setAddError(""); setAddSuccess("");
    try {
      const manifest = await fetchAddonManifest(trimmed);
      // Comprobar si ya existe
      if (addons.find(a => a.id === manifest.id || a.url === trimmed)) {
        throw new Error("Este addon ya está añadido");
      }
      const newAddon = {
        id:       manifest.id || trimmed,
        name:     manifest.name || "Addon",
        url:      trimmed,
        logo:     manifest.logo ? "🧩" : "🧩",
        logoUrl:  manifest.logo || "",
        types:    manifest.types || [],
        manifest,
        enabled:  true,
        custom:   true,
      };
      onAddonsChange([...addons, newAddon]);
      setNewUrl("");
      setAddSuccess(`✓ "${manifest.name}" añadido correctamente`);
      setTimeout(() => setAddSuccess(""), 3000);
    } catch (e) {
      setAddError(e.message || "No se pudo cargar el manifest.json del addon");
    } finally { setAddLoading(false); }
  };

  const toggleAddon = (id) => {
    onAddonsChange(addons.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const removeAddon = (id) => {
    onAddonsChange(addons.filter(a => a.id !== id));
  };

  const resetAddons = () => {
    onAddonsChange(DEFAULT_ADDONS);
  };

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const Input = ({ label, value, onChange, type = "text", placeholder }) => (
    <div style={{ marginBottom:20 }}>
      <label style={{ display:"block", fontSize:11, color:"#888", fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width:"100%", padding:"12px 16px", borderRadius:8, background:"#1a1a2e", border:"1px solid #2a2a3e", color:"#e0e0e0", fontSize:14, outline:"none", transition:"border-color .2s" }}
        onFocus={e => e.target.style.borderColor=accent}
        onBlur={e => e.target.style.borderColor="#2a2a3e"} />
    </div>
  );

  const TAB_STYLE = (active) => ({
    padding:"10px 20px", borderRadius:8, border:"none", cursor:"pointer",
    background: active ? accent+"22" : "transparent",
    color: active ? accent : "#666",
    fontSize:13, fontWeight:600,
    borderBottom: `2px solid ${active ? accent : "transparent"}`,
    transition:"all .2s",
  });

  return (
    <div style={{ padding:"32px 40px", maxWidth:700 }}>
      <h2 style={{ fontFamily:"'Bebas Neue',cursive", fontSize:30, letterSpacing:2, color:accent, marginBottom:28 }}>Ajustes</h2>

      {/* TABS */}
      <div style={{ display:"flex", gap:4, borderBottom:"1px solid #1e1e2e", marginBottom:32 }}>
        {[["addons","🧩 Addons Stremio"], ["lista","📡 Lista IPTV"], ["api","🔑 APIs"], ["tema","🎨 Tema"]].map(([id, label]) => (
          <button key={id} onClick={() => setSection(id)} style={TAB_STYLE(section===id)}>{label}</button>
        ))}
      </div>

      {/* ── ADDONS ──────────────────────────────────────────────────────────── */}
      {section === "addons" && (
        <div>
          <p style={{ fontSize:13, color:"#666", marginBottom:24 }}>
            Los addons Stremio se comunican mediante su API REST JSON. Puedes añadir cualquier addon compatible con Stremio introduciendo su URL base.
          </p>

          {/* AÑADIR ADDON */}
          <div style={{ marginBottom:28 }}>
            <label style={{ display:"block", fontSize:11, color:"#888", fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:10 }}>
              Añadir addon por URL
            </label>
            <div style={{ display:"flex", gap:10 }}>
              <input value={newUrl} onChange={e => setNewUrl(e.target.value)}
                onKeyDown={e => e.key==="Enter" && handleAddAddon()}
                placeholder="https://torrentio.strem.fun/manifest.json  ó  URL base"
                style={{ flex:1, padding:"12px 16px", borderRadius:8, background:"#1a1a2e", border:`1px solid ${newUrl ? accent+"66" : "#2a2a3e"}`, color:"#e0e0e0", fontSize:13, outline:"none" }} />
              <button onClick={handleAddAddon} disabled={addLoading || !newUrl.trim()} style={{ padding:"12px 20px", borderRadius:8, border:"none", background: newUrl.trim() ? accent : "#2a2a3e", color: newUrl.trim() ? "#000" : "#555", fontWeight:700, fontSize:13, cursor: newUrl.trim() ? "pointer" : "default", opacity: addLoading ? 0.6 : 1, whiteSpace:"nowrap" }}>
                {addLoading ? "⏳" : "+ Añadir"}
              </button>
            </div>
            {addError   && <div style={{ marginTop:10, padding:"10px 14px", borderRadius:6, background:"#ff444418", border:"1px solid #ff444466", color:"#ff8888", fontSize:13 }}>⚠ {addError}</div>}
            {addSuccess && <div style={{ marginTop:10, padding:"10px 14px", borderRadius:6, background:"#10b98118", border:"1px solid #10b98166", color:"#10b981", fontSize:13 }}>{addSuccess}</div>}
          </div>

          {/* LISTA ADDONS */}
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {addons.map(addon => (
              <div key={addon.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"16px 18px", borderRadius:10, background:"#10101a", border:`1px solid ${addon.enabled ? accent+"33" : "#1e1e2e"}`, transition:"all .2s" }}>
                {/* LOGO */}
                <div style={{ width:42, height:42, borderRadius:10, background: addon.enabled ? accent+"22" : "#1a1a2e", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
                  {addon.logoUrl
                    ? <img src={addon.logoUrl} style={{ width:32, height:32, objectFit:"contain", borderRadius:6 }} alt="" onError={e => { e.target.style.display="none"; }} />
                    : addon.logo || "🧩"
                  }
                </div>

                {/* INFO */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:14, color: addon.enabled ? "#e0e0e0" : "#555", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {addon.name}
                    {addon.custom && <span style={{ marginLeft:8, fontSize:10, color:accent, background:accent+"22", padding:"2px 6px", borderRadius:4 }}>Custom</span>}
                  </div>
                  <div style={{ fontSize:11, color:"#555", marginTop:2 }}>
                    {addon.url}
                  </div>
                  {addon.manifest?.types && (
                    <div style={{ display:"flex", gap:4, marginTop:6 }}>
                      {addon.manifest.types.map(t => (
                        <span key={t} style={{ fontSize:10, color:"#888", background:"#1a1a2e", padding:"1px 7px", borderRadius:4 }}>{t}</span>
                      ))}
                      {addon.manifest?.catalogs?.length > 0 && (
                        <span style={{ fontSize:10, color:"#666" }}>{addon.manifest.catalogs.length} catálogos</span>
                      )}
                    </div>
                  )}
                </div>

                {/* TOGGLE */}
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <button onClick={() => toggleAddon(addon.id)}
                    style={{ padding:"7px 14px", borderRadius:20, border:`1px solid ${addon.enabled ? accent : "#333"}`, background: addon.enabled ? accent+"22" : "transparent", color: addon.enabled ? accent : "#555", fontSize:12, fontWeight:700, cursor:"pointer", transition:"all .2s" }}>
                    {addon.enabled ? "✓ Activo" : "Inactivo"}
                  </button>
                  {addon.custom && (
                    <button onClick={() => removeAddon(addon.id)}
                      style={{ padding:"7px 10px", borderRadius:8, border:"1px solid #ff444444", background:"#ff444411", color:"#ff6666", fontSize:12, cursor:"pointer" }}>
                      🗑
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button onClick={resetAddons} style={{ marginTop:20, padding:"10px 18px", borderRadius:8, background:"#1a1a2e", border:"1px solid #2a2a3e", color:"#888", fontSize:13, cursor:"pointer" }}>
            ↺ Restaurar addons por defecto
          </button>

          {/* ADDONS POPULARES */}
          <div style={{ marginTop:32 }}>
            <div style={{ fontSize:12, color:"#888", fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:14 }}>URLs de addons populares</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[
                { name:"Torrentio",       url:"https://torrentio.strem.fun" },
                { name:"Peerflix",        url:"https://peerflix-addon.herokuapp.com" },
                { name:"Cinemeta",        url:"https://v3-cinemeta.strem.io" },
                { name:"OpenSubtitles",   url:"https://opensubtitles-v3.strem.io" },
                { name:"TMDB Addon",      url:"https://94c8cb9f702d-tmdb-addon.baby-pool.xyz" },
                { name:"Anime Kitsu",     url:"https://anime-kitsu.strem.fun" },
              ].map(a => (
                <div key={a.url} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderRadius:8, background:"#0e0e18", border:"1px solid #1e1e2e" }}>
                  <span style={{ flex:1, fontSize:13, color:"#aaa" }}>{a.name}</span>
                  <code style={{ flex:2, fontSize:11, color:"#666", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.url}</code>
                  <button onClick={() => setNewUrl(a.url)} style={{ padding:"6px 12px", borderRadius:6, border:`1px solid ${accent}44`, background:accent+"11", color:accent, fontSize:12, cursor:"pointer", whiteSpace:"nowrap" }}>
                    Usar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── LISTA IPTV ──────────────────────────────────────────────────────── */}
      {section === "lista" && (
        <div>
          <Input label="URL Lista M3U / M3U8 / MPD" value={m3uUrl} onChange={setM3uUrl}
            placeholder="https://ejemplo.com/lista.m3u" />
          <Input label="EPG / XMLTV URL" value={epgUrl} onChange={setEpgUrl}
            placeholder="https://ejemplo.com/epg.xml.gz" />

          <div style={{ display:"flex", gap:12, marginTop:8 }}>
            <button onClick={onOpenImport}
              style={{ display:"flex", alignItems:"center", gap:8, padding:"13px 24px", borderRadius:8, background:accent, color:"#000", border:"none", fontWeight:700, fontSize:14, cursor:"pointer" }}>
              📁 Importar lista ahora
            </button>
          </div>

          {channels.length > 0 && (
            <div style={{ marginTop:20, padding:"14px 18px", borderRadius:8, background:"#10b98118", border:"1px solid #10b98144" }}>
              <span style={{ color:"#10b981", fontWeight:700 }}>✓ {channels.length} canales cargados</span>
              <span style={{ color:"#10b98188", fontSize:13, marginLeft:12 }}>
                {[...new Set(channels.map(c => c.streamType))].map(t => t.toUpperCase()).join(" · ")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── APIs ────────────────────────────────────────────────────────────── */}
      {section === "api" && (
        <div>
          <div style={{ padding:"14px 16px", borderRadius:8, background:"#F59E0B11", border:"1px solid #F59E0B44", marginBottom:24 }}>
            <div style={{ fontSize:13, color:"#F59E0B", fontWeight:600, marginBottom:4 }}>🔑 Configura tus APIs aquí</div>
            <div style={{ fontSize:12, color:"#888" }}>Las claves se guardan localmente en tu dispositivo. Nunca se envían a servidores externos.</div>
          </div>

          <Input label="Real-Debrid API Token" value={debridToken} onChange={setDebridToken}
            type="password" placeholder="Obtén tu token en real-debrid.com/apitoken" />

          <Input label="TMDB API Key (v3)" value={tmdbKey} onChange={setTmdbKey}
            type="password" placeholder="Obtén tu key en themoviedb.org/settings/api" />

          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <a href="https://real-debrid.com/apitoken" target="_blank" rel="noreferrer"
              style={{ padding:"10px 16px", borderRadius:8, background:"#A78BFA22", border:"1px solid #A78BFA44", color:"#A78BFA", fontSize:13, textDecoration:"none", display:"inline-block" }}>
              🔗 Real-Debrid token
            </a>
            <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer"
              style={{ padding:"10px 16px", borderRadius:8, background:"#3B82F622", border:"1px solid #3B82F644", color:"#3B82F6", fontSize:13, textDecoration:"none", display:"inline-block" }}>
              🔗 TMDB API key
            </a>
          </div>
        </div>
      )}

      {/* ── TEMA ────────────────────────────────────────────────────────────── */}
      {section === "tema" && (
        <div>
          <div style={{ fontSize:12, color:"#888", fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:16 }}>
            Color de acento
          </div>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:32 }}>
            {ACCENT_COLORS.map(c => (
              <div key={c.value} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                <button onClick={() => setAccent(c.value)} style={{ width:48, height:48, borderRadius:"50%", background:c.value, border: accent===c.value ? "3px solid #fff" : "3px solid transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transform: accent===c.value ? "scale(1.18)" : "scale(1)", transition:"all .2s", boxShadow: accent===c.value ? `0 0 16px ${c.value}88` : "none" }}>
                  {accent === c.value && <span style={{ fontSize:16 }}>✓</span>}
                </button>
                <span style={{ fontSize:10, color: accent===c.value ? c.value : "#555" }}>{c.name}</span>
              </div>
            ))}
          </div>

          {/* PREVIEW */}
          <div style={{ padding:20, borderRadius:12, background:"#0e0e18", border:`1px solid ${accent}44` }}>
            <div style={{ fontFamily:"'Bebas Neue',cursive", fontSize:22, color:accent, letterSpacing:2, marginBottom:12 }}>BELLA TV — Vista previa</div>
            <div style={{ display:"flex", gap:10 }}>
              <button style={{ padding:"10px 20px", borderRadius:8, background:accent, color:"#000", border:"none", fontWeight:700, fontSize:13, cursor:"pointer" }}>▶ Reproducir</button>
              <button style={{ padding:"10px 20px", borderRadius:8, background:accent+"22", border:`1px solid ${accent}`, color:accent, fontSize:13, cursor:"pointer" }}>🧩 Addons</button>
              <span style={{ padding:"6px 12px", borderRadius:20, background:accent+"33", color:accent, fontSize:12, alignSelf:"center" }}>M3U</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

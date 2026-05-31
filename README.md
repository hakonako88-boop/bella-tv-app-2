# 📺 Bella TV

> IPTV Web App optimizada para **Android TV** con soporte M3U, MPD, JSON y addons Stremio.

![Bella TV](https://img.shields.io/badge/Bella%20TV-IPTV%20%7C%20Stremio-F472B6?style=for-the-badge&logo=tv&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## ✨ Características

### 📡 TV en Vivo
- Importa listas **M3U / M3U8 / MPD** desde URL o archivo local
- Parser completo de atributos `tvg-name`, `tvg-logo`, `group-title`, `tvg-id`
- Filtro por grupos, búsqueda en tiempo real
- Soporte **JSON** (formato Stremio exportado)

### 🎬 Reproductor Universal
| Formato | Librería | Notas |
|---------|----------|-------|
| M3U / M3U8 | `hls.js` | HLS adaptativo |
| MPD | `dash.js` | MPEG-DASH, Dolby Vision |
| MP4 / MKV | HTML5 nativo | Directo |
| Magnet | Real-Debrid | Requiere token |

### 🧩 Addons Stremio (JSON API)
- Compatible con cualquier addon Stremio (`manifest.json`)
- Addons preconfigurados: **Torrentio**, **Peerflix**, **Cinemeta**, **OpenSubtitles**
- Añade addons personalizados por URL
- Catálogos por tipo (movie / series) y búsqueda
- Streams en múltiples calidades (4K, 1080p, HDR, Dolby Vision)

### 📋 Guía EPG
- Grilla interactiva de programación
- Soporte XMLTV
- Indicador de programa actual en tiempo real

### ⚙️ Configuración
- **Real-Debrid** — resolución de torrents y magnets
- **TMDB API** — metadatos, portadas, descripción en castellano
- **Color de tema** — 8 colores de acento personalizables
- Todo guardado en `localStorage` del dispositivo

### 📺 Android TV / 10-foot UI
- Navegación por **D-pad** (flechas + Enter)
- Sidebar colapsable
- Foco visual claro en todos los elementos
- Teclado en reproductor: `← →` ±10s · `↑↓` volumen · `ESC` cerrar

---

## 🚀 Instalación

```bash
# Clonar el repositorio
git clone https://github.com/TU_USUARIO/bella-tv.git
cd bella-tv

# Instalar dependencias
npm install

# Iniciar en desarrollo
npm run dev
# → Abre http://localhost:5173

# Build para producción
npm run build
```

---

## 📱 Usar en Android TV

### Opción A — Navegador del Android TV
1. Ejecuta `npm run dev` en tu PC/servidor
2. En el Android TV abre el navegador y ve a `http://IP_DE_TU_PC:5173`

### Opción B — Desplegar en servidor
```bash
npm run build
# Sube la carpeta /dist a tu servidor (Nginx, Vercel, Netlify...)
```

### Opción C — APK WebView (avanzado)
Envuelve la URL en un proyecto Android Studio con `WebView` configurado para Android TV.

---

## 🧩 Añadir Addons Stremio

En **Ajustes → Addons Stremio**, introduce la URL base del addon:

```
https://torrentio.strem.fun
https://v3-cinemeta.strem.io
https://opensubtitles-v3.strem.io
https://peerflix-addon.herokuapp.com
```

Bella TV carga automáticamente el `manifest.json` y sus catálogos.

---

## 📂 Estructura del proyecto

```
bella-tv/
├── index.html
├── package.json
├── vite.config.js
├── .gitignore
└── src/
    ├── main.jsx
    ├── BellaTV.jsx          # App principal + lógica Stremio
    └── components/
        ├── Player.jsx       # Reproductor HLS/DASH/MP4
        ├── ImportModal.jsx  # Importar listas M3U/MPD/JSON
        └── StremioManager.jsx # Gestor de addons + Ajustes
```

---

## 🔑 APIs necesarias (opcionales)

| Servicio | Para qué | Cómo obtenerla |
|----------|----------|----------------|
| Real-Debrid | Resolver torrents/magnets | [real-debrid.com/apitoken](https://real-debrid.com/apitoken) |
| TMDB | Metadatos en castellano | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) |

Se configuran desde **Ajustes → APIs** en la propia app.

---

## 📜 Licencia

MIT © 2025 — Bella TV

---

> **Aviso legal:** Esta aplicación es un reproductor multimedia. No incluye ni distribuye contenido. El usuario es responsable de las fuentes que utiliza.

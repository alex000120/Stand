# IA Holográfica · Control por Gestos

## Archivos
| Archivo | Para qué sirve |
|---|---|
| `index.html` | Estructura (reemplaza a `index9.html`) |
| `style.css` | Estilos |
| `app.js` | Toda la lógica |
| `sw.js` | Service worker: guarda la app y los videos para usar sin internet |
| `manifest.webmanifest` + `icon-*.png` | Permite instalarla como app (pantalla completa) |
| `vid1.mp4 … vid5.mp4` | Tus videos, en la misma carpeta que `index.html` |
| `mediapipe/` | Detector de manos local (lo crea el workflow, ver abajo) |
| `.github/workflows/descargar-mediapipe.yml` | Baja `mediapipe/` solo, sin usar la PC |

## Pasos
1. Subí todos los archivos de arriba al repositorio (junto a los videos). Podés borrar `index9.html`.
2. En GitHub: **Add file → Create new file**, escribí el nombre `.github/workflows/descargar-mediapipe.yml` (con las barras) y pegá el contenido del archivo.
3. **Settings → Actions → General → Workflow permissions → Read and write permissions → Save**.
4. Pestaña **Actions → Descargar MediaPipe → Run workflow**. En ~1 minuto aparece la carpeta `mediapipe/` (unos 25 MB).
5. Abrí la página **con WiFi** → ⚙️ Configurar → **Guardar videos y detector para offline**.
6. En Chrome: menú ⋮ → **Instalar app** / **Agregar a pantalla de inicio**. Se abre en pantalla completa y funciona sin internet.

## Cuando cambies algo
Si modificás `index.html`, `style.css` o `app.js`, subí el número `VERSION` en `sw.js` (`'v1'` → `'v2'`). Si cambiás un video, volvé a tocar "Guardar videos…" en ⚙️.

## Si todavía va pesado en el celular
- ⚡ Rendimiento → preset **Mínimo** o **Bajo**; probá también *Procesador del detector = CPU*.
- Reducí los videos a 720p (se ven igual en el celular y pesan mucho menos):
  `ffmpeg -i vid1.mp4 -vf "scale=-2:720" -c:v libx264 -profile:v main -crf 26 -preset slow -r 30 -c:a aac -b:a 96k -movflags +faststart vid1_720.mp4`

## Novedades v2 · Stand CEJA Lidoro Quinteros
- **Foto del corazón** (activada por defecto): marco holográfico, corazón sobre la imagen y el nombre de la escuela (CEJA LIDORO QUINTEROS · SUBSEDE N°1 · LOS RALOS), fecha y número de visitante. Botones **Guardar** y **Compartir** (WhatsApp, etc.).
- **Stand vivo**: cartel superior con la escuela, mensajes rotativos que invitan a los visitantes, vuelta automática al inicio a los 45 s sin actividad.
- **Rendimiento**: vid1.mp4 pasó de 7,6 MB a 4,2 MB; todos los videos con `faststart`. Service worker en `v2`.
- Para cambiar el nombre de la escuela edita la constante `ESCUELA` al inicio de `app.js` y sube `VERSION` en `sw.js`.

## Novedades v3 · Stand vivo
- **3 juegos nuevos**: ⚔️ Corte Ninja (letra L), 🎵 Ritmo Holo (🤘) y 🧠 Memoria Holo (👌). Teclas 6-8.
- **Stand vivo**: saludo cuando aparece una mano, modo atracción (a los 15 s sin nadie pulsa «¡Acércate y juega!»), cartel con récords y visitantes de hoy, contador en el cartel superior y confeti escolar en el cierre.
- Subí el `VERSION` de `sw.js` a `v3`: abrí con WiFi una vez para que se actualice.

## Novedades v5 · Responsive total + rendimiento
- **Se adapta a cualquier pantalla**: celulares chicos (desde 280 px), vertical y horizontal, tablets, notebooks, TV y 4K. Una escala fluida (`--k`, la calcula un mini script en `index.html`) agranda textos y botones en pantallas grandes sin tocar los celulares.
- **El menú siempre entra completo** (12 opciones visibles sin scroll, también en horizontal): la cámara y los botones de abajo ya no tapan ninguna tarjeta.
- Cartel, botones y HUD se reacomodan solos y no se superponen; respetan el notch / barra de gestos (`safe-area`).
- Pantallas de Inicio / Rendimiento / Configuración: ya no se corta la parte de arriba en pantallas bajas (se puede hacer scroll).
- Cierre del corazón y resultado de juegos: caben en cualquier tamaño (el resultado quedaba corrido).
- **Más liviano**: en los presets Mínimo/Bajo y con «Reducir efectos» se quitan todos los desenfoques de vidrio (`backdrop-filter`), que son lo más pesado para un celular modesto.
- **Service worker v5**: la app abre al instante con lo guardado y se actualiza por detrás (la versión nueva se ve en la siguiente apertura).
- Se borró el archivo suelto `.github/workflows/N`.
- Archivos que cambian: `index.html`, `style.css`, `app.js` (2 líneas), `sw.js`, `LEEME.md`. Los videos y el resto no se tocan.

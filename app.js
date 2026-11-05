/* ═══════════════════════════════════════════════════════════════
   CONFIGURACIÓN
   ═══════════════════════════════════════════════════════════════ */
const VIDEOS_DEFAULT = ['./vid1.mp4', './vid2.mp4', './vid3.mp4', './vid4.mp4', './vid5.mp4'];
let VIDEOS = VIDEOS_DEFAULT.slice();
try {
  const s = localStorage.getItem('ia_gestos_videos');
  if (s) { const a = JSON.parse(s); if (Array.isArray(a) && a.length === 5) VIDEOS = a; }
} catch (e) {}

const COMANDOS = {
  'indice':                             { tipo: 'video', valor: 0, nombre: '☝️ Video 1' },
  'indice_medio':                       { tipo: 'video', valor: 1, nombre: '✌️ Video 2' },
  'anular_indice_medio':                { tipo: 'video', valor: 2, nombre: '🖖 Video 3' },
  'menique_pulgar':                     { tipo: 'video', valor: 3, nombre: '🤙 Video 4' },
  'anular_indice_medio_menique_pulgar': { tipo: 'video', valor: 4, nombre: '🖐️ Video 5' },
  'nada':                               { tipo: 'playpause',   nombre: '✊ Play/Pausa' },
  'pulgar_arriba':                      { tipo: 'siguiente',   nombre: '👍 Siguiente' },
  'indice_menique_pulgar':              { tipo: 'fullscreen',  nombre: '🤟 Pantalla completa' },
  'corazon':                            { tipo: 'celebracion', nombre: '💚 Corazón' },
  // juegos
  'indice_pulgar':                      { tipo: 'juego', valor: 'ninja',  nombre: '⚔️ Corte Ninja' },
  'indice_menique':                     { tipo: 'juego', valor: 'ritmo', nombre: '🎵 Ritmo Holo' },
  'anular_medio_menique':               { tipo: 'juego', valor: 'simon', nombre: '🧠 Memoria Holo' },
  'anular_medio_menique_pulgar':        { tipo: 'juego', valor: 'simon', nombre: '🧠 Memoria Holo' }
};
const ESCUELA = ['CEJA LIDORO QUINTEROS', 'SUBSEDE N°1 · LOS RALOS'];
const CMD_SALIR = { tipo: 'salir', nombre: '👍 Menú' };
const CMD_OTRA  = { tipo: 'otra',  nombre: '🔁 Otra vez' };

const PRESETS = {
  minimo: { camWidth: 320, camHeight: 240, maxFps: 8,  overlayQuality: 'off',  reduceEffects: true,  ambilight: false, duracionEstableMs: 900, minFramesEstables: 3, canvasScale: 0.6 },
  bajo:   { camWidth: 320, camHeight: 240, maxFps: 12, overlayQuality: 'low',  reduceEffects: true,  ambilight: false, duracionEstableMs: 750, minFramesEstables: 3, canvasScale: 0.8 },
  medio:  { camWidth: 480, camHeight: 360, maxFps: 20, overlayQuality: 'full', reduceEffects: false, ambilight: false, duracionEstableMs: 600, minFramesEstables: 3, canvasScale: 1 },
  alto:   { camWidth: 640, camHeight: 480, maxFps: 30, overlayQuality: 'full', reduceEffects: false, ambilight: true,  duracionEstableMs: 500, minFramesEstables: 4, canvasScale: 1 }
};

/* Valores iniciales pensados para celulares modestos (tipo Moto E40).
   En modo "auto" se ajustan solos según el hardware y la velocidad real medida. */
const CONFIG = {
  preset: 'auto',
  duracionEstableMs: 750, minFramesEstables: 3, cooldownMs: 1200, framesReset: 8,
  camWidth: 320, camHeight: 240, maxFps: 12,
  maxNumHands: 2, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5,
  overlayQuality: 'low', reduceEffects: true, ambilight: false, canvasScale: 0.8,
  mpCdn: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14',
  modeloUrl: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  delegado: 'GPU', inactividadS: 45,
  sonidos: true, recuerdo: true, nombre: 'visitante', cierre1: 'gracias por visitar', cierre2: 'nuestro stand ✨',
  duracionJuego: 40,
  facing: 'user'   // 'user' = frontal · 'environment' = trasera
};

let hayConfigGuardada = false;
try {
  const sc = localStorage.getItem('ia_gestos_config_v5');
  if (sc) {
    hayConfigGuardada = true;
    const o = JSON.parse(sc);
    Object.keys(o).forEach(k => { if (k in CONFIG && k !== 'mpCdn' && k !== 'modeloUrl') CONFIG[k] = o[k]; });
  }
} catch (e) {}

function detectarCapacidad() {
  const cores = navigator.hardwareConcurrency || 2;
  const mem = navigator.deviceMemory || 2;   // Chrome lo limita a 8 GB como máximo
  if (cores <= 2 || mem <= 1) return 'minimo';
  if (cores <= 4 || mem <= 4) return 'bajo';  // 4 GB o menos: cuidamos CPU/GPU
  if (cores <= 6) return 'medio';
  return 'alto';
}

/* ═══════════════════════════════════════════════════════════════
   ESTADO Y ELEMENTOS (todo cacheado una vez)
   ═══════════════════════════════════════════════════════════════ */
const estado = {
  hands: null, corriendo: false, indiceVideo: 0,
  gestoActual: null, gestoStartTime: 0, framesEstables: 0,
  esperandoNeutro: false, comandoEjecutado: null,
  framesSinManos: 0, ultimaAccion: 0, esFullscreen: false,
  welcomeVisible: false, activeCam: null,
  fpsSamples: [], ultimoCorazon: 0, _timerCorazon: null,
  fallos: 0, fallosNeutro: 0, ultimaMano: 0, delegadoUsado: '',
  juego: null, juegoVideoEstaba: false, muted: false, manoPos: null
};

const $ = id => document.getElementById(id);
const E = {
  fps: $('fps'), gesto: $('gestoActual'), videoAct: $('videoActual'),
  progreso: $('progreso'), progTxt: $('progresoTexto'), progFill: $('progresoFill'),
  reticula: $('reticula'), retAro: $('retAro'), retEmoji: $('retEmoji'), retTxt: $('retTxt'),
  welcome: $('welcome'), celeb: $('celebracion'), stage: $('videoStage'), ambi: $('ambi'),
  msg: $('mensajeVideo'), toast: $('toast'), btnMute: $('btnMute'), btnFull: $('btnFull'),
  jUI: $('juegoUI'), jTop: $('jTop'), jPuntos: $('jPuntos'), jBarra: $('jBarra'), jCombo: $('jCombo'),
  jCuenta: $('jCuenta'), jTitulo: $('jTitulo'), jRes: $('jResultado')
};
const cam = $('cam'), canvas = $('overlay'), camPiP = $('camPiP');
const ctx = canvas.getContext('2d', { alpha: true });
let vFront = $('video'), vBack = $('video2');

/* Espejo: la cámara frontal se muestra espejada (como un espejo), la trasera no.
   dX() convierte la x de MediaPipe (0..1) a la x que se ve en pantalla. */
const ESP = { on: true };
const dX = x => ESP.on ? 1 - x : x;

let cw = 0, ch = 0, fps = 0, framesFps = 0, tFps = performance.now(), lastSend = 0;
let lastHudGesto = '', lastProgressPct = -1, lastProgressTexto = '';
let msInf = 0, tsLast = 0, lastTick = 0, pendiente = false, ultimoReinicio = 0, wl = null;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);

const setEstado = m => { const e = $('estado'); if (e) e.textContent = m; };
const setError  = m => { const e = $('error');  if (e) e.textContent = m; };

function ajustarCanvas() {
  const r = canvas.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return;
  const s = CONFIG.canvasScale || 1;
  cw = canvas.width  = Math.max(1, Math.round(r.width * s));
  ch = canvas.height = Math.max(1, Math.round(r.height * s));
}
window.addEventListener('resize', ajustarCanvas);
window.addEventListener('orientationchange', () => setTimeout(ajustarCanvas, 300));
camPiP.addEventListener('transitionend', e => { if (e.propertyName === 'width') ajustarCanvas(); });

let toastT = 0;
function toast(t) {
  E.toast.textContent = t; E.toast.classList.add('v');
  clearTimeout(toastT); toastT = setTimeout(() => E.toast.classList.remove('v'), 1300);
}

/* ═══════════════════════════════════════════════════════════════
   PRESETS / CONFIG
   ═══════════════════════════════════════════════════════════════ */
function aplicarEfectos() {
  document.body.classList.toggle('reduce-effects', !!CONFIG.reduceEffects || matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function aplicarPreset(nombre, silencioso) {
  const camAntes = CONFIG.camWidth + 'x' + CONFIG.camHeight;
  let usado = nombre;
  if (nombre === 'auto') {
    if (silencioso) { CONFIG.preset = 'auto'; return; }
    usado = detectarCapacidad();
  }
  const p = PRESETS[usado];
  if (!p) return;
  Object.assign(CONFIG, p);
  CONFIG.preset = nombre;
  aplicarEfectos(); ajustarCanvas(); gResize(true);
  if (!silencioso) {
    const info = $('rendInfo');
    if (info) info.textContent = nombre === 'auto'
      ? 'Auto: hardware detectado → ' + usado + '. Se ajustará tras medir el rendimiento real.'
      : 'Preset "' + nombre + '" aplicado.';
    if (estado.corriendo && camAntes !== CONFIG.camWidth + 'x' + CONFIG.camHeight) reiniciarCamaraSolo();
  }
  sincronizarUI(); guardarConfig();
}

function guardarConfig() { try { localStorage.setItem('ia_gestos_config_v5', JSON.stringify(CONFIG)); } catch (e) {} }

let autoTimer = null;
function iniciarAutoDeteccion() {
  if (autoTimer) clearInterval(autoTimer);
  if (CONFIG.preset !== 'auto') return;
  estado.fpsSamples = [];
  autoTimer = setInterval(() => {
    if (!estado.corriendo) return;
    if (msInf > 0) estado.fpsSamples.push(msInf);
    if (estado.fpsSamples.length >= 5) {
      clearInterval(autoTimer); autoTimer = null;
      const prom = estado.fpsSamples.reduce((a, b) => a + b, 0) / estado.fpsSamples.length;
      const elegido = prom < 12 ? 'alto' : prom < 25 ? 'medio' : prom < 45 ? 'bajo' : 'minimo';
      aplicarPreset(elegido, true);
      CONFIG.preset = 'auto';
      guardarConfig();
      const info = $('rendInfo');
      if (info) info.textContent = 'Auto: ' + Math.round(prom) + ' ms/frame medidos → ajustado a "' + elegido + '".';
    }
  }, 1000);
}

/* ═══════════════════════════════════════════════════════════════
   PROYECCIÓN / ANÁLISIS DE MANOS
   ═══════════════════════════════════════════════════════════════ */
function proy(lm) {
  const vw = cam.videoWidth || 640, vh = cam.videoHeight || 480;
  const sc = Math.max(cw / vw, ch / vh);
  const dw = vw * sc, dh = vh * sc;
  const px = (cw - dw) / 2 + lm.x * dw;
  return { x: ESP.on ? cw - px : px, y: (ch - dh) / 2 + lm.y * dh };
}
function dist2D(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function aPx(lm) {
  const vw = cam.videoWidth || 640, vh = cam.videoHeight || 480;
  return lm.map(p => ({ x: p.x * vw, y: p.y * vh }));
}

function analizarMano(lm) {
  const w = lm[0], umbral = 1.12;
  const indice  = dist2D(lm[8],  w) > dist2D(lm[6],  w) * umbral;
  const medio   = dist2D(lm[12], w) > dist2D(lm[10], w) * umbral;
  const anular  = dist2D(lm[16], w) > dist2D(lm[14], w) * umbral;
  const menique = dist2D(lm[20], w) > dist2D(lm[18], w) * umbral;
  const pulgar  = dist2D(lm[4], lm[5]) > dist2D(lm[3], lm[5]) * 1.35;
  const pulgarArriba = pulgar && !indice && !medio && !anular && !menique && lm[4].y < lm[2].y - dist2D(w, lm[9]) * 0.12;
  if (pulgarArriba) return { patron: 'pulgar_arriba', dedos: 1 };
  const ext = [];
  if (indice) ext.push('indice');
  if (medio) ext.push('medio');
  if (anular) ext.push('anular');
  if (menique) ext.push('menique');
  if (pulgar) ext.push('pulgar');
  ext.sort();
  return { patron: ext.length === 0 ? 'nada' : ext.join('_'), dedos: ext.length };
}

function detectarCorazon(manos) {
  if (!manos || manos.length < 2) return false;
  const m1 = manos[0], m2 = manos[1];
  const avgSize = (dist2D(m1[0], m1[9]) + dist2D(m2[0], m2[9])) / 2;
  if (avgSize < 0.01) return false;
  const i1 = m1[8], i2 = m2[8], t1 = m1[4], t2 = m2[4];
  const dIdxIdx = dist2D(i1, i2), dThumbThumb = dist2D(t1, t2);
  const manosJuntas = dist2D(m1[0], m2[0]) < avgSize * 3.6;
  const cercaIdx = dIdxIdx < avgSize * 0.65, cercaThumb = dThumbThumb < avgSize * 0.65;
  const avgIdxY = (i1.y + i2.y) / 2, avgThumbY = (t1.y + t2.y) / 2;
  const apuntaArriba = avgIdxY < avgThumbY - avgSize * 0.12;
  const avgWristY = (m1[0].y + m2[0].y) / 2;
  const manosArriba = avgIdxY < avgWristY && avgThumbY < avgWristY;
  const formaCurva = (dist2D(i1, t1) > dIdxIdx * 0.7) && (dist2D(i2, t2) > dIdxIdx * 0.7);
  return cercaIdx && cercaThumb && manosJuntas && apuntaArriba && manosArriba && formaCurva;
}

/* Comando según contexto: dentro de un juego solo valen salir / otra vez / corazón */
function cmdPara(p) {
  if (!p) return null;
  if (estado.juego) {
    if (p === 'pulgar_arriba') return CMD_SALIR;
    if (p === 'corazon') return COMANDOS.corazon;
    if (G.fase === 'fin' && p === 'anular_indice_medio_menique_pulgar') return CMD_OTRA;
    return null;
  }
  return COMANDOS[p] || null;
}

/* ═══════════════════════════════════════════════════════════════
   LÓGICA DE GESTOS (basada en TIEMPO)
   ═══════════════════════════════════════════════════════════════ */
function procesarPatron(patron) {
  const ahora = performance.now();
  if (estado.esperandoNeutro) {
    if (patron === estado.comandoEjecutado) { estado.fallosNeutro = 0; return; }
    if (++estado.fallosNeutro < 4) return;
    estado.esperandoNeutro = false; estado.comandoEjecutado = null;
  }
  if (patron && patron === estado.gestoActual) { estado.framesEstables++; estado.fallos = 0; }
  else if (estado.gestoActual && estado.fallos < 2) { estado.fallos++; }
  else { estado.gestoActual = patron; estado.framesEstables = patron ? 1 : 0; estado.fallos = 0; estado.gestoStartTime = ahora; }
  if (!patron || patron !== estado.gestoActual) return;

  if (estado.framesEstables < CONFIG.minFramesEstables || ahora - estado.gestoStartTime < CONFIG.duracionEstableMs) return;
  const cmd = cmdPara(patron);
  if (!cmd || ahora - estado.ultimaAccion <= CONFIG.cooldownMs) return;
  if (cmd.tipo === 'celebracion') {
    if (ahora - (estado.ultimoCorazon || 0) < 20000) return;
    estado.ultimoCorazon = ahora;
  }
  if (estado.welcomeVisible && (cmd.tipo === 'video' || cmd.tipo === 'siguiente' || cmd.tipo === 'celebracion' || cmd.tipo === 'juego')) ocultarBienvenida();
  ejecutarComando(cmd);
  estado.ultimaAccion = ahora;
  estado.esperandoNeutro = true; estado.comandoEjecutado = patron; estado.fallosNeutro = 0;
  estado.framesEstables = 0; estado.gestoStartTime = ahora;
}

function ejecutarComando(cmd) {
  if (cmd.tipo !== 'celebracion') sonido('ok');
  switch (cmd.tipo) {
    case 'video': cambiarVideo(cmd.valor, 0); break;
    case 'playpause': togglePlay(); break;
    case 'siguiente': siguienteVideo(); break;
    case 'fullscreen': toggleFullscreen(); break;
    case 'celebracion': mostrarCorazon(); break;
    case 'juego': iniciarJuego(cmd.valor); break;
    case 'salir': salirJuego(); break;
    case 'otra': iniciarJuego(G.modo); break;
  }
}

async function toggleFullscreen() {
  if (document.fullscreenElement || estado.esFullscreen) {
    if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch (e) {} }
    if (!document.fullscreenElement) {
      estado.esFullscreen = false; camPiP.classList.remove('fullscreen');
      actualizarBotonFull(); setTimeout(ajustarCanvas, 380);
    }
    return;
  }
  try {
    const el = document.documentElement;
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else throw new Error('API no disponible');
  } catch (e) {
    estado.esFullscreen = true; camPiP.classList.add('fullscreen');
    actualizarBotonFull(); setTimeout(ajustarCanvas, 380);
  }
}
function actualizarBotonFull() { E.btnFull.textContent = estado.esFullscreen ? '🔲' : '🔳'; }
function sincronizarFullscreen() {
  estado.esFullscreen = !!document.fullscreenElement;
  camPiP.classList.toggle('fullscreen', estado.esFullscreen);
  actualizarBotonFull();
  if (estado.esFullscreen) $('ayuda').classList.remove('visible');
  setTimeout(() => { ajustarCanvas(); gResize(); fxTam(); }, 380);
}
document.addEventListener('fullscreenchange', sincronizarFullscreen);
document.addEventListener('webkitfullscreenchange', sincronizarFullscreen);

function mostrarBienvenida() {
  estado.welcomeVisible = true;
  document.body.classList.add('en-bienvenida');
  E.welcome.classList.remove('oculto');
  gAmbiente(true);
}
function ocultarBienvenida() {
  if (!estado.welcomeVisible) return;
  estado.welcomeVisible = false;
  document.body.classList.remove('en-bienvenida');
  E.welcome.classList.add('oculto');
  gAmbiente(false);
}

/* ═══════════════════════════════════════════════════════════════
   VIDEO CON TRANSICIONES (doble buffer, Web Animations API)
   ═══════════════════════════════════════════════════════════════ */
const HAS_WAAPI = typeof Element.prototype.animate === 'function';
const HAS_MASK = !!(window.CSS && CSS.supports && (CSS.supports('mask-image', 'linear-gradient(#000,#000)') || CSS.supports('-webkit-mask-image', 'linear-gradient(#000,#000)')));
const HAS_PROP = !!(window.CSS && CSS.registerProperty);
const an = (el, kf, o) => el.animate(kf, Object.assign({ fill: 'both', easing: 'cubic-bezier(.65,0,.25,1)' }, o));

const TRANS = [
  { n: 'Iris', i: '🌀', lite: 1, d: 900,
    f: (e, s, o) => [an(e, [{ clipPath: `circle(0% at ${o.x}% ${o.y}%)` }, { clipPath: `circle(150% at ${o.x}% ${o.y}%)` }], { duration: 900 })] },
  { n: 'Corazón', i: '💚', ok: HAS_MASK, mask: 'm-corazon', d: 1000,
    f: e => [an(e, [{ maskSize: '0vmax 0vmax', webkitMaskSize: '0vmax 0vmax' }, { maskSize: '320vmax 320vmax', webkitMaskSize: '320vmax 320vmax' }], { duration: 1000, easing: 'cubic-bezier(.5,0,.3,1)' })] },
  { n: 'Cortina', i: '🎞️', lite: 1, d: 800,
    f: (e, s, o) => {
      const kf = o.dir > 0
        ? [{ clipPath: 'polygon(-100% 0%, 0% 0%, -30% 100%, -100% 100%)' }, { clipPath: 'polygon(-100% 0%, 130% 0%, 100% 100%, -100% 100%)' }]
        : [{ clipPath: 'polygon(200% 0%, 100% 0%, 130% 100%, 200% 100%)' }, { clipPath: 'polygon(200% 0%, -30% 0%, 0% 100%, 200% 100%)' }];
      return [an(e, kf, { duration: 800 })];
    } },
  { n: 'Zoom', i: '🚀', d: 900,
    f: (e, s) => [
      an(s, [{ transform: 'scale(1)', filter: 'blur(0px)', opacity: 1 }, { transform: 'scale(2.4)', filter: 'blur(14px)', opacity: 0 }], { duration: 900, easing: 'cubic-bezier(.5,0,.9,.4)' }),
      an(e, [{ transform: 'scale(.5)', filter: 'blur(14px)', opacity: 0 }, { transform: 'scale(1)', filter: 'blur(0px)', opacity: 1 }], { duration: 900, easing: 'cubic-bezier(.2,.7,.2,1)' })
    ] },
  { n: 'Glitch', i: '📺', d: 750,
    f: (e, s) => {
      const sl = () => { const a = (Math.random() * 70) | 0, b = a + 8 + ((Math.random() * 25) | 0); return `inset(${a}% 0 ${Math.max(0, 100 - b)}% 0)`; };
      const kfe = [{ opacity: 0, offset: 0 }];
      for (let i = 1; i < 8; i++) kfe.push({ opacity: 1, clipPath: sl(), transform: `translateX(${((Math.random() - .5) * 8).toFixed(1)}%)`, filter: `hue-rotate(${(Math.random() * 360) | 0}deg) saturate(3)`, offset: i / 8, easing: 'steps(1)' });
      kfe.push({ opacity: 1, clipPath: 'inset(0% 0% 0% 0%)', transform: 'none', filter: 'none', offset: 1 });
      return [
        an(e, kfe, { duration: 750, easing: 'linear' }),
        an(s, [{ filter: 'none', opacity: 1, offset: 0 }, { filter: 'hue-rotate(120deg) contrast(1.6)', opacity: 1, offset: .4, easing: 'steps(1)' }, { filter: 'none', opacity: 1, offset: .75 }, { opacity: 0, offset: 1 }], { duration: 750, easing: 'linear' })
      ];
    } },
  { n: 'Giro 3D', i: '🎲', persp: 1, d: 950,
    f: (e, s, o) => {
      const a = 90 * o.dir;
      return [
        an(s, [{ transform: 'rotateY(0deg)', opacity: 1, offset: 0 }, { transform: `rotateY(${-a}deg)`, opacity: 1, offset: .5 }, { transform: `rotateY(${-a}deg)`, opacity: 0, offset: 1 }], { duration: 950, easing: 'ease-in-out' }),
        an(e, [{ transform: `rotateY(${a}deg)`, opacity: 0, offset: 0 }, { transform: `rotateY(${a}deg)`, opacity: 0, offset: .5 }, { transform: 'rotateY(0deg)', opacity: 1, offset: 1 }], { duration: 950, easing: 'ease-in-out' })
      ];
    } },
  { n: 'Empuje', i: '👋', lite: 1, d: 650,
    f: (e, s, o) => [
      an(s, [{ transform: 'translateX(0%)', filter: CONFIG.reduceEffects ? 'none' : 'blur(0px)' }, { transform: `translateX(${-o.dir * 100}%)`, filter: CONFIG.reduceEffects ? 'none' : 'blur(5px)' }], { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)' }),
      an(e, [{ transform: `translateX(${o.dir * 100}%)` }, { transform: 'translateX(0%)' }], { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)' })
    ] },
  { n: 'Espiral', i: '🌪️', d: 1000,
    f: (e, s) => [
      an(e, [{ transform: 'rotate(-270deg) scale(0)', opacity: 0, borderRadius: '50%' }, { transform: 'rotate(0deg) scale(1)', opacity: 1, borderRadius: '0%' }], { duration: 1000, easing: 'cubic-bezier(.3,.8,.3,1)' }),
      an(s, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: .75 }, { opacity: 0, offset: 1 }], { duration: 1000, easing: 'linear' })
    ] },
  { n: 'Persianas', i: '🪟', ok: HAS_MASK && HAS_PROP, mask: 'm-persianas', d: 900,
    f: e => [an(e, [{ '--b': '0%' }, { '--b': '12.6%' }], { duration: 900 })] }
];
const T_EMPUJE = TRANS.find(t => t.n === 'Empuje');
let trUltima = '', trFin = null, cambioTok = 0;

function elegirTrans() {
  const lista = TRANS.filter(t => t.ok !== false && (!CONFIG.reduceEffects || t.lite));
  let t;
  do { t = lista[(Math.random() * lista.length) | 0]; } while (lista.length > 1 && t.n === trUltima);
  trUltima = t.n;
  return t;
}

function fadeVol(el, a, b, ms) {
  const t0 = performance.now();
  (function paso() {
    const k = Math.min(1, (performance.now() - t0) / ms);
    try { el.volume = a + (b - a) * k; } catch (e) {}
    if (k < 1) requestAnimationFrame(paso);
  })();
}

/* dir: 0 = transición aleatoria · ±1 = empuje (deslizar) */
function cambiarVideo(idx, dir) {
  if (idx < 0 || idx >= VIDEOS.length) return;
  const url = (VIDEOS[idx] || '').trim();
  if (!url) { mostrarMensaje('Video ' + (idx + 1) + ' sin URL'); return; }
  if (trFin) trFin();
  estado.indiceVideo = idx;
  E.videoAct.textContent = idx + 1;

  const sale = vFront, entra = vBack, habia = !!sale.getAttribute('src');
  const tok = ++cambioTok;
  let listo = false, to = 0;

  entra.style.display = 'block'; entra.style.visibility = 'hidden'; entra.style.zIndex = 2;
  entra.muted = estado.muted;
  try { entra.volume = 0; } catch (e) {}
  entra.src = url;

  const fallo = () => {
    if (listo || tok !== cambioTok) return;
    listo = true; clearTimeout(to);
    entra.removeEventListener('loadeddata', go);
    entra.removeAttribute('src'); entra.load(); entra.style.display = 'none';
    toast('⚠️ No se pudo cargar Video ' + (idx + 1));
    if (!habia) mostrarMensaje('No se pudo cargar Video ' + (idx + 1) + '. Revisa su URL en ⚙️ Configurar.');
  };
  function go() {
    if (listo || tok !== cambioTok) return;
    listo = true; clearTimeout(to);
    entra.removeEventListener('loadeddata', go);
    entra.removeEventListener('error', fallo);
    lanzar();
  }
  function lanzar() {
    const T = dir ? T_EMPUJE : elegirTrans();
    const o = { dir: dir || (Math.random() < .5 ? 1 : -1), x: rnd(25, 75), y: rnd(30, 70) };
    const mp = estado.manoPos;
    if (mp && performance.now() - mp.t < 1500) { o.x = clamp(mp.x, 15, 85); o.y = clamp(mp.y, 20, 80); }

    entra.style.visibility = 'visible'; entra.style.zIndex = 2; sale.style.zIndex = 1;
    if (T.mask) entra.classList.add(T.mask);
    if (T.persp) E.stage.style.perspective = '1400px';
    vFront = entra; vBack = sale;
    ocultarMensaje();
    E.stage.classList.add('loading'); setTimeout(() => E.stage.classList.remove('loading'), 700);

    entra.play().then(actualizarBotonMute).catch(e => {
      if (e && e.name === 'AbortError') return;
      entra.muted = true; estado.muted = true;
      entra.play().then(actualizarBotonMute).catch(() => toast('⚠️ No se pudo reproducir Video ' + (idx + 1)));
    });
    if (habia) { fadeVol(sale, 1, 0, T.d * .8); }
    fadeVol(entra, 0, 1, T.d);
    sonido('whoosh');
    if (!CONFIG.reduceEffects) { fxExplosion(o.x, o.y, dir ? 20 : 36); toast(T.i + ' ' + T.n); }

    const anims = HAS_WAAPI ? T.f(entra, sale, o) : [];
    let hecho = false;
    const fin = () => {
      if (hecho) return; hecho = true;
      anims.forEach(a => { try { a.cancel(); } catch (e) {} });
      entra.classList.remove('m-corazon', 'm-persianas');
      E.stage.style.perspective = '';
      try { sale.pause(); } catch (e) {}
      sale.removeAttribute('src'); sale.load(); sale.style.display = 'none';
      try { sale.volume = 1; entra.volume = 1; } catch (e) {}
      entra.style.zIndex = 2; trFin = null;
    };
    trFin = fin;
    if (anims.length) Promise.all(anims.map(a => a.finished)).then(fin, fin); else fin();
    setTimeout(fin, T.d + 600);
  }
  entra.addEventListener('loadeddata', go);
  entra.addEventListener('error', fallo, { once: true });
  to = setTimeout(go, 2500);
}

function siguienteVideo() { cambiarVideo(vFront.getAttribute('src') ? (estado.indiceVideo + 1) % VIDEOS.length : 0, 0); }
function togglePlay() {
  if (!vFront.getAttribute('src')) return;
  if (vFront.paused) vFront.play().catch(() => {}); else vFront.pause();
}
function mostrarMensaje(m) { E.msg.textContent = m; E.msg.classList.remove('oculto'); }
function ocultarMensaje() { E.msg.classList.add('oculto'); }
function actualizarBotonMute() { E.btnMute.textContent = estado.muted ? '🔇' : '🔊'; }
function setMute(m) { estado.muted = m; vFront.muted = m; vBack.muted = m; actualizarBotonMute(); }

/* Deslizar con puntero / dedo sobre el escenario */
(function () {
  let p0 = null;
  E.stage.addEventListener('pointerdown', e => { p0 = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  E.stage.addEventListener('pointerup', e => {
    if (!p0 || estado.juego || !vFront.getAttribute('src')) { p0 = null; return; }
    const dx = e.clientX - p0.x, dy = e.clientY - p0.y, dt = performance.now() - p0.t;
    p0 = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && dt < 900) {
      const n = VIDEOS.length;
      cambiarVideo(dx < 0 ? (estado.indiceVideo + 1) % n : (estado.indiceVideo + n - 1) % n, dx < 0 ? 1 : -1);
    }
  });
})();

/* ═══════════════════════════════════════════════════════════════
   OVERLAY DE LA CÁMARA (PiP)
   ═══════════════════════════════════════════════════════════════ */
const CONEXIONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
const CF = Uint8Array.from(CONEXIONES.flat());
const COLORES = ['#38ffb0', '#00d1ff'];

function rrect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function dibujarMano(lm, idx, esActiva, patron, esCorazon) {
  if (CONFIG.overlayQuality === 'off') return;
  const color = esCorazon ? '#ff4d9d' : COLORES[idx % COLORES.length];
  const pts = lm.map(proy);
  const gr = Math.max(1.5, Math.round(cw / 180)), rad = Math.max(1.8, gr * 1.4);
  const low = CONFIG.overlayQuality === 'low';

  if (!low) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = color; ctx.lineWidth = gr;
    ctx.globalAlpha = esActiva ? 0.9 : 0.35;
    ctx.beginPath();
    for (let i = 0; i < CF.length; i += 2) { const a = pts[CF[i]], b = pts[CF[i + 1]]; ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    ctx.stroke();
  }
  ctx.globalAlpha = esActiva ? 1 : 0.45;
  ctx.fillStyle = color;
  ctx.beginPath();
  if (low) {
    const idxs = [0, 8, 12, 16, 20];
    for (let k = 0; k < idxs.length; k++) { const p = pts[idxs[k]], r = rad * 1.1; ctx.moveTo(p.x + r, p.y); ctx.arc(p.x, p.y, r, 0, 6.2832); }
  } else {
    for (let i = 0; i < pts.length; i++) { const r = i === 0 ? rad * 1.3 : rad; ctx.moveTo(pts[i].x + r, pts[i].y); ctx.arc(pts[i].x, pts[i].y, r, 0, 6.2832); }
  }
  ctx.fill();

  if (!low && cw > 120) {
    let minY = Infinity, sx = 0;
    for (const p of pts) if (p.y < minY) { minY = p.y; sx = p.x; }
    const cmd = cmdPara(patron);
    const txt = esCorazon ? '💚 Corazón' : (cmd ? cmd.nombre : (patron === 'nada' ? '✊' : '· ' + (patron || '—')));
    etiqueta(txt, sx, minY, color);
  }
  ctx.globalAlpha = 1;
}

function etiqueta(texto, x, y, color) {
  const fs = Math.max(9, Math.round(cw / 22)), pad = Math.round(fs * 0.5);
  ctx.font = '600 ' + fs + 'px -apple-system,sans-serif';
  const w = ctx.measureText(texto).width + pad * 2, h = fs + pad * 2;
  const bx = Math.max(2, Math.min(cw - w - 2, x - w / 2));
  let by = y - h - 6; if (by < 2) by = y + 8;
  ctx.fillStyle = 'rgba(4,10,18,.85)'; rrect(bx, by, w, h, 5); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1; rrect(bx, by, w, h, 5); ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(texto, bx + pad, by + h / 2);
}

/* ═══════════════════════════════════════════════════════════════
   CELEBRACIÓN DE CIERRE
   ═══════════════════════════════════════════════════════════════ */
function mostrarCorazon() {
  if (!E.celeb) return;
  if (estado.juego) salirJuego(true);
  const path = E.celeb.querySelector('.trazo-corazon');
  if (path) { path.style.animation = 'none'; void path.offsetHeight; path.style.animation = ''; }
  tomarRecuerdo();
  E.celeb.classList.remove('oculto');
  fx.c.classList.add('top'); fxCorazon(); confeti(); sonido('corazon'); contarVisita();
  const nv = $('visitanteN'); if (nv) nv.textContent = 'Visitante N.º ' + leerVisitas().hoy + ' de hoy';
  clearTimeout(estado._timerCorazon);
  estado._timerCorazon = setTimeout(ocultarCorazon, CONFIG.recuerdo ? 22000 : 9000);
}
function ocultarCorazon() {
  const estabaVisible = !E.celeb.classList.contains('oculto');
  E.celeb.classList.add('oculto');
  fx.c.classList.remove('top');
  $('recuerdo').hidden = true; $('recImg').removeAttribute('src');
  clearTimeout(estado._timerCorazon);
  if (estabaVisible) volverInicio();
}
E.celeb.addEventListener('click', ocultarCorazon);

/* ═══════════════════════════════════════════════════════════════
   RESULTADOS MEDIAPIPE
   ═══════════════════════════════════════════════════════════════ */
function onResults(res) {
  framesFps++;
  const ahora = performance.now();
  if (ahora - tFps >= 1000) {
    fps = Math.round(framesFps * 1000 / (ahora - tFps));
    framesFps = 0; tFps = ahora;
    E.fps.textContent = fps + ' · ' + Math.round(msInf) + 'ms';
  }
  if (!cw || !ch) ajustarCanvas();

  if (CONFIG.overlayQuality !== 'off') ctx.clearRect(0, 0, cw, ch);
  else if (canvas._dirty) { ctx.clearRect(0, 0, cw, ch); canvas._dirty = false; }

  let manos = res.landmarks || [];
  let pxs = manos.map(aPx);
  if (manos.length === 2 && dist2D(pxs[0][0], pxs[1][0]) < dist2D(pxs[0][0], pxs[0][9]) * 0.3) { manos = [manos[0]]; pxs = [pxs[0]]; }
  if (manos.length) {
    estado.ultimaMano = ahora;
    estado.manoPos = { x: dX(manos[0][9].x) * 100, y: manos[0][9].y * 100, t: ahora };
  }
  if (G.modo) gRecibir(manos, ahora);

  const analisis = pxs.map(analizarMano);
  let patronCombinado = null, coinciden = false, esCorazon = false;

  if (manos.length >= 2) {
    if (detectarCorazon(pxs)) { patronCombinado = 'corazon'; coinciden = true; esCorazon = true; }
    else if (analisis[0].patron === analisis[1].patron) { patronCombinado = analisis[0].patron; coinciden = true; }
  }

  if (CONFIG.overlayQuality !== 'off') {
    for (let i = 0; i < manos.length; i++) dibujarMano(manos[i], i, coinciden, analisis[i].patron, esCorazon);
    if (manos.length) canvas._dirty = true;
    if (!G.modo) fxManos(manos, esCorazon, coinciden);
  }

  if (manos.length === 1 && !estado.juego) detectarSwipe(manos[0], analisis[0].dedos, ahora); else swipeH.length = 0;

  if (manos.length < 2) {
    estado.framesSinManos++;
    if (estado.framesSinManos > CONFIG.framesReset) {
      estado.esperandoNeutro = false; estado.comandoEjecutado = null;
      estado.gestoActual = null; estado.framesEstables = 0;
    }
    const txt = manos.length === 1 ? '🙌 Falta 1 mano' : '—';
    if (lastHudGesto !== txt) { E.gesto.textContent = txt; lastHudGesto = txt; }
    camPiP.classList.remove('gesture-active');
    camPiP.classList.toggle('waiting', manos.length === 0);
    actualizarProgreso(null, manos.length);
    return;
  }
  estado.framesSinManos = 0;
  camPiP.classList.remove('waiting');

  const cmd = patronCombinado ? cmdPara(patronCombinado) : null;
  const txtGesto = coinciden ? (cmd ? cmd.nombre : '· ' + patronCombinado) : '❓ Gestos distintos';
  if (lastHudGesto !== txtGesto) { E.gesto.textContent = txtGesto; lastHudGesto = txtGesto; }

  camPiP.classList.toggle('gesture-active', !!(coinciden && cmd && estado.framesEstables >= 2 && !estado.esperandoNeutro));
  procesarPatron(coinciden ? patronCombinado : null);
  actualizarProgreso(patronCombinado, manos.length);
}

let lastProgressUpdate = 0;
function actualizarProgreso(patron, numManos) {
  const ahora = performance.now();
  if (ahora - lastProgressUpdate < 80) return;
  lastProgressUpdate = ahora;
  const box = E.progreso;

  if (numManos < 2) {
    if (estado.juego) { box.classList.remove('visible'); ocultarReticula(); return; }
    box.classList.add('visible'); ocultarReticula();
    const t = numManos === 1 ? '🙌 Muestra la otra mano' : '🙌 Muestra ambas manos';
    if (lastProgressTexto !== t) { E.progTxt.textContent = t; lastProgressTexto = t; }
    if (lastProgressPct !== 0) { E.progFill.style.transform = 'scaleX(0)'; lastProgressPct = 0; }
    return;
  }
  const cmd = cmdPara(patron);
  if (!cmd || estado.esperandoNeutro || estado.gestoActual !== patron) { box.classList.remove('visible'); ocultarReticula(); return; }
  box.classList.add('visible');
  const pct = Math.min(100, ((ahora - estado.gestoStartTime) / CONFIG.duracionEstableMs) * 100);
  const pctInt = Math.round(pct);
  mostrarReticula(cmd, pct);
  const t = cmd.nombre + ' · ' + pctInt + '%';
  if (lastProgressTexto !== t) { E.progTxt.textContent = t; lastProgressTexto = t; }
  if (lastProgressPct !== pctInt) { E.progFill.style.transform = 'scaleX(' + (pct / 100) + ')'; lastProgressPct = pctInt; }
}

/* ═══════════════════════════════════════════════════════════════
   MEDIAPIPE
   ═══════════════════════════════════════════════════════════════ */
let handsPromise = null;
function cargarMediaPipe() {
  if (handsPromise) return handsPromise;
  handsPromise = (async () => {
    const fuentes = [
      { js: './mediapipe/vision_bundle.mjs', wasm: './mediapipe/wasm', modelo: './mediapipe/hand_landmarker.task' },
      { js: CONFIG.mpCdn + '/vision_bundle.mjs', wasm: CONFIG.mpCdn + '/wasm', modelo: CONFIG.modeloUrl }
    ];
    for (const f of fuentes) {
      try {
        const mod = await import(f.js);
        const fileset = await mod.FilesetResolver.forVisionTasks(f.wasm);
        const crear = d => mod.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: f.modelo, delegate: d },
          runningMode: 'VIDEO', numHands: CONFIG.maxNumHands,
          minHandDetectionConfidence: CONFIG.minDetectionConfidence,
          minHandPresenceConfidence: CONFIG.minDetectionConfidence,
          minTrackingConfidence: CONFIG.minTrackingConfidence
        });
        try { estado.hands = await crear(CONFIG.delegado); estado.delegadoUsado = CONFIG.delegado; }
        catch (e) {
          if (CONFIG.delegado === 'CPU') throw e;
          estado.hands = await crear('CPU'); estado.delegadoUsado = 'CPU';
        }
        return;
      } catch (e) { console.warn('Fuente MediaPipe falló:', f.js, e); }
    }
    handsPromise = null;
    throw new Error('No se pudo cargar MediaPipe. Revisa tu conexión o copia la carpeta ./mediapipe para uso sin internet.');
  })();
  return handsPromise;
}
async function recrearDetector() {
  const prev = estado.hands; estado.hands = null; handsPromise = null;
  try { await cargarMediaPipe(); if (prev && prev.close) prev.close(); }
  catch (e) { estado.hands = prev; }
}

/* ═══════════════════════════════════════════════════════════════
   BUCLE PRINCIPAL (con modo reposo si nadie está frente a la cámara)
   ═══════════════════════════════════════════════════════════════ */
function detectar() {
  if (!estado.hands || cam.readyState < 2 || !cam.videoWidth) return null;
  const t = performance.now();
  tsLast = Math.max(t, tsLast + 1);
  const r = estado.hands.detectForVideo(cam, tsLast);
  const d = performance.now() - t;
  msInf = msInf ? msInf * 0.8 + d * 0.2 : d;
  return r;
}

function programar() {
  if (!estado.corriendo || pendiente) return;
  pendiente = true;
  if (cam.requestVideoFrameCallback) cam.requestVideoFrameCallback(bucle);
  else requestAnimationFrame(bucle);
}

function bucle() {
  pendiente = false;
  if (!estado.corriendo) return;
  const ahora = performance.now();
  lastTick = ahora;
  programar();
  if (document.hidden) return;
  const reposo = !estado.juego && ahora - estado.ultimaMano > 5000;
  const fpsMax = reposo ? Math.min(CONFIG.maxFps, 8) : CONFIG.maxFps;
  /* La detección corre en el hilo principal: la limitamos para que nunca ocupe
     más de ~50 % del tiempo. Así el video y los juegos siguen fluidos en celulares lentos. */
  const tope = msInf > 0 ? Math.max(5, 500 / msInf) : fpsMax;
  if (ahora - lastSend < 1000 / Math.max(1, Math.min(fpsMax, tope)) - 3) return;
  lastSend = ahora;
  try { const r = detectar(); if (r) onResults(r); }
  catch (e) { console.warn('Detección:', e); }
}

/* ═══ CÁMARA DEL DISPOSITIVO (frontal o trasera) ═══ */
async function abrirCamara() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
    throw new Error('Tu navegador no soporta cámara. Necesitas HTTPS o localhost.');
  if (cam.srcObject) cam.srcObject.getTracks().forEach(t => t.stop());
  const base = { width: { ideal: CONFIG.camWidth }, height: { ideal: CONFIG.camHeight }, frameRate: { ideal: 30, max: 30 } };
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: Object.assign({ facingMode: { ideal: CONFIG.facing } }, base), audio: false });
  } catch (e) {
    if (!e || (e.name !== 'OverconstrainedError' && e.name !== 'NotFoundError')) throw e;
    stream = await navigator.mediaDevices.getUserMedia({ video: base, audio: false });
  }
  cam.srcObject = stream;
  await new Promise((resolve, reject) => {
    if (cam.readyState >= 2) return resolve();
    const to = setTimeout(() => reject(new Error('La cámara no responde.')), 8000);
    cam.onloadeddata = () => { clearTimeout(to); resolve(); };
  });
  await cam.play();
  const tr = stream.getVideoTracks()[0];
  const fm = (tr && tr.getSettings && tr.getSettings().facingMode) || CONFIG.facing;
  ESP.on = fm !== 'environment';
  camPiP.classList.toggle('trasera', !ESP.on);
  estado.activeCam = cam;
  if (cam.videoWidth && cam.videoHeight) camPiP.style.aspectRatio = cam.videoWidth + '/' + cam.videoHeight;
  setTimeout(ajustarCanvas, 50);
}

async function iniciar() {
  const btn = $('btnIniciar');
  btn.disabled = true; btn.textContent = 'Iniciando...'; setError('');
  try {
    setEstado('1/3 · Cargando detector de manos...');
    await cargarMediaPipe();
    setEstado('2/3 · Solicitando cámara ' + (CONFIG.facing === 'user' ? 'frontal' : 'trasera') + '...');
    await abrirCamara();
    setEstado('3/3 · Calibrando (' + estado.delegadoUsado + ')...');
    detectar();
    ajustarCanvas();
    estado.corriendo = true;
    $('inicio').classList.add('oculto');
    mostrarBienvenida();
    estado.ultimaMano = performance.now();
    pedirWakeLock();
    programar();
    iniciarAutoDeteccion();
  } catch (e) {
    console.error(e);
    setError('Error: ' + msgError(e));
    $('btnSinCam').style.display = 'inline-block';
    setEstado('Falló el inicio');
    btn.disabled = false; btn.textContent = 'Reintentar';
  }
}

function sincronizarCamUI() {
  document.querySelectorAll('[data-cam]').forEach(b => b.classList.toggle('activo', b.dataset.cam === CONFIG.facing));
  const bc = $('btnCam');
  if (bc) bc.textContent = CONFIG.facing === 'user' ? '🤳' : '📷';
}
document.querySelectorAll('[data-cam]').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.cam === CONFIG.facing) return;
  CONFIG.facing = b.dataset.cam;
  guardarConfig(); sincronizarCamUI();
}));

let cambiandoCam = false;
async function cambiarCamara() {
  if (cambiandoCam || !estado.corriendo) return;
  cambiandoCam = true;
  const antes = CONFIG.facing;
  CONFIG.facing = antes === 'user' ? 'environment' : 'user';
  sincronizarCamUI();
  toast(CONFIG.facing === 'user' ? '🤳 Cámara frontal' : '📷 Cámara trasera');
  const ok = await reiniciarCamaraSolo();
  if (ok) guardarConfig();
  else {
    CONFIG.facing = antes; sincronizarCamUI();
    toast('⚠️ No se pudo cambiar de cámara');
    await reiniciarCamaraSolo();
  }
  cambiandoCam = false;
}
$('btnCam').addEventListener('click', cambiarCamara);

$('btnIniciar').addEventListener('click', iniciar);

/* ═══════════════════════════════════════════════════════════════
   PANEL DE RENDIMIENTO
   ═══════════════════════════════════════════════════════════════ */
function sincronizarUI() {
  const set = (id, v) => { const el = $(id); if (el) el.value = v; };
  set('selFps', String(CONFIG.maxFps));
  set('selOverlay', CONFIG.overlayQuality);
  set('selDelegado', CONFIG.delegado);
  set('selInactividad', String(CONFIG.inactividadS));
  set('selCam', CONFIG.camWidth + 'x' + CONFIG.camHeight);
  set('selTiempo', String(CONFIG.duracionEstableMs));
  $('chkEfectos').checked = !!CONFIG.reduceEffects;
  $('chkAmbilight').checked = !!CONFIG.ambilight;
  $('chkSonidos').checked = !!CONFIG.sonidos;
  $('chkRecuerdo').checked = !!CONFIG.recuerdo;
  document.querySelectorAll('#presetsGrid button').forEach(b => b.classList.toggle('activo', b.dataset.preset === CONFIG.preset));
}

function leerUIRendimiento() {
  CONFIG.maxFps = parseInt($('selFps').value, 10);
  CONFIG.overlayQuality = $('selOverlay').value;
  const delAnt = CONFIG.delegado;
  CONFIG.delegado = $('selDelegado').value;
  CONFIG.inactividadS = parseInt($('selInactividad').value, 10);
  const camRes = $('selCam').value.split('x');
  const nuevoCamW = parseInt(camRes[0], 10), nuevoCamH = parseInt(camRes[1], 10);
  const camCambio = nuevoCamW !== CONFIG.camWidth || nuevoCamH !== CONFIG.camHeight;
  CONFIG.camWidth = nuevoCamW; CONFIG.camHeight = nuevoCamH;
  CONFIG.duracionEstableMs = parseInt($('selTiempo').value, 10);
  CONFIG.reduceEffects = $('chkEfectos').checked;
  CONFIG.ambilight = $('chkAmbilight').checked;
  CONFIG.sonidos = $('chkSonidos').checked;
  CONFIG.recuerdo = $('chkRecuerdo').checked;
  CONFIG.preset = 'custom';
  aplicarEfectos(); ajustarCanvas(); gResize(true); guardarConfig();

  if (estado.hands) {
    if (CONFIG.delegado !== delAnt) recrearDetector();
    else {
      try {
        estado.hands.setOptions({
          numHands: CONFIG.maxNumHands,
          minHandDetectionConfidence: CONFIG.minDetectionConfidence,
          minHandPresenceConfidence: CONFIG.minDetectionConfidence,
          minTrackingConfidence: CONFIG.minTrackingConfidence
        });
      } catch (e) { console.warn(e); }
    }
  }
  if (camCambio && estado.corriendo && estado.activeCam === cam) reiniciarCamaraSolo();
  sincronizarUI();
}

async function reiniciarCamaraSolo() {
  try {
    await abrirCamara();
    estado.esperandoNeutro = false; estado.comandoEjecutado = null;
    estado.gestoActual = null; estado.framesEstables = 0;
    fx.trail[0].length = 0; fx.trail[1].length = 0; swipeH.length = 0; G.manos.length = 0;
    ajustarCanvas();
    return true;
  } catch (e) { console.warn('No se pudo reiniciar la cámara:', e); return false; }
}

$('btnRend2').addEventListener('click', () => { $('inicio').classList.add('oculto'); $('rendimiento').classList.remove('oculto'); sincronizarUI(); });
$('btnRend').addEventListener('click', () => { $('rendimiento').classList.remove('oculto'); sincronizarUI(); });
document.querySelectorAll('#presetsGrid button').forEach(b => {
  b.addEventListener('click', () => {
    const p = b.dataset.preset;
    aplicarPreset(p);
    if (p === 'auto') iniciarAutoDeteccion();
    document.querySelectorAll('#presetsGrid button').forEach(x => x.classList.toggle('activo', x.dataset.preset === p));
  });
});
$('btnAplicarRend').addEventListener('click', () => { leerUIRendimiento(); const i = $('rendInfo'); if (i) i.textContent = 'Cambios aplicados.'; });
$('btnCerrarRend').addEventListener('click', () => {
  $('rendimiento').classList.add('oculto');
  if (!estado.corriendo && $('inicio').classList.contains('oculto') && $('config').classList.contains('oculto')) $('inicio').classList.remove('oculto');
});

/* ═══════════════════════════════════════════════════════════════
   CONFIG (videos + cámara + textos)
   ═══════════════════════════════════════════════════════════════ */
$('btnConfig').addEventListener('click', () => {
  construirPanelConfig(); camposExtra(); seccionOffline();
  $('inicio').classList.add('oculto'); $('config').classList.remove('oculto');
});
$('btnGuardar').addEventListener('click', () => {
  const urls = [];
  for (let i = 0; i < 5; i++) urls.push(($('url' + i).value || '').trim());
  VIDEOS = urls;
  try { localStorage.setItem('ia_gestos_videos', JSON.stringify(urls)); } catch (e) {}
  CONFIG.nombre = ($('cfgNombre').value || '').trim() || 'Alex';
  CONFIG.cierre1 = ($('cfgC1').value || '').trim();
  CONFIG.cierre2 = ($('cfgC2').value || '').trim();
  CONFIG.duracionJuego = parseInt($('cfgDur').value, 10) || 40;
  aplicarTextos(); guardarConfig();
  $('config').classList.add('oculto'); $('inicio').classList.remove('oculto');
});
$('btnCancelar').addEventListener('click', () => { $('config').classList.add('oculto'); $('inicio').classList.remove('oculto'); });
$('btnAyuda').addEventListener('click', () => $('ayuda').classList.toggle('visible'));
$('btnMute').addEventListener('click', () => setMute(!estado.muted));
$('btnFull').addEventListener('click', toggleFullscreen);

E.welcome.addEventListener('click', e => {
  const item = e.target.closest('[data-video]');
  const action = e.target.closest('[data-action]');
  const gesto = e.target.closest('[data-gesto="corazon"]');
  const juego = e.target.closest('[data-juego]');
  if (item) { ocultarBienvenida(); cambiarVideo(parseInt(item.dataset.video, 10), 0); }
  else if (juego) { iniciarJuego(juego.dataset.juego); }
  else if (action) {
    ocultarBienvenida();
    const cmd = action.dataset.action;
    if (cmd === 'playpause') togglePlay();
    else if (cmd === 'siguiente') siguienteVideo();
    else if (cmd === 'fullscreen') toggleFullscreen();
  } else if (gesto) { ocultarBienvenida(); mostrarCorazon(); }
});

function construirPanelConfig() {
  const p = $('configPanel'); p.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const lbl = document.createElement('label');
    lbl.textContent = '🎬 Video ' + (i + 1);
    const inp = document.createElement('input');
    inp.id = 'url' + i; inp.type = 'url'; inp.placeholder = './vid' + (i + 1) + '.mp4'; inp.value = VIDEOS[i] || '';
    lbl.appendChild(inp); p.appendChild(lbl);
  }
}

/* ═══════════════════════════════════════════════════════════════
   QUIOSCO Y EXTRAS
   ═══════════════════════════════════════════════════════════════ */
function msgError(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError') return 'Permiso de cámara denegado. Actívalo en el candado del navegador y reintenta.';
  if (n === 'NotFoundError') return 'No se encontró ninguna cámara.';
  if (n === 'NotReadableError') return 'La cámara está en uso por otra aplicación.';
  if (n === 'OverconstrainedError') return 'La cámara no admite esa resolución. Baja la resolución en ⚡.';
  return (e && e.message) || n || 'desconocido';
}
async function pedirWakeLock() {
  try { if ('wakeLock' in navigator && !document.hidden) wl = await navigator.wakeLock.request('screen'); } catch (e) {}
}

function volverInicio() {
  if (estado.juego) salirJuego(true);
  if (trFin) trFin();
  [vFront, vBack].forEach(v => { try { v.pause(); } catch (e) {} v.removeAttribute('src'); v.load(); });
  vBack.style.display = 'none';
  E.videoAct.textContent = '—';
  mostrarMensaje('Muestra una seña con AMBAS manos frente a la cámara');
  mostrarBienvenida();
  estado.esperandoNeutro = false; estado.gestoActual = null; estado.framesEstables = 0;
}

[$('video'), $('video2')].forEach(v => v.addEventListener('error', () => {
  if (v === vFront && v.getAttribute('src')) {
    mostrarMensaje('No se pudo cargar Video ' + (estado.indiceVideo + 1) + '. Revisa su URL en ⚙️ Configurar.');
  }
}));

$('btnSinCam').addEventListener('click', () => { $('inicio').classList.add('oculto'); mostrarBienvenida(); });
E.welcome.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button]')) { e.preventDefault(); e.target.click(); }
});

document.addEventListener('keydown', e => {
  estado.ultimaMano = performance.now();
  if (/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector('.pantalla:not(.oculto)')) return;
  const k = e.key.toLowerCase();
  if (estado.juego && k !== 'escape' && k !== 'm' && k !== 'f' && k !== 'r' && k !== 'h') return;
  if (k >= '1' && k <= '5') { ocultarBienvenida(); cambiarVideo(+k - 1, 0); }
  else if (k === '6') iniciarJuego('ninja');
  else if (k === '7') iniciarJuego('ritmo');
  else if (k === '8') iniciarJuego('simon');
  else if (k === 'r') { if (estado.juego) iniciarJuego(G.modo); else return; }
  else if (k === ' ') { ocultarBienvenida(); togglePlay(); }
  else if (k === 'n') { ocultarBienvenida(); siguienteVideo(); }
  else if (k === 'f') toggleFullscreen();
  else if (k === 'm') setMute(!estado.muted);
  else if (k === 'c') cambiarCamara();
  else if (k === 'h') { ocultarBienvenida(); mostrarCorazon(); }
  else if (k === 'escape') { if (estado.juego) salirJuego(); else ocultarCorazon(); }
  else return;
  e.preventDefault();
});
document.addEventListener('pointerdown', () => { estado.ultimaMano = performance.now(); }, { passive: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { pedirWakeLock(); programar(); } });
window.addEventListener('pagehide', () => { if (cam.srcObject) cam.srcObject.getTracks().forEach(t => t.stop()); });

/* Vigilante: reactiva bucle, reconecta cámara y vuelve al inicio por inactividad */
setInterval(() => {
  if (!estado.corriendo || document.hidden) return;
  const t = performance.now();
  if (t - lastTick > 1500) { pendiente = false; programar(); }
  if (estado.activeCam === cam) {
    const tr = cam.srcObject && cam.srcObject.getVideoTracks()[0];
    if ((!tr || tr.readyState === 'ended') && t - ultimoReinicio > 5000) { ultimoReinicio = t; reiniciarCamaraSolo(); }
  }
  if (CONFIG.inactividadS > 0 && !estado.welcomeVisible && !estado.juego && vFront.paused &&
      E.celeb.classList.contains('oculto') && t - estado.ultimaMano > CONFIG.inactividadS * 1000) volverInicio();
}, 1000);

/* ═══════════════════════════════════════════════════════════════
   SONIDO (sintetizado, sin archivos)
   ═══════════════════════════════════════════════════════════════ */
let ac = null;
function audio() {
  ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function tono(f, d, tipo, vol, delay, f2) {
  const a = audio(), o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + (delay || 0);
  o.type = tipo || 'sine';
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol || .12, t0 + .015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + d + .05);
}
function sonido(tipo, n) {
  if (!CONFIG.sonidos) return;
  n = n || 0;
  try {
    switch (tipo) {
      case 'corazon': [523, 659, 784, 1047].forEach((f, i) => tono(f, .25, 'sine', .12, i * .09)); break;
      case 'swipe':   [440, 660].forEach((f, i) => tono(f, .25, 'sine', .12, i * .09)); break;
      case 'whoosh':  tono(200, .55, 'triangle', .07, 0, 1500); break;
      case 'pop':     tono(620 + Math.min(n, 14) * 50, .1, 'triangle', .13, 0, 220); break;
      case 'estrella': tono(800 + Math.min(n, 14) * 40, .16, 'sine', .1, 0, 1700); break;
      case 'oro':     [880, 1175, 1568].forEach((f, i) => tono(f, .22, 'sine', .11, i * .06)); break;
      case 'hielo':   tono(1300, .45, 'sine', .1, 0, 300); break;
      case 'onda':    tono(300, .5, 'sine', .13, 0, 80); tono(900, .4, 'triangle', .06, .05, 1800); break;
      case 'mal':     tono(170, .3, 'sawtooth', .08, 0, 70); break;
      case 'cuenta':  tono(660, .14, 'square', .04); break;
      case 'ya':      tono(990, .3, 'square', .05); break;
      case 'fin':     [784, 659, 523, 392].forEach((f, i) => tono(f, .3, 'sine', .12, i * .12)); break;
      default:        [660, 880].forEach((f, i) => tono(f, .25, 'sine', .12, i * .09));
    }
  } catch (e) {}
}

/* ═══════════════════════════════════════════════════════════════
   FX HOLOGRÁFICO (partículas a media resolución, solo en videos)
   ═══════════════════════════════════════════════════════════════ */
const fx = { c: $('fx'), x: $('fx').getContext('2d'), p: [], run: false, W: 0, H: 0, k: 1, t: 0, max: 140, trail: [[], []], arco: null, arcoT: 0 };
function fxTam() {
  fx.W = fx.c.width  = Math.max(1, Math.round(innerWidth  * 0.5));
  fx.H = fx.c.height = Math.max(1, Math.round(innerHeight * 0.5));
  fx.k = fx.W / 400;
  fx.max = CONFIG.overlayQuality === 'full' ? 140 : 60;
}
addEventListener('resize', fxTam);

function fxArrancar() { if (!fx.run) { fx.run = true; fx.t = performance.now(); requestAnimationFrame(fxLoop); } }
function fxAdd(x, y, vx, vy, vida, r, col, forzar) {
  if (!forzar && fx.p.length >= fx.max) return;
  fx.p.push({ x, y, vx, vy, l: vida, v: vida, r, c: col });
  fxArrancar();
}

function fxLoop(t) {
  const dt = Math.min(0.05, (t - fx.t) / 1000); fx.t = t;
  const g = fx.x, ahora = performance.now(), k = fx.k;
  g.clearRect(0, 0, fx.W, fx.H);
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';

  for (let h = 0; h < 2; h++) {
    const tr = fx.trail[h];
    while (tr.length && ahora - tr[0].t > 550) tr.shift();
    if (tr.length < 2) continue;
    g.strokeStyle = tr.col;
    for (let i = 1; i < tr.length; i++) {
      const a = Math.max(0, 1 - (ahora - tr[i].t) / 550);
      g.globalAlpha = a * 0.8; g.lineWidth = (1 + 5 * a) * k;
      g.beginPath(); g.moveTo(tr[i - 1].x, tr[i - 1].y); g.lineTo(tr[i].x, tr[i].y); g.stroke();
    }
  }

  const A = fx.arco, arcoVivo = A && ahora - fx.arcoT < 160;
  if (arcoVivo) {
    const dx = A.bx - A.ax, dy = A.by - A.ay, d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d, mx = (A.ax + A.bx) / 2, my = (A.ay + A.by) / 2;
    const r = Math.min(fx.W * 0.16, d * 0.18) + 4 * k;
    const gr = g.createRadialGradient(mx, my, 0, mx, my, r * 2.2);
    gr.addColorStop(0, A.rosa ? 'rgba(255,77,157,.85)' : 'rgba(120,255,220,.85)');
    gr.addColorStop(0.4, A.rosa ? 'rgba(255,77,157,.25)' : 'rgba(0,209,255,.25)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 1; g.fillStyle = gr; g.beginPath(); g.arc(mx, my, r * 2.2, 0, 6.2832); g.fill();
    for (let j = 0; j < 2; j++) {
      g.beginPath(); g.moveTo(A.ax, A.ay);
      for (let i = 1; i < 9; i++) {
        const f = i / 9, o = (Math.random() - .5) * d * .12 * Math.sin(f * 3.1416);
        g.lineTo(A.ax + dx * f + nx * o, A.ay + dy * f + ny * o);
      }
      g.lineTo(A.bx, A.by);
      g.strokeStyle = j ? '#ffffff' : (A.rosa ? '#ff4d9d' : '#00d1ff');
      g.lineWidth = (j ? 1 : 3.5) * k; g.globalAlpha = j ? 0.9 : 0.5; g.stroke();
    }
  }

  for (let i = fx.p.length - 1; i >= 0; i--) {
    const q = fx.p[i];
    q.l -= dt;
    if (q.l <= 0) { fx.p[i] = fx.p[fx.p.length - 1]; fx.p.pop(); continue; }
    q.x += q.vx * dt; q.y += q.vy * dt;
    const a = q.l / q.v;
    g.globalAlpha = a; g.fillStyle = q.c;
    g.beginPath(); g.arc(q.x, q.y, q.r * (0.4 + 0.6 * a), 0, 6.2832); g.fill();
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  if (fx.p.length || arcoVivo || fx.trail[0].length > 1 || fx.trail[1].length > 1) requestAnimationFrame(fxLoop);
  else { fx.run = false; g.clearRect(0, 0, fx.W, fx.H); }
}

function fxManos(manos, rosa, activo) {
  if (CONFIG.reduceEffects || CONFIG.overlayQuality === 'off') return;
  if (!fx.W) fxTam();
  const n = activo ? 3 : 1, k = fx.k, ahora = performance.now();
  for (let h = manos.length; h < 2; h++) fx.trail[h].length = 0;
  for (let h = 0; h < manos.length; h++) {
    const col = rosa ? '#ff4d9d' : COLORES[h % 2], tr = fx.trail[h];
    tr.col = col;
    const ix = manos[h][8];
    tr.push({ x: dX(ix.x) * fx.W, y: ix.y * fx.H, t: ahora });
    for (const idx of [8, 4]) {
      const p = manos[h][idx];
      for (let i = 0; i < n; i++)
        fxAdd(dX(p.x) * fx.W, p.y * fx.H, (Math.random() - .5) * 40 * k, (Math.random() - .5) * 40 * k - 10 * k, .6 + Math.random() * .5, (2 + Math.random() * 3) * k, col);
    }
  }
  if (manos.length === 2) {
    const a = manos[0][9], b = manos[1][9];
    fx.arco = { ax: dX(a.x) * fx.W, ay: a.y * fx.H, bx: dX(b.x) * fx.W, by: b.y * fx.H, rosa };
    fx.arcoT = ahora;
  } else fx.arco = null;
  fxArrancar();
}

function fxCorazon() {
  if (CONFIG.reduceEffects) return;
  fxTam();
  const cols = ['#ff4d9d', '#38ffb0', '#00d1ff'], s = fx.k * 3.2;
  for (let i = 0; i < 110; i++) {
    const t = i / 110 * 6.2832;
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    const m = 1 + Math.random() * .15;
    fxAdd(fx.W / 2, fx.H * .46, hx * s * m, hy * s * m, 2.4 + Math.random(), (2 + Math.random() * 3) * fx.k, cols[i % 3], true);
  }
}

/* Explosión de confeti al cambiar de video (x,y en % de pantalla) */
function fxExplosion(xp, yp, n) {
  if (CONFIG.reduceEffects || !fx.c.isConnected) return;
  if (!fx.W) fxTam();
  const cols = ['#38ffb0', '#00d1ff', '#ff4d9d', '#ffd24a', '#a78bff'];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.2832, s = (80 + Math.random() * 280) * fx.k;
    fxAdd(fx.W * xp / 100, fx.H * yp / 100, Math.cos(a) * s, Math.sin(a) * s, .6 + Math.random() * .7, (2 + Math.random() * 3.5) * fx.k, cols[i % 5], true);
  }
}

function fxChorro(dir, p) {
  if (CONFIG.reduceEffects) return;
  if (!fx.W) fxTam();
  for (let i = 0; i < 40; i++)
    fxAdd(dX(p.x) * fx.W, p.y * fx.H, dir * (150 + Math.random() * 350) * fx.k, (Math.random() - .5) * 60 * fx.k, .5 + Math.random() * .4, (2 + Math.random() * 3) * fx.k, i % 2 ? '#38ffb0' : '#00d1ff', true);
}

/* ═══════════════════════════════════════════════════════════════
   SWIPE CON 1 MANO ABIERTA → empuje de video en la dirección de la mano
   ═══════════════════════════════════════════════════════════════ */
const swipeH = []; let lastSwipe = 0;
function detectarSwipe(lm, dedos, ahora) {
  const x = dX(lm[0].x);
  swipeH.push({ t: ahora, x });
  while (swipeH.length && ahora - swipeH[0].t > 450) swipeH.shift();
  if (dedos < 4 || !vFront.getAttribute('src') || swipeH.length < 4 ||
      ahora - lastSwipe < 1100 || ahora - estado.ultimaAccion < CONFIG.cooldownMs) return;
  const a = swipeH[0], dx = x - a.x;
  if (Math.abs(dx) > 0.36 && a.x > 0.1 && a.x < 0.9) {
    lastSwipe = estado.ultimaAccion = ahora; swipeH.length = 0;
    sonido('swipe'); fxChorro(dx < 0 ? -1 : 1, lm[0]);
    const n = VIDEOS.length;
    cambiarVideo(dx < 0 ? (estado.indiceVideo + 1) % n : (estado.indiceVideo + n - 1) % n, dx < 0 ? 1 : -1);
  }
}

/* ═══════════════════════════════════════════════════════════════
   RETÍCULA DE DWELL + TARJETAS EN VIVO
   ═══════════════════════════════════════════════════════════════ */
let retCmd = null, cardSel = null;
function mostrarReticula(cmd, pct) {
  if (retCmd !== cmd) {
    retCmd = cmd;
    const i = cmd.nombre.indexOf(' ');
    E.retEmoji.textContent = cmd.nombre.slice(0, i);
    E.retTxt.textContent = cmd.nombre.slice(i + 1);
  }
  E.retAro.style.strokeDashoffset = 100 - pct;
  E.reticula.classList.add('v');
  if (estado.welcomeVisible) resaltarCard(cmd, pct);
}
function ocultarReticula() {
  if (retCmd) { E.reticula.classList.remove('v'); retCmd = null; }
  if (cardSel) resaltarCard(null, 0);
}
function resaltarCard(cmd, pct) {
  let el = null;
  if (cmd) {
    const q = cmd.tipo === 'video' ? '[data-video="' + cmd.valor + '"]'
            : cmd.tipo === 'juego' ? '[data-juego="' + cmd.valor + '"]'
            : cmd.tipo === 'celebracion' ? '[data-gesto]' : '[data-action="' + cmd.tipo + '"]';
    el = E.welcome.querySelector(q);
  }
  if (cardSel && cardSel !== el) { cardSel.classList.remove('sel'); cardSel.style.removeProperty('--p'); }
  cardSel = el;
  if (el) { el.classList.add('sel'); el.style.setProperty('--p', pct + '%'); }
}

let pistaI = 0;
setInterval(() => {
  if (!estado.welcomeVisible || CONFIG.reduceEffects || cardSel) return;
  const c = E.welcome.querySelectorAll('.gestos-grid > [role=button]');
  c.forEach(e => e.classList.remove('pista'));
  if (c.length) c[pistaI++ % c.length].classList.add('pista');
}, 1600);

/* ═══════════════════════════════════════════════════════════════
   TEXTOS EDITABLES + CONTADOR DE CIERRES
   ═══════════════════════════════════════════════════════════════ */
function aplicarTextos() {
  const n = E.welcome.querySelector('h1 span'); if (n) n.textContent = CONFIG.nombre;
  const a = document.querySelector('.linea-1'), b = document.querySelector('.linea-2');
  if (a) a.textContent = CONFIG.cierre1;
  if (b) b.textContent = CONFIG.cierre2;
}
function leerVisitas() {
  const hoy = new Date().toISOString().slice(0, 10);
  let v = {};
  try { v = JSON.parse(localStorage.getItem('ia_gestos_visitas') || '{}'); } catch (e) {}
  if (v.dia !== hoy) { v.dia = hoy; v.hoy = 0; }
  v.total = v.total || 0;
  return v;
}
function contarVisita() {
  const v = leerVisitas(); v.hoy++; v.total++;
  try { localStorage.setItem('ia_gestos_visitas', JSON.stringify(v)); } catch (e) {}
}
function camposExtra() {
  const p = $('configPanel');
  [['cfgNombre', '👤 Nombre en la bienvenida', 'nombre'], ['cfgC1', '💬 Cierre · línea 1', 'cierre1'], ['cfgC2', '💬 Cierre · línea 2', 'cierre2']]
    .forEach(([id, t, k]) => {
      const l = document.createElement('label'); l.textContent = t;
      const i = document.createElement('input'); i.id = id; i.type = 'text'; i.maxLength = 40; i.value = CONFIG[k];
      l.appendChild(i); p.appendChild(l);
    });
  const l = document.createElement('label'); l.textContent = '⏱ Duración de las partidas';
  const s = document.createElement('select'); s.id = 'cfgDur';
  [30, 40, 60, 90].forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v + ' s'; s.appendChild(o); });
  s.value = String(CONFIG.duracionJuego); l.appendChild(s); p.appendChild(l);
  const v = leerVisitas(), h = document.createElement('div');
  h.className = 'hint'; h.textContent = '📊 Cierres con corazón · hoy: ' + v.hoy + ' · total: ' + v.total;
  p.appendChild(h);
}

/* ═══════════════════════════════════════════════════════════════
   AMBILIGHT: el borde toma el color medio del video
   ═══════════════════════════════════════════════════════════════ */
const ambX = Object.assign(document.createElement('canvas'), { width: 4, height: 4 }).getContext('2d', { willReadFrequently: true });
let ambOk = true;
setInterval(() => {
  if (!CONFIG.ambilight || CONFIG.reduceEffects) { if (E.ambi.style.boxShadow) E.ambi.style.boxShadow = ''; return; }
  if (!ambOk || document.hidden || estado.juego) return;
  const v = vFront;
  if (!v.getAttribute('src')) { E.ambi.style.boxShadow = ''; return; }
  if (v.paused || v.readyState < 2) return;
  try {
    ambX.drawImage(v, 0, 0, 4, 4);
    const d = ambX.getImageData(0, 0, 4, 4).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < 64; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    r /= 16; g /= 16; b /= 16;
    const f = Math.min(2, 200 / Math.max(r, g, b, 1));
    E.ambi.style.boxShadow = 'inset 0 0 90px 6px rgba(' + Math.round(r * f) + ',' + Math.round(g * f) + ',' + Math.round(b * f) + ',.55)';
  } catch (e) { ambOk = false; E.ambi.style.boxShadow = ''; }
}, 700);

/* ═══════════════════════════════════════════════════════════════
   RECUERDO FOTOGRÁFICO (opcional, solo en el dispositivo)
   ═══════════════════════════════════════════════════════════════ */
function tomarRecuerdo() {
  $('recuerdo').hidden = true;
  const src = estado.activeCam;
  if (!CONFIG.recuerdo || !src) return;
  try {
    const w = src.videoWidth || src.naturalWidth, h = src.videoHeight || src.naturalHeight;
    if (!w) return;
    const W = 640, Hf = Math.round(W * h / w), M = 40, CW = W + M * 2, CH = Hf + 330;
    const c = document.createElement('canvas'), g = c.getContext('2d');
    c.width = CW; c.height = CH;
    const gr = g.createLinearGradient(0, 0, CW, CH);
    gr.addColorStop(0, '#38ffb0'); gr.addColorStop(.55, '#00d1ff'); gr.addColorStop(1, '#ff4d9d');
    const bg = g.createLinearGradient(0, 0, 0, CH); bg.addColorStop(0, '#0a1626'); bg.addColorStop(1, '#05070d');
    g.fillStyle = bg; g.fillRect(0, 0, CW, CH);
    g.strokeStyle = gr; g.lineWidth = 5; g.strokeRect(6, 6, CW - 12, CH - 12);
    g.lineWidth = 1; g.globalAlpha = .5; g.strokeRect(16, 16, CW - 32, CH - 32); g.globalAlpha = 1;
    const fit = (t, px, wt, fam, maxW) => { let f = px; do { g.font = wt + ' ' + f + 'px ' + fam; f -= 2; } while (g.measureText(t).width > maxW && f > 12); };
    g.textAlign = 'center'; g.fillStyle = gr;
    g.font = '600 15px monospace'; g.fillText('R E C U E R D O   D E   T U   V I S I T A', CW / 2, 52);
    const top = 70;
    g.save(); g.beginPath(); g.roundRect(M, top, W, Hf, 18); g.clip();
    if (ESP.on) { g.translate(M + W, top); g.scale(-1, 1); } else g.translate(M, top);
    g.drawImage(src, 0, 0, W, Hf); g.restore();
    g.save(); g.beginPath(); g.roundRect(M, top, W, Hf, 18); g.clip();
    g.fillStyle = 'rgba(56,255,176,.10)'; g.fillRect(M, top, W, Hf);
    g.fillStyle = 'rgba(0,0,0,.12)'; for (let y = top; y < top + Hf; y += 4) g.fillRect(M, y, W, 1.5);
    const vg = g.createRadialGradient(CW / 2, top + Hf / 2, Hf * .35, CW / 2, top + Hf / 2, Hf * .85);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = vg; g.fillRect(M, top, W, Hf);
    g.restore();
    g.strokeStyle = gr; g.lineWidth = 3; g.beginPath(); g.roundRect(M, top, W, Hf, 18); g.stroke();
    // corazón holográfico sobre la foto
    const hc = new Path2D('M50 88 C 20 65, 8 45, 15 30 C 22 15, 40 15, 50 30 C 60 15, 78 15, 85 30 C 92 45, 80 65, 50 88 Z');
    const hy = top + Hf - 28, hs = 1.5;
    g.save(); g.translate(CW / 2 - 50 * hs, hy - 50 * hs); g.scale(hs, hs);
    g.fillStyle = '#05070d'; g.fill(hc); g.shadowColor = '#38ffb0'; g.shadowBlur = 14; g.strokeStyle = gr; g.lineWidth = 3.5; g.stroke(hc); g.restore();
    // escuela
    const ty = top + Hf + 82;
    g.fillStyle = gr; fit(ESCUELA[0], 40, '700', 'Georgia,"Times New Roman",serif', CW - 90);
    g.shadowColor = 'rgba(56,255,176,.6)'; g.shadowBlur = 10; g.fillText(ESCUELA[0], CW / 2, ty); g.shadowBlur = 0;
    g.strokeStyle = gr; g.lineWidth = 1.5; g.beginPath(); g.moveTo(CW / 2 - 150, ty + 22); g.lineTo(CW / 2 - 14, ty + 22); g.moveTo(CW / 2 + 14, ty + 22); g.lineTo(CW / 2 + 150, ty + 22); g.stroke();
    g.fillStyle = gr; g.font = '16px serif'; g.fillText('♥', CW / 2, ty + 28);
    g.fillStyle = '#e8f6ff'; fit(ESCUELA[1].replace(/./g, '$& ').trim(), 22, '600', '-apple-system,Segoe UI,sans-serif', CW - 90);
    g.fillText(ESCUELA[1].replace(/./g, '$& ').trim(), CW / 2, ty + 62);
    g.fillStyle = '#8fb4c9'; g.font = 'italic 20px Georgia,serif';
    g.fillText((CONFIG.cierre1 + ' ' + CONFIG.cierre2).trim(), CW / 2, ty + 100);
    g.fillStyle = '#5a8ba8'; g.font = '14px monospace';
    g.fillText(new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }) + '  ·  Visitante N.º ' + (leerVisitas().hoy + 1), CW / 2, ty + 132);
    const url = c.toDataURL('image/jpeg', .9);
    const rc = $('recuerdo'); $('recImg').src = url; $('recDl').href = url; $('recDl').download = 'recuerdo-ceja-los-ralos-' + Date.now() + '.jpg';
    rc.hidden = false;
    let sh = $('recShare');
    if (sh && navigator.canShare) {
      sh.hidden = false;
      sh.onclick = async e => { e.stopPropagation(); try { const bl = await (await fetch(url)).blob(); const f = new File([bl], 'recuerdo.jpg', { type: 'image/jpeg' }); if (navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: ESCUELA[0] }); } catch (_) {} };
    }
  } catch (e) { console.warn('Recuerdo no disponible:', e); }
}
$('recDl').addEventListener('click', e => e.stopPropagation());


/* ═══════════════════════════════════════════════════════════════
   🎮 MOTOR DE JUEGOS
   · Las manos se dibujan como siluetas de luz que dejan "huellas" (fantasmas)
   · Modos: ambiente (menú), burbujas, estrellas, aura (pintar con luz)
   · Sprites pre-renderizados, pool de partículas, sin allocs por frame
   ═══════════════════════════════════════════════════════════════ */
const PAL = ['#38ffb0', '#00d1ff', '#ff4d9d', '#ffd24a', '#a78bff', '#ffffff', '#ff8a3d'];
const gc = $('gm'), gx = gc.getContext('2d');
const G = {
  modo: null, fase: 'idle', W: 0, H: 0, u: 1, run: false, last: 0, sim: 0, nowT: 0,
  ents: [], txts: [], rings: [], manos: [], pt: null,
  puntos: 0, combo: 0, comboT: 0, tiempo: 40, dur: 40, cuenta: 0, spawn: 0, lento: 0,
  shake: 0, flash: 0, flashC: '#fff', record: 0, nuevoRec: false, finT: 0, fuegoT: 0,
  bg: null, skip: 0, ocio: 0, tituloT: 0, aplauso: 0, dPrev: 1e9,
  hN: 0, hT: 0, jP: -1, jCm: '', jCuenta: -1, estrellas: []
};
const PM = 360, parts = Array.from({ length: PM }, () => ({ l: 0, v: 1, x: 0, y: 0, vx: 0, vy: 0, r: 2, c: 0, g: 0 }));
let pI = 0;
const HN = 34, hist = Array.from({ length: HN }, () => ({ t: 0, n: 0, a: new Float32Array(42), b: new Float32Array(42) }));
const GH = Array.from({ length: 12 }, (_, i) => 'hsl(' + (170 + i * 14) + ',100%,62%)');
const PALMA = [0, 1, 5, 9, 13, 17];
const SP = {};
const TXT_JUEGO = {
  ninja: { t: '⚔️ ¡Corte Ninja!', s: 'Corta 📚🎓💡 con movimientos rápidos · ⭐ = +3 s · evita los ☄️' },
  ritmo: { t: '🎵 ¡Ritmo Holo!', s: 'Toca cada círculo justo cuando el aro blanco lo alcance' },
  simon: { t: '🧠 ¡Memoria Holo!', s: 'Mira la secuencia de luces y repítela tocando los círculos' }
};

/* ---- sprites ---- */
function sprite(fn) { const c = document.createElement('canvas'); c.width = c.height = 128; fn(c.getContext('2d')); return c; }
function emojiSp(c, e, size) {
  c.font = size + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e, 64, 68);
}
function esfera(c, h, s, l, boost) {
  s = s == null ? 90 : s; l = l == null ? 60 : l; boost = boost || 0;
  const g = c.createRadialGradient(64, 64, 8, 64, 64, 61);
  g.addColorStop(0, 'hsla(' + h + ',' + s + '%,' + l + '%,' + (.05 + boost) + ')');
  g.addColorStop(.7, 'hsla(' + h + ',' + s + '%,' + l + '%,' + (.2 + boost) + ')');
  g.addColorStop(.93, 'hsla(' + h + ',' + s + '%,' + (l + 15) + '%,.8)');
  g.addColorStop(1, 'hsla(' + h + ',' + s + '%,' + (l + 25) + '%,0)');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  c.strokeStyle = 'hsla(' + h + ',' + s + '%,' + (l + 25) + '%,.55)'; c.lineWidth = 2;
  c.beginPath(); c.arc(64, 64, 58, 0, 6.2832); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.6)';
  c.beginPath(); c.ellipse(44, 42, 15, 8, -.55, 0, 6.2832); c.fill();
  c.fillStyle = 'rgba(255,255,255,.25)';
  c.beginPath(); c.arc(86, 90, 6, 0, 6.2832); c.fill();
}
function estrellaSp(c, c1, c2) {
  c.translate(64, 64);
  const g = c.createRadialGradient(0, 0, 4, 0, 0, 56);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  c.fillStyle = g; c.shadowColor = c2; c.shadowBlur = 14;
  c.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 24 : 52, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  c.closePath(); c.fill();
}
function glowSp(col) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,.95)'); r.addColorStop(.25, col); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return c;
}
function crearSprites() {
  [180, 155, 300, 215, 30, 270].forEach((h, i) => { SP['b' + i] = sprite(c => esfera(c, h)); });
  SP.o = sprite(c => { esfera(c, 45, 100, 55, .3); emojiSp(c, '⭐', 58); });
  SP.h = sprite(c => { esfera(c, 195, 80, 78, .25); emojiSp(c, '❄️', 56); });
  SP.c = sprite(c => {
    esfera(c, 280, 80, 60, .08);
    const g = c.createConicGradient ? c.createConicGradient(0, 64, 64) : c.createLinearGradient(0, 0, 128, 128);
    for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, 'hsl(' + (i * 60) + ',95%,60%)');
    c.strokeStyle = g; c.lineWidth = 9; c.beginPath(); c.arc(64, 64, 55, 0, 6.2832); c.stroke();
    emojiSp(c, '✨', 56);
  });
  SP.s = sprite(c => estrellaSp(c, '#fff6b0', '#ffb800'));
  SP.k = sprite(c => estrellaSp(c, '#ffffff', '#38ffb0'));
  SP.m = sprite(c => {
    const g = c.createRadialGradient(64, 64, 6, 64, 64, 60);
    g.addColorStop(0, 'rgba(255,120,60,.85)'); g.addColorStop(.7, 'rgba(255,40,40,.35)'); g.addColorStop(1, 'rgba(255,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    emojiSp(c, '☄️', 66);
  });
  ['📚','🎓','✏️','💡','🔬'].forEach((e, i) => { SP['n' + i] = sprite(c => { c.shadowColor = '#38ffb0'; c.shadowBlur = 16; emojiSp(c, e, 72); }); });
  SP.gl0 = glowSp('rgba(56,255,176,.6)');
  SP.gl1 = glowSp('rgba(0,209,255,.6)');
  for (let i = 0; i < 70; i++) G.estrellas.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + .6, f: 1 + Math.random() * 2.5, p: Math.random() * 6.28 });
}

function gResize(forzar) {
  const sc = clamp((CONFIG.canvasScale || 1) * .9, .5, 1);
  const W = Math.max(2, Math.round(innerWidth * sc)), H = Math.max(2, Math.round(innerHeight * sc));
  if (!forzar && W === G.W && H === G.H && G.bg) return;
  G.W = gc.width = W; G.H = gc.height = H; G.u = Math.min(W, H) / 600;
  G.manos.length = 0; G.ents.length = 0;
  const gr = gx.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, 'rgba(8,14,40,.80)'); gr.addColorStop(1, 'rgba(3,6,12,.90)');
  G.bg = gr;
}
addEventListener('resize', () => gResize());

/* ---- mapeo cámara → pantalla (espejado y con márgenes para alcanzar los bordes) ---- */
const mapX = x => clamp((dX(x) - .08) / .84, -.05, 1.05) * G.W;
const mapY = y => clamp((y - .04) / .82, -.05, 1.05) * G.H;
const PTS_I = [4, 8, 12, 16, 20];
function gPuntosMano(h, out) {
  for (let j = 0; j < 5; j++) { out[2 * j] = h.p[2 * PTS_I[j]]; out[2 * j + 1] = h.p[2 * PTS_I[j] + 1]; }
  out[10] = (h.p[0] + h.p[18]) / 2; out[11] = (h.p[1] + h.p[19]) / 2;
}

function gRecibir(manos, now) {
  if (!G.W) return;
  const usados = [];
  for (const lm of manos) {
    const wx = mapX(lm[0].x), wy = mapY(lm[0].y);
    let best = null, bd = 1e9;
    for (const h of G.manos) {
      if (usados.indexOf(h) >= 0) continue;
      const d = Math.hypot(h.t[0] - wx, h.t[1] - wy);
      if (d < bd) { bd = d; best = h; }
    }
    let nuevo = false;
    if (!best || bd > G.W * .4) {
      best = { p: new Float32Array(42), t: new Float32Array(42), q0: new Float32Array(12), q1: new Float32Array(12), vis: now, hs: 1, rib: null };
      G.manos.push(best); nuevo = true;
    }
    for (let i = 0; i < 21; i++) { best.t[2 * i] = mapX(lm[i].x); best.t[2 * i + 1] = mapY(lm[i].y); }
    if (nuevo) { best.p.set(best.t); gPuntosMano(best, best.q1); best.q0.set(best.q1); }
    best.vis = now; usados.push(best);
  }
}

addEventListener('pointermove', e => gPuntero(e, false), { passive: true });
addEventListener('pointerdown', e => gPuntero(e, true), { passive: true });
function gPuntero(e, down) {
  if (!G.modo || !G.W) return;
  const x = e.clientX / innerWidth * G.W, y = e.clientY / innerHeight * G.H, now = performance.now();
  let p = G.pt;
  if (!p || now - p.t > 300 || down) G.pt = { x, y, px: x, py: y, t: now };
  else { p.x = x; p.y = y; p.t = now; }
}

/* ---- control del ciclo ---- */
function gArrancar() {
  if (!SP.b0) crearSprites();
  if (!G.W) gResize(true);
  if (!G.run) { G.run = true; G.last = 0; requestAnimationFrame(gLoop); }
}
function gDetener() {
  G.run = false; G.ents.length = 0; G.manos.length = 0;
  gx.setTransform(1, 0, 0, 1, 0, 0); gx.clearRect(0, 0, gc.width, gc.height);
  for (let i = 0; i < PM; i++) parts[i].l = 0;
  G.txts.length = 0; G.rings.length = 0;
  for (let i = 0; i < HN; i++) hist[i].n = 0;
}
function gAmbiente(on) {
  if (on) {
    if (estado.juego) return;
    G.modo = 'ambiente'; G.fase = 'idle'; G.spawn = .3; G.dur = CONFIG.duracionJuego;
    gArrancar();
  } else if (G.modo === 'ambiente') { G.modo = null; gDetener(); }
}

function leerRecord(m) { try { return +localStorage.getItem('ia_gestos_record_' + m) || 0; } catch (e) { return 0; } }

function iniciarJuego(modo) {
  if (!TXT_JUEGO[modo]) return;
  if (!estado.juego) {
    estado.juegoVideoEstaba = !!vFront.getAttribute('src') && !vFront.paused;
    if (estado.juegoVideoEstaba) vFront.pause();
  }
  ocultarBienvenida(); ocultarReticula();
  estado.juego = modo;
  document.body.classList.add('en-juego');
  G.modo = modo; G.fase = modo === 'aura' ? 'jugando' : 'cuenta';
  G.ents.length = 0; G.txts.length = 0; G.rings.length = 0;
  for (let i = 0; i < PM; i++) parts[i].l = 0;
  G.puntos = 0; G.combo = 0; G.comboT = 0; G.dur = CONFIG.duracionJuego || 40; G.tiempo = G.dur;
  G.cuenta = 3.2; G.spawn = 0; G.lento = 0; G.shake = 0; G.flash = 0; G.nuevoRec = false;
  G.finT = 0; G.ocio = 0; G.aplauso = 0; G.dPrev = 1e9; G.jP = -1; G.jCm = ''; G.jCuenta = -1;
  G.record = leerRecord(modo);
  G.rt.length = 0; G.sm = modo === 'simon' ? { seq: [], f: 'm', i: 0, t: 0, lit: -1, litT: 0, cd: 0, ronda: 0 } : null;
  const T = TXT_JUEGO[modo];
  E.jTitulo.querySelector('b').textContent = T.t;
  E.jTitulo.querySelector('span').textContent = T.s;
  E.jTitulo.classList.add('v'); G.tituloT = modo === 'aura' ? 5 : 3.2;
  E.jTop.classList.toggle('oculto', modo === 'aura');
  E.jRes.classList.add('oculto');
  E.jCuenta.textContent = ''; E.jPuntos.textContent = '0'; E.jCombo.textContent = ''; E.jBarra.style.transform = 'scaleX(1)';
  E.jUI.classList.remove('oculto');
  gArrancar();
  if (modo === 'aura') sonido('ya');
}

function salirJuego(quieto) {
  if (!estado.juego) return;
  estado.juego = null; G.fase = 'idle';
  document.body.classList.remove('en-juego');
  E.jUI.classList.add('oculto');
  G.modo = null; gDetener();
  if (quieto) return;
  if (estado.juegoVideoEstaba) vFront.play().catch(() => {});
  else mostrarBienvenida();
}

function terminarRonda() {
  G.fase = 'fin'; G.finT = 0; G.fuegoT = 0;
  const rec = leerRecord(G.modo);
  G.nuevoRec = G.puntos > rec && G.puntos > 0;
  if (G.nuevoRec) { try { localStorage.setItem('ia_gestos_record_' + G.modo, String(G.puntos)); } catch (e) {} }
  $('jResTitulo').textContent = G.nuevoRec ? '¡Increíble! 🎉' : (G.puntos >= 300 ? '¡Qué manos! 👏' : '¡Tiempo!');
  $('jResPuntos').textContent = G.puntos;
  $('jResRec').textContent = G.nuevoRec ? '🏆 ¡NUEVO RÉCORD!' : 'Récord: ' + rec;
  E.jRes.classList.remove('oculto');
  E.jCuenta.textContent = '';
  sonido('fin');
}

$('btnSalirJuego').addEventListener('click', () => salirJuego());
$('btnMenu').addEventListener('click', () => salirJuego());
$('btnOtra').addEventListener('click', () => iniciarJuego(G.modo));

/* ---- partículas / anillos / textos ---- */
function gP(x, y, vx, vy, vida, r, c, g) {
  const p = parts[pI]; pI = (pI + 1) % PM;
  p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.l = p.v = vida; p.r = r; p.c = c; p.g = g || 0;
}
function gChispas(x, y, n, vel, cols, vida, grav) {
  n = Math.ceil(n * (CONFIG.reduceEffects ? .5 : 1));
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.2832, s = vel * (.3 + Math.random() * .7);
    gP(x, y, Math.cos(a) * s, Math.sin(a) * s, vida * (.6 + Math.random() * .6), (1.5 + Math.random() * 2.5) * G.u + 1, cols[(Math.random() * cols.length) | 0], grav);
  }
}
function ringAdd(x, y, r0, r1, t, c) { if (G.rings.length < 24) G.rings.push({ x, y, r0, r1, l: t, v: t, c }); }
function txtAdd(x, y, s, c, big) { if (G.txts.length < 14) G.txts.push({ x: clamp(x, 30, G.W - 30), y, s, c, l: 1, v: 1, big: big ? 1.5 : 1 }); }

/* ---- colisiones (cápsula prev→actual para barridos rápidos) ---- */
function segDist(ax, ay, bx, by, px, py) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + dx * t - px, cy = ay + dy * t - py;
  return Math.sqrt(cx * cx + cy * cy);
}
function golpe(ex, ey, er, tips) {
  const u = G.u;
  for (let i = 0; i < G.manos.length; i++) {
    const h = G.manos[i], rT = Math.max(16 * u, h.hs * .17), rP = Math.max(34 * u, h.hs * .6);
    for (let j = 0; j < (tips ? 5 : 6); j++) {
      if (segDist(h.q0[2 * j], h.q0[2 * j + 1], h.q1[2 * j], h.q1[2 * j + 1], ex, ey) < (j === 5 ? rP : rT) + er) return true;
    }
  }
  const p = G.pt;
  if (p && G.nowT - p.t < 160 && segDist(p.px, p.py, p.x, p.y, ex, ey) < 28 * u + er) return true;
  return false;
}

/* ---- entidades ---- */
function spawnBurbuja(amb, yRand) {
  const u = G.u, r = (amb ? 26 + Math.random() * 34 : 24 + Math.random() * 42) * u;
  let tipo = 'b';
  if (!amb) { const q = Math.random(); if (q < .06) tipo = 'o'; else if (q < .14) tipo = 'c'; else if (q < .19) tipo = 'h'; }
  const prog = 1 - G.tiempo / G.dur;
  G.ents.push({
    x: r + Math.random() * (G.W - 2 * r), y: yRand ? G.H * (.15 + Math.random() * .7) : G.H + r,
    r: tipo === 'o' ? r * .8 : r,
    vx: 0, vy: -(60 + Math.random() * 70) * u * (1 + prog * .8) * (amb ? .6 : 1) * (tipo === 'o' ? 1.5 : 1),
    tipo, spr: tipo === 'b' ? 'b' + ((Math.random() * 6) | 0) : tipo,
    ph: Math.random() * 6.28, fr: .8 + Math.random() * 1.2, am: (10 + Math.random() * 25) * u, popEn: 0, m: 0
  });
}
function spawnEstrella() {
  const u = G.u, prog = 1 - G.tiempo / G.dur, q = Math.random();
  let tipo = 's', r = (24 + Math.random() * 16) * u;
  if (q < .08) { tipo = 'k'; r = 30 * u; } else if (q < .2 + prog * .12) { tipo = 'm'; r = (28 + Math.random() * 14) * u; }
  const e = {
    x: r + Math.random() * (G.W - 2 * r), y: -r, r, tipo, spr: tipo, ph: Math.random() * 6.28, fr: 1, am: 0,
    vx: 0, vy: (120 + Math.random() * 90) * u * (1 + prog * .7), popEn: 0, m: 0, rot: 0, vr: (Math.random() - .5) * 3
  };
  if (tipo === 'k') { e.vy = 330 * u; e.vx = (Math.random() < .5 ? -1 : 1) * 120 * u; }
  if (tipo === 'm') e.vy *= .85;
  G.ents.push(e);
}
function sembrar() { for (let i = 0; i < 6; i++) spawnBurbuja(false, true); }

function colorEnt(e) {
  switch (e.tipo) { case 'b': return (+e.spr.slice(1) * 2) % PAL.length; case 'o': return 3; case 'h': return 1; case 'c': return 4; case 's': return 3; case 'k': return 0; default: return 6; }
}
function sumar(base, x, y, c) {
  G.combo++; G.comboT = 1.5;
  const mult = Math.min(5, 1 + ((G.combo / 5) | 0)), pts = base * mult;
  G.puntos += pts;
  txtAdd(x, y, '+' + pts + (mult > 1 ? ' ×' + mult : ''), c, base >= 50);
}

function reventar(e) {
  if (e.m) return;
  e.m = 1;
  const ci = colorEnt(e), u = G.u, amb = G.modo === 'ambiente';
  ringAdd(e.x, e.y, e.r * .4, e.r * 2.1, .35, ci);
  gChispas(e.x, e.y, 10, 130 * u, [ci, 5, ci], .6, 70 * u);
  if (amb) { if (G.nowT - (G.lastPop || 0) > 60) { G.lastPop = G.nowT; sonido('pop', 0); } return; }
  switch (e.tipo) {
    case 'b': sumar(10, e.x, e.y, PAL[ci]); sonido('pop', G.combo); break;
    case 'o':
      sumar(50, e.x, e.y, PAL[3]); G.tiempo = Math.min(G.dur + 10, G.tiempo + 3);
      txtAdd(e.x, e.y - 30 * u, '+3 s ⏱', PAL[5], true);
      gChispas(e.x, e.y, 30, 260 * u, [3, 5, 6], 1, 90 * u); ringAdd(e.x, e.y, e.r, e.r * 4, .6, 3);
      G.flash = .35; G.flashC = '#ffd24a'; sonido('oro'); break;
    case 'c':
      sumar(20, e.x, e.y, PAL[4]); ringAdd(e.x, e.y, e.r, 170 * u, .5, 2);
      for (const o of G.ents) {
        if (o.m || o.popEn || o === e) continue;
        const d = Math.hypot(o.x - e.x, o.y - e.y);
        if (d < 190 * u) o.popEn = G.sim + .06 + d / 650;
      }
      sonido('pop', G.combo); break;
    case 'h':
      sumar(20, e.x, e.y, PAL[1]); G.lento = 3.5; txtAdd(e.x, e.y - 30 * u, '❄ tiempo lento', PAL[1], true);
      ringAdd(e.x, e.y, e.r, 300 * u, .7, 1); G.flash = .3; G.flashC = '#7fe6ff'; sonido('hielo'); break;
    case 's': sumar(10, e.x, e.y, PAL[3]); sonido('estrella', G.combo); break;
    case 'k':
      sumar(50, e.x, e.y, PAL[0]); gChispas(e.x, e.y, 30, 280 * u, [0, 1, 5], 1, 80 * u);
      ringAdd(e.x, e.y, e.r, e.r * 4, .6, 0); G.flash = .25; G.flashC = '#38ffb0'; sonido('oro'); break;
    case 'n': sumar(15, e.x, e.y, PAL[0]); sonido('estrella', G.combo); break;
    case 'm':
      G.puntos = Math.max(0, G.puntos - 15); G.combo = 0; G.comboT = 0; G.shake = .45;
      txtAdd(e.x, e.y, '−15', '#ff6b6b', true); G.flash = .4; G.flashC = '#ff2a2a';
      gChispas(e.x, e.y, 24, 260 * u, [6, 2, 3], .9, 120 * u); sonido('mal'); break;
  }
}

/* ---- paso de simulación ---- */
function gPaso(dt, now) {
  G.nowT = now; G.sim += dt;
  const u = G.u, modo = G.modo, amb = modo === 'ambiente';

  // manos suavizadas (la detección va a ~20 fps, el juego a 60)
  const k = 1 - Math.exp(-dt * 24);
  let hayMano = false;
  for (let i = G.manos.length - 1; i >= 0; i--) {
    const h = G.manos[i];
    if (now - h.vis > 350) { G.manos.splice(i, 1); continue; }
    h.q0.set(h.q1);
    for (let j = 0; j < 42; j++) h.p[j] += (h.t[j] - h.p[j]) * k;
    gPuntosMano(h, h.q1);
    h.hs = Math.hypot(h.p[0] - h.p[18], h.p[1] - h.p[19]) || 1;
    hayMano = true;
  }
  const pt = G.pt, ptViva = pt && now - pt.t < 400;
  if (hayMano || ptViva) G.ocio = 0; else G.ocio += dt;

  // huellas (fantasmas de la silueta)
  if (G.manos.length && now - G.hT > (modo === 'aura' ? 60 : 50)) {
    G.hT = now;
    const e = hist[G.hN++ % HN];
    e.t = now; e.n = Math.min(2, G.manos.length);
    e.a.set(G.manos[0].p); if (e.n > 1) e.b.set(G.manos[1].p);
  }

  // fases
  if (G.fase === 'cuenta') {
    G.cuenta -= dt;
    const idx = Math.ceil(G.cuenta / .8);
    if (idx !== G.jCuenta) {
      G.jCuenta = idx;
      const txt = idx >= 4 ? '3' : idx === 3 ? '2' : idx === 2 ? '1' : idx === 1 ? '¡YA!' : '';
      E.jCuenta.textContent = txt;
      if (txt && HAS_WAAPI) E.jCuenta.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.15)', opacity: 1, offset: .35 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }], { duration: 650, easing: 'ease-out' });
      if (idx > 1 && idx <= 4) sonido('cuenta'); else if (idx === 1) sonido('ya');
    }
    if (G.cuenta <= 0) { G.fase = 'jugando'; E.jCuenta.textContent = ''; G.spawn = 0; if (modo === 'simon') simonNuevo(); }
  } else if (G.fase === 'jugando' && !amb) {
    if (modo !== 'aura') { if (!(G.sm && G.sm.f === 'm')) G.tiempo -= dt; if (G.tiempo <= 0) { G.tiempo = 0; terminarRonda(); } }
    else if (G.ocio > 30) { salirJuego(); return; }
  } else if (G.fase === 'fin') {
    G.finT += dt;
    if (G.nuevoRec && G.fuegoT <= G.finT) {
      G.fuegoT = G.finT + .4;
      const x = rnd(.15, .85) * G.W, y = rnd(.15, .55) * G.H, c = [(Math.random() * 7) | 0, (Math.random() * 7) | 0];
      gChispas(x, y, 36, 240 * u, c, 1.3, 110 * u); ringAdd(x, y, 6, 90 * u, .5, c[0]); sonido('pop', 8);
    }
    if (G.finT > 12) { salirJuego(); return; }
  }
  if (G.tituloT > 0) { G.tituloT -= dt; if (G.tituloT <= 0) E.jTitulo.classList.remove('v'); }
  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
  if (G.lento > 0) G.lento -= dt;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 2);
  if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 2.2);

  // aparición
  const jugable = amb || G.fase === 'jugando';
  if (jugable) {
    if (modo === 'ninja' || modo === 'ritmo' || amb) {
      G.spawn -= dt;
      if (G.spawn <= 0) {
        const prog = 1 - G.tiempo / G.dur;
        if (amb) { G.spawn = 1.1; if (G.ents.length < (CONFIG.reduceEffects ? 5 : 8)) spawnBurbuja(true, false); }
        else if (modo === 'ninja') { G.spawn = Math.max(.6, 1.2 - prog * .5) * rnd(.8, 1.2); lanzarNinja(); }
        else { G.spawn = Math.max(.45, .75 - prog * .3); nuevoRitmo(); }
      }
    }
  }

  // entidades
  const lenta = G.lento > 0 ? .35 : 1;
  let w = 0;
  for (let i = 0; i < G.ents.length; i++) {
    const e = G.ents[i];
    if (!e.m) {
      e.ph += dt * e.fr * 2;
      e.x += (e.vx + Math.cos(e.ph) * e.am) * dt * lenta;
      if (e.g) e.vy += e.g * dt * lenta;
      e.y += e.vy * dt * lenta;
      if (e.rot !== undefined) e.rot += e.vr * dt;
      if (e.tipo === 'k' && Math.random() < .8) gP(e.x, e.y, rnd(-20, 20), rnd(-30, 0), .5, (2 + Math.random() * 2.5) * u + 1, Math.random() < .5 ? 0 : 5, 0);
      if (e.popEn && G.sim >= e.popEn) reventar(e);
      else if ((e.vy < 0 && e.y < -e.r * 2) || (e.vy > 0 && (e.y > G.H + e.r * 2 || e.x < -e.r * 3 || e.x > G.W + e.r * 3))) e.m = 1;
      else if (jugable && !e.popEn && (modo === 'ninja' ? corte(e) : golpe(e.x, e.y, e.r * .85))) reventar(e);
    }
    if (!e.m) G.ents[w++] = e;
  }
  G.ents.length = w;

  if (jugable && modo === 'ritmo') pasoRitmo(dt);
  if (jugable && modo === 'simon' && G.sm) pasoSimon(dt);

  // aura: cintas de luz por dedo + onda al juntar las palmas
  if (modo === 'aura') {
    for (let hi = 0; hi < G.manos.length; hi++) {
      const h = G.manos[hi];
      if (!h.rib) h.rib = [[], [], [], [], []];
      for (let j = 0; j < 5; j++) {
        const x = h.q1[2 * j], y = h.q1[2 * j + 1], r = h.rib[j], n = r.length;
        if (!n || Math.hypot(x - r[n - 3], y - r[n - 2]) > 2.5 * u) r.push(x, y, now);
        while (r.length && now - r[2] > 1800) r.splice(0, 3);
        if (Math.hypot(x - h.q0[2 * j], y - h.q0[2 * j + 1]) > 7 * u && Math.random() < .5) gP(x, y, rnd(-40, 40) * u, rnd(-50, 10) * u, .8, (1.5 + Math.random() * 2) * u + 1, (j + hi * 2) % PAL.length, 40 * u);
      }
    }
    if (G.manos.length >= 2) {
      const a = G.manos[0], b = G.manos[1], d = Math.hypot(a.q1[10] - b.q1[10], a.q1[11] - b.q1[11]);
      const lim = Math.max(a.hs, b.hs) * 1.6;
      if (G.dPrev >= lim && d < lim && G.sim - G.aplauso > .8) {
        G.aplauso = G.sim;
        const mx = (a.q1[10] + b.q1[10]) / 2, my = (a.q1[11] + b.q1[11]) / 2;
        ringAdd(mx, my, 10, G.W * .55, .9, 1); ringAdd(mx, my, 10, G.W * .4, .7, 2); ringAdd(mx, my, 10, G.W * .28, .5, 0);
        gChispas(mx, my, 60, 420 * u, [0, 1, 2, 3, 4], 1.2, 40 * u);
        G.flash = .25; G.flashC = '#a78bff'; G.shake = .25; sonido('onda');
      }
      G.dPrev = d;
    } else G.dPrev = 1e9;
  }

  // partículas, anillos y textos
  for (let i = 0; i < PM; i++) {
    const p = parts[i];
    if (p.l <= 0) continue;
    p.l -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (let i = G.rings.length - 1; i >= 0; i--) { const r = G.rings[i]; r.l -= dt; if (r.l <= 0) G.rings.splice(i, 1); }
  for (let i = G.txts.length - 1; i >= 0; i--) { const t = G.txts[i]; t.l -= dt * .9; t.y -= 46 * u * dt; if (t.l <= 0) G.txts.splice(i, 1); }

  gHUD();
  if (ptViva) { pt.px = pt.x; pt.py = pt.y; }
}

function gHUD() {
  if (G.modo === 'ambiente' || G.modo === 'aura') return;
  if (G.puntos !== G.jP) { G.jP = G.puntos; E.jPuntos.textContent = G.puntos; }
  E.jBarra.style.transform = 'scaleX(' + clamp(G.tiempo / G.dur, 0, 1).toFixed(3) + ')';
  const mult = Math.min(5, 1 + ((G.combo / 5) | 0));
  const cm = G.combo >= 3 && G.fase === 'jugando' ? '🔥 COMBO ' + G.combo + (mult > 1 ? ' · ×' + mult : '') : '';
  if (cm !== G.jCm) { G.jCm = cm; E.jCombo.textContent = cm; }
}

/* ---- dibujo ---- */
function dibujarGhosts(now) {
  const g = gx, life = G.modo === 'aura' ? 1700 : 650, base = G.u * 7;
  g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
  const af = G.modo === 'ambiente' ? .7 : 1;
  for (let i = 0; i < HN; i++) {
    const e = hist[i];
    if (!e.n) continue;
    const age = now - e.t;
    if (age > life) { e.n = 0; continue; }
    if (age < 70) continue;
    const f = 1 - age / life;
    g.globalAlpha = f * f * .45 * af;
    g.strokeStyle = GH[Math.min(GH.length - 1, (age / life * GH.length) | 0)];
    g.lineWidth = base * (.45 + .55 * f);
    g.beginPath();
    for (let hh = 0; hh < e.n; hh++) {
      const a = hh ? e.b : e.a;
      for (let c = 0; c < CF.length; c += 2) { const p = CF[c], q = CF[c + 1]; g.moveTo(a[2 * p], a[2 * p + 1]); g.lineTo(a[2 * q], a[2 * q + 1]); }
    }
    g.stroke();
  }
}

function dibujarCintas(now) {
  const g = gx, u = G.u;
  g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let hi = 0; hi < G.manos.length; hi++) {
    const h = G.manos[hi];
    if (!h.rib) continue;
    for (let j = 0; j < 5; j++) {
      const r = h.rib[j], n = r.length / 3;
      if (n < 2) continue;
      g.strokeStyle = 'hsl(' + ((j * 58 + hi * 30 + G.sim * 45) % 360 | 0) + ',100%,62%)';
      for (let b = 0; b < 4; b++) {
        const i0 = Math.floor(n * b / 4), i1 = Math.min(n - 1, Math.floor(n * (b + 1) / 4));
        if (i1 <= i0) continue;
        g.globalAlpha = .2 + b * .22; g.lineWidth = (2 + b * 2.2) * u;
        g.beginPath(); g.moveTo(r[3 * i0], r[3 * i0 + 1]);
        for (let i = i0 + 1; i <= i1; i++) g.lineTo(r[3 * i], r[3 * i + 1]);
        g.stroke();
      }
    }
  }
}

function dibujarManos() {
  const g = gx, u = G.u, af = G.modo === 'ambiente' ? .65 : 1;
  g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < G.manos.length; i++) {
    const h = G.manos[i], p = h.p, col = i % 2 ? '#ff4d9d' : '#38ffb0';
    // palma
    g.globalAlpha = .16 * af; g.fillStyle = col; g.beginPath();
    for (let k = 0; k < PALMA.length; k++) { const q = PALMA[k]; if (k) g.lineTo(p[2 * q], p[2 * q + 1]); else g.moveTo(p[2 * q], p[2 * q + 1]); }
    g.closePath(); g.fill();
    // silueta gruesa + línea fina
    g.beginPath();
    for (let c = 0; c < CF.length; c += 2) { const a = CF[c], b = CF[c + 1]; g.moveTo(p[2 * a], p[2 * a + 1]); g.lineTo(p[2 * b], p[2 * b + 1]); }
    g.strokeStyle = col; g.globalAlpha = .3 * af; g.lineWidth = Math.max(5 * u, h.hs * .16); g.stroke();
    g.strokeStyle = '#d8fff1'; g.globalAlpha = .9 * af; g.lineWidth = Math.max(1.5, 2 * u); g.stroke();
    // puntas brillantes
    const s = Math.max(18 * u, h.hs * .22), gl = SP['gl' + (i % 2)];
    g.globalAlpha = af;
    for (let j = 0; j < 5; j++) g.drawImage(gl, h.q1[2 * j] - s, h.q1[2 * j + 1] - s, s * 2, s * 2);
  }
}

function gDibujar(now) {
  const g = gx, W = G.W, H = G.H, u = G.u, modo = G.modo, amb = modo === 'ambiente';
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  if (G.shake > 0) { const s = G.shake * 16 * u; g.translate((Math.random() - .5) * s, (Math.random() - .5) * s); }
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;

  if (!amb) {
    g.fillStyle = G.bg; g.fillRect(-30, -30, W + 60, H + 60);
    g.fillStyle = '#fff';
    for (let i = 0; i < G.estrellas.length; i++) {
      const s = G.estrellas[i];
      g.globalAlpha = .2 + .4 * Math.abs(Math.sin(G.sim * s.f + s.p));
      g.fillRect(s.x * W, s.y * H, s.r, s.r);
    }
    g.globalAlpha = 1;
  }
  if (G.lento > 0) { g.fillStyle = 'rgba(120,220,255,.10)'; g.fillRect(-30, -30, W + 60, H + 60); }

  dibujarGhosts(now);
  if (modo === 'aura') dibujarCintas(now);

  // entidades
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < G.ents.length; i++) {
    const e = G.ents[i], s = SP[e.spr], r = e.r;
    if (!s) continue;
    g.globalAlpha = e.popEn ? .55 + .45 * Math.sin(G.sim * 40) : 1;
    if (e.rot !== undefined) {
      const pul = e.tipo === 'm' ? 1 + .08 * Math.sin(G.sim * 10) : 1;
      g.save(); g.translate(e.x, e.y); g.rotate(e.rot); g.drawImage(s, -r * pul, -r * pul, 2 * r * pul, 2 * r * pul); g.restore();
    } else {
      const wob = 1 + Math.sin(e.ph * 1.7) * .04;
      g.drawImage(s, e.x - r * wob, e.y - r / wob, 2 * r * wob, 2 * r / wob);
    }
  }
  g.globalAlpha = 1;

  dibujarExtra();
  dibujarManos();

  // anillos + partículas (aditivo)
  g.globalCompositeOperation = 'lighter'; g.lineWidth = 3 * u;
  for (let i = 0; i < G.rings.length; i++) {
    const r = G.rings[i], f = 1 - r.l / r.v;
    g.globalAlpha = (1 - f) * .85; g.strokeStyle = PAL[r.c];
    g.beginPath(); g.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - f, 2)), 0, 6.2832); g.stroke();
  }
  let last = -1;
  for (let i = 0; i < PM; i++) {
    const p = parts[i];
    if (p.l <= 0) continue;
    if (p.c !== last) { g.fillStyle = PAL[p.c]; last = p.c; }
    const a = p.l / p.v;
    g.globalAlpha = a;
    g.beginPath(); g.arc(p.x, p.y, p.r * (.4 + .6 * a), 0, 6.2832); g.fill();
  }

  // textos flotantes
  g.globalCompositeOperation = 'source-over'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  for (let i = 0; i < G.txts.length; i++) {
    const t = G.txts[i];
    g.globalAlpha = Math.min(1, t.l * 1.6);
    g.font = '800 ' + Math.round(22 * u * t.big * (1 + (1 - t.l) * .2)) + 'px -apple-system,Segoe UI,sans-serif';
    g.lineWidth = 4 * u; g.strokeStyle = 'rgba(3,6,12,.8)'; g.strokeText(t.s, t.x, t.y);
    g.fillStyle = t.c; g.fillText(t.s, t.x, t.y);
  }
  if (G.flash > 0) { g.globalAlpha = G.flash * .5; g.fillStyle = G.flashC; g.fillRect(-30, -30, W + 60, H + 60); }
  g.globalAlpha = 1;
}

function gLoop(t) {
  if (!G.run) return;
  requestAnimationFrame(gLoop);
  if (document.hidden) { G.last = t; return; }
  if (G.modo === 'ambiente' && CONFIG.reduceEffects) { G.skip ^= 1; if (G.skip) return; }
  const dt = clamp((t - (G.last || t)) / 1000, .001, .05);
  G.last = t;
  gPaso(dt, t);
  if (G.run) gDibujar(t);
}

/* ═══════════════════════════════════════════════════════════════
   📴 USO SIN INTERNET
   · sw.js guarda la app (html/css/js) apenas se abre por primera vez
   · el botón de ⚙️ Configurar guarda los videos y el motor de gestos
   ═══════════════════════════════════════════════════════════════ */
const MEDIA_CACHE = 'holo-media-v1';
const MP_LOCAL = ['vision_bundle.mjs', 'wasm/vision_wasm_internal.js', 'wasm/vision_wasm_internal.wasm',
                  'wasm/vision_wasm_nosimd_internal.js', 'wasm/vision_wasm_nosimd_internal.wasm', 'hand_landmarker.task'];
const esVideoUrl = u => /\.(mp4|webm|m4v|mov)$/i.test(new URL(u, location.href).pathname);

function urlsVideoPropios() {
  const out = [];
  VIDEOS.forEach(v => {
    v = (v || '').trim();
    if (!v) return;
    try { const u = new URL(v, location.href); if (u.origin === location.origin) out.push(u.href); } catch (e) {}
  });
  return out;
}
async function mpLocalExiste() {
  try { const r = await fetch('./mediapipe/vision_bundle.mjs', { method: 'HEAD', cache: 'no-cache' }); return r.ok; }
  catch (e) { return false; }
}

async function estadoOffline() {
  const st = $('offEstado');
  if (!st) return;
  if (!('caches' in window)) { st.textContent = 'Este navegador no permite guardar archivos para uso sin internet.'; return; }
  try {
    const c = await caches.open(MEDIA_CACHE), ks = await c.keys();
    const nv = ks.filter(r => esVideoUrl(r.url)).length, tot = urlsVideoPropios().length;
    const mp = ks.some(r => /vision_bundle|hand_landmarker/.test(r.url));
    if (nv >= tot && tot > 0 && mp) st.textContent = '✅ Todo guardado (' + nv + ' videos + detector). Ya funciona sin internet.';
    else if (nv || mp) st.textContent = 'Guardado parcial: ' + nv + '/' + tot + ' videos' + (mp ? ' + detector' : ' · falta el detector') + '. Con WiFi, tocá el botón para completar.';
    else st.textContent = 'Todavía no hay nada guardado. Con WiFi, tocá el botón (los videos pesan, tarda un rato).';
  } catch (e) { st.textContent = 'No se pudo leer lo guardado.'; }
}

async function guardarOffline() {
  const st = $('offEstado'), b1 = $('btnOffline'), b2 = $('btnBorrarOff');
  if (!('caches' in window)) { estadoOffline(); return; }
  b1.disabled = b2.disabled = true;
  try {
    const cache = await caches.open(MEDIA_CACHE);
    const lista = urlsVideoPropios().map(u => ({ u, fresco: true }));
    if (await mpLocalExiste()) {
      MP_LOCAL.forEach(p => lista.push({ u: new URL('./mediapipe/' + p, location.href).href, fresco: true }));
    } else {
      ['vision_bundle.mjs', 'wasm/vision_wasm_internal.js', 'wasm/vision_wasm_internal.wasm',
       'wasm/vision_wasm_nosimd_internal.js', 'wasm/vision_wasm_nosimd_internal.wasm']
        .forEach(p => lista.push({ u: CONFIG.mpCdn + '/' + p, fresco: false }));
      lista.push({ u: CONFIG.modeloUrl, fresco: false });
    }
    let ok = 0; const fallos = [];
    for (let i = 0; i < lista.length; i++) {
      const { u, fresco } = lista[i], nombre = u.split('/').pop();
      st.textContent = '⏳ Guardando ' + (i + 1) + '/' + lista.length + ' · ' + nombre + '…';
      try {
        // el "?r=" evita que el service worker nos devuelva la copia vieja al actualizar
        const res = await fetch(fresco ? u + '?r=' + Date.now() : u, fresco ? { cache: 'reload' } : { mode: 'cors' });
        if (!res.ok || res.status !== 200) throw new Error('HTTP ' + res.status);
        await cache.put(u, res);
        ok++;
      } catch (e) { fallos.push(nombre); }
    }
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    await estadoOffline();
    if (fallos.length) st.textContent += ' · No se pudo guardar: ' + fallos.join(', ');
  } catch (e) {
    st.textContent = 'Error al guardar: ' + ((e && e.message) || e);
  }
  b1.disabled = b2.disabled = false;
}

async function borrarOffline() {
  try { await caches.delete(MEDIA_CACHE); } catch (e) {}
  estadoOffline();
}

function seccionOffline() {
  const p = $('configPanel');
  const t = document.createElement('label'); t.textContent = '📴 Uso sin internet';
  const st = document.createElement('div'); st.id = 'offEstado'; st.className = 'hint'; st.textContent = 'Revisando…';
  const b1 = document.createElement('button'); b1.id = 'btnOffline'; b1.type = 'button'; b1.className = 'sec small';
  b1.textContent = '📥 Guardar videos y detector para offline';
  const b2 = document.createElement('button'); b2.id = 'btnBorrarOff'; b2.type = 'button'; b2.className = 'sec small';
  b2.textContent = '🗑️ Borrar copia guardada';
  p.append(t, st, b1, b2);
  b1.addEventListener('click', guardarOffline);
  b2.addEventListener('click', borrarOffline);
  estadoOffline();
}

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(e => console.warn('Service worker:', e)); });
}

/* ═══════════════════════════════════════════════════════════════
   ARRANQUE
   ═══════════════════════════════════════════════════════════════ */
fxTam();
aplicarTextos();
aplicarEfectos();
ajustarCanvas();
gResize(true);
if (!hayConfigGuardada) aplicarPreset('auto');   // primera vez: elige según el hardware
sincronizarUI();
sincronizarCamUI();
actualizarBotonFull();
actualizarBotonMute();
setEstado('Listo para iniciar');


/* ═══════════════════════════════════════════════════════════════
   STAND VIVO: cartel rotativo que invita a los visitantes
   (solo trabaja con la bienvenida visible; en pausa no gasta nada)
   ═══════════════════════════════════════════════════════════════ */
/* ═══ NUEVOS JUEGOS ═══ */
G.rt = []; G.sm = null;
const GRAV = 1000, RT = 1.25, SM_C = [3, 1, 2, 0];

/* ⚔️ Corte Ninja: objetos lanzados en parábola; solo cortan los movimientos rápidos */
function lanzarNinja() {
  const u = G.u, prog = 1 - G.tiempo / G.dur, n = 1 + ((Math.random() * (2 + prog * 2)) | 0);
  for (let i = 0; i < n; i++) {
    const q = Math.random(), tipo = q < .09 ? 'o' : q < .17 + prog * .12 ? 'm' : 'n', r = (30 + Math.random() * 12) * u;
    const x = G.W * (.15 + Math.random() * .7), h = G.H * (.5 + Math.random() * .35);
    G.ents.push({ x, y: G.H + r, r, tipo, spr: tipo === 'n' ? 'n' + ((Math.random() * 5) | 0) : tipo, ph: 0, fr: 0, am: 0,
      vx: (G.W / 2 - x) * rnd(.2, .5), vy: -Math.sqrt(2 * GRAV * u * h), g: GRAV * u, rot: 0, vr: rnd(-4, 4), popEn: 0, m: 0 });
  }
}
function corte(e) {
  const u = G.u, r = e.r * .9 + 12 * u;
  for (const h of G.manos) for (let j = 0; j < 5; j++) {
    const a = h.q0[2 * j], b = h.q0[2 * j + 1], c = h.q1[2 * j], d = h.q1[2 * j + 1];
    if (Math.hypot(c - a, d - b) > 5 * u && segDist(a, b, c, d, e.x, e.y) < r) return true;
  }
  const p = G.pt;
  return !!(p && G.nowT - p.t < 160 && Math.hypot(p.x - p.px, p.y - p.py) > 5 * u && segDist(p.px, p.py, p.x, p.y, e.x, e.y) < r + 8 * u);
}

/* 🎵 Ritmo Holo: aros que se cierran; el momento exacto da más puntos */
function nuevoRitmo() {
  const c = (Math.random() * 5) | 0;
  G.rt.push({ x: G.W * (.16 + Math.random() * .68), y: G.H * (.28 + Math.random() * .46), r: 46 * G.u, a: 0, c, ok: 0 });
  if (CONFIG.sonidos) try { tono(660 + c * 110, .07, 'sine', .05, RT); } catch (e) {}
}
function pasoRitmo(dt) {
  for (let i = G.rt.length - 1; i >= 0; i--) {
    const t = G.rt[i]; t.a += dt;
    if (t.ok) { if (t.a > t.ok) G.rt.splice(i, 1); continue; }
    if (t.a > RT + .35) { G.combo = 0; G.comboT = 0; txtAdd(t.x, t.y, 'MISS', '#ff6b6b'); t.ok = t.a + .05; continue; }
    if (t.a > RT - .4 && golpe(t.x, t.y, t.r, 1)) {
      const per = Math.abs(t.a - RT) < .13;
      sumar(per ? 30 : 15, t.x, t.y, PAL[per ? 3 : t.c]);
      if (per) txtAdd(t.x, t.y - 34 * G.u, '¡PERFECTO!', PAL[5], true);
      ringAdd(t.x, t.y, t.r, t.r * (per ? 3.2 : 2.2), .4, per ? 3 : t.c);
      gChispas(t.x, t.y, per ? 22 : 10, 200 * G.u, [t.c, 5], .7, 60 * G.u);
      sonido('pop', G.combo); t.ok = t.a + .05;
    }
  }
}

/* 🧠 Memoria Holo: secuencia de luces que crece cada ronda */
function padPos(k) { return [G.W * (k % 2 ? .72 : .28), G.H * (k < 2 ? .36 : .68)]; }
function simonTono(k) { if (CONFIG.sonidos) try { tono([392, 494, 587, 784][k], .3, 'sine', .12); } catch (e) {} }
function simonNuevo() {
  const s = G.sm; s.seq.push((Math.random() * 4) | 0);
  s.f = 'm'; s.i = 0; s.t = -.9; s.lit = -1; s.ronda = s.seq.length;
  txtAdd(G.W / 2, G.H * .16, 'Ronda ' + s.ronda, PAL[5], true);
}
function pasoSimon(dt) {
  const s = G.sm, u = G.u, R = 62 * u;
  if (s.lit >= 0) { s.litT -= dt; if (s.litT <= 0) s.lit = -1; }
  if (s.f === 'm') {
    s.t += dt;
    if (s.t < .62) return;
    s.t = 0;
    if (s.i < s.seq.length) { s.lit = s.seq[s.i++]; s.litT = .42; simonTono(s.lit); }
    else { s.f = 'r'; s.i = 0; s.cd = .5; txtAdd(G.W / 2, G.H * .16, '¡Tu turno!', PAL[0], true); }
    return;
  }
  if ((s.cd -= dt) > 0) return;
  for (let k = 0; k < 4; k++) {
    const p = padPos(k), x = p[0], y = p[1];
    if (!golpe(x, y, R, 1)) continue;
    s.lit = k; s.litT = .3; s.cd = .45; simonTono(k);
    if (k === s.seq[s.i]) {
      ringAdd(x, y, R, R * 2.2, .4, SM_C[k]); gChispas(x, y, 8, 160 * u, [SM_C[k], 5], .5, 60 * u);
      if (++s.i >= s.seq.length) { G.puntos += 20 * s.ronda; G.tiempo = Math.min(G.dur + 10, G.tiempo + 2); txtAdd(x, y, '+' + 20 * s.ronda, PAL[3], true); sonido('oro'); simonNuevo(); }
    } else {
      G.shake = .4; G.flash = .3; G.flashC = '#ff2a2a'; G.tiempo = Math.max(0, G.tiempo - 3); sonido('mal');
      s.f = 'm'; s.i = 0; s.t = -.9;
    }
    break;
  }
}
function dibujarExtra() {
  const g = gx, u = G.u;
  g.globalCompositeOperation = 'lighter';
  for (const t of G.rt) {
    if (t.ok) continue;
    const k = Math.max(0, 1 - t.a / RT), col = PAL[t.c];
    g.globalAlpha = .22 + .2 * (1 - k); g.fillStyle = col; g.beginPath(); g.arc(t.x, t.y, t.r, 0, 6.2832); g.fill();
    g.globalAlpha = .9; g.lineWidth = 4 * u; g.strokeStyle = '#fff'; g.beginPath(); g.arc(t.x, t.y, t.r, 0, 6.2832); g.stroke();
    g.strokeStyle = col; g.lineWidth = 5 * u; g.beginPath(); g.arc(t.x, t.y, t.r * (1 + k * 2.4), 0, 6.2832); g.stroke();
  }
  const s = G.sm;
  if (s) for (let k = 0; k < 4; k++) {
    const p = padPos(k), on = s.lit === k, col = PAL[SM_C[k]];
    g.globalAlpha = on ? .85 : .2; g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 4 * u;
    g.beginPath(); g.arc(p[0], p[1], 62 * u * (on ? 1.12 : 1), 0, 6.2832); g.fill(); g.globalAlpha = .8; g.stroke();
  }
  g.globalAlpha = 1;
}

/* ═══ STAND VIVO ═══ */
function confeti() {
  if (CONFIG.reduceEffects) return;
  const EM = ['🎓', '📚', '✏️', '💡', '🔬', '⭐'];
  for (let i = 0; i < 18; i++) {
    const s = document.createElement('span'); s.className = 'confeti'; s.textContent = EM[i % EM.length];
    s.style.left = rnd(2, 96) + '%'; s.style.animationDuration = rnd(3.5, 7) + 's'; s.style.animationDelay = rnd(.3, 3) + 's';
    E.celeb.appendChild(s); setTimeout(() => s.remove(), 11000);
  }
}
(function () {
  const el = $('ticker'); if (!el) return;
  let i = 0, ult = 0;
  const msgs = () => {
    const h = new Date().getHours(), sal = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches', v = leerVisitas();
    return ['👋 ' + sal + '. Acércate y saluda con ambas manos', '💚 Haz un corazón con tus manos y llévate tu recuerdo',
      '⚔️ Forma una L y corta con las manos: Corte Ninja', '🎵 ¿Tienes ritmo? Haz 🤘 y toca al compás', '🧠 Haz 👌 y repite la secuencia de luces',
      '🏆 Récords · Ninja ' + leerRecord('ninja') + ' · Ritmo ' + leerRecord('ritmo') + ' · Memoria ' + leerRecord('simon'),
      '🎓 Hoy ya nos visitaron ' + v.hoy + ' personas', '📸 Tu foto quedará con el nombre de nuestra escuela'];
  };
  const marca = () => { const e = $('brandV'); if (e) e.textContent = '💚 ' + leerVisitas().hoy + ' corazones hoy'; };
  marca(); setInterval(marca, 3000);
  setInterval(() => {
    if (document.hidden || !estado.welcomeVisible) return;
    E.welcome.classList.toggle('dormido', performance.now() - estado.ultimaMano > 15000);
    el.classList.remove('in'); const T = msgs(); i = (i + 1) % T.length;
    setTimeout(() => { el.textContent = T[i]; el.classList.add('in'); }, 350);
  }, 4500);
  el.textContent = msgs()[0]; el.classList.add('in');
  setInterval(() => {   // saludo reactivo: al aparecer una mano el stand "despierta"
    const n = performance.now();
    if (estado.welcomeVisible && n - estado.ultimaMano < 400 && n - ult > 20000) {
      ult = n; E.welcome.classList.add('saludo'); toast('👋 ¡Hola! Te estábamos esperando'); sonido('swipe');
      setTimeout(() => E.welcome.classList.remove('saludo'), 1400);
    }
  }, 300);
})();

/* ═══ v4 · CURSOR DE MANO: apunta con 1 mano y mantén sobre una opción para elegirla ═══ */
(function () {
  document.querySelectorAll('.gestos-grid > [role=button]').forEach((e, i) => { e.dataset.cat = i < 5 ? 'v' : i < 8 ? 'a' : i === 8 ? 'h' : 'j'; });
  const cur = document.createElement('div'); cur.id = 'cursorMano'; $('app').appendChild(cur);
  let el = null, t0 = 0;
  const fin = () => { if (el) { el.classList.remove('sel'); el.style.removeProperty('--p'); el = null; } };
  setInterval(() => {
    if (!(estado.welcomeVisible && G.manos.length === 1 && G.W)) { cur.classList.remove('v'); fin(); return; }
    const h = G.manos[0], x = h.p[16] / G.W * innerWidth, y = h.p[17] / G.H * innerHeight;
    cur.style.transform = 'translate(' + x + 'px,' + y + 'px)'; cur.classList.add('v');
    const c = document.elementFromPoint(x, y), n = c && c.closest('.gestos-grid > [role=button]');
    if (n !== el) { fin(); el = n; t0 = performance.now(); if (n) n.classList.add('sel'); }
    if (!el) { cur.style.setProperty('--p', '0%'); return; }
    const p = Math.min(100, (performance.now() - t0) / 12);
    el.style.setProperty('--p', p + '%'); cur.style.setProperty('--p', p + '%');
    if (p >= 100) { const e = el; fin(); sonido('ok'); e.click(); }
  }, 50);
})();

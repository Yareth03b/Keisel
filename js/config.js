/**
 * Keisel - Configuración Global del Sistema
 * Universidad Nacional de Barranca (UNAB)
 */
const tramoUnabPanamericana = [
  [-10.727196, -77.773131], // Salida de la UNAB
  [-10.728987, -77.777818],
  [-10.737929, -77.771476],
];

const KeiselConfig = {
  // Endpoints del Backend Node.js / Express
  API_BASE_URL: "/api",
  API_LAN_URL: "http://192.168.50.252:3000/api",
  API_TAILSCALE_URL: "http://100.67.14.105:3000/api",

  // Configuración del Mapa Leaflet
  MAP: {
    DEFAULT_CENTER: [-10.7516, -77.761],
    DEFAULT_ZOOM: 15,
    MIN_ZOOM: 12,
    MAX_ZOOM: 19,
    TILE_LAYER: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    ATTRIBUTION:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
  },

  RUTAS: {
    barranca: {
      // Cada punto contiene latitud, longitud y, si es un paradero, su nombre.
      puntos: [
        ...tramoUnabPanamericana,
        [-10.747596, -77.763958],
        [-10.747763, -77.764270, "Paradero Metro"],
        [-10.748985, -77.766826],
        [-10.752422, -77.765306],
        [-10.755454, -77.763623, "Paradero Grau"],
        [-10.760348, -77.760136],
        [-10.759091, -77.758498],
        [-10.756439, -77.755728, "Paradero Próceres"],
        [-10.755973, -77.755452],
        [-10.754934, -77.756341],
        [-10.751870, -77.759001, "Paradero Maxi"],
        [-10.749154, -77.761324],
        [-10.743981, -77.765066],
        [-10.744531, -77.766146],
        [-10.743749, -77.767030],
        [-10.741979, -77.768450],
        ...tramoUnabPanamericana.slice().reverse(),
      ],
    },
    // Centros de las capitales distritales según el directorio 2023 del INEI.
    // https://www.inei.gob.pe/media/MenuRecursivo/publicaciones_digitales/Est/Lib1903/libro.pdf
    supe: { centro: [-10.796111, -77.716111] },
    paramonga: { centro: [-10.674722, -77.818056] },
  },

  // Tiempos y sondeos (ms)
  ESPERA_RUTA_EN_VIVO_MS: 30000,
  POLLING_INTERVAL_MS: 1500,
  REQUEST_TIMEOUT_MS: 4000,
};

// Variables para compatibilidad retroactiva
var API_BASE_URL = KeiselConfig.API_BASE_URL;
var API_TAILSCALE_URL = KeiselConfig.API_TAILSCALE_URL;

/**
 * Notificación Toast Flotante Universal
 */
function showToast(msg) {
  var toast = document.getElementById("toast-notify");
  var toastMsg = document.getElementById("toast-msg");
  if (!toast || !toastMsg) return;

  toastMsg.textContent = msg;
  toast.classList.add("toast-visible");

  if (window.toastTimeout) clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(function () {
    toast.classList.remove("toast-visible");
  }, 2600);
}
window.showToast = showToast;

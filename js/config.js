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
  API_TUNNEL_URL: "",
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
        [-10.741979, -77.768450],
        ...tramoUnabPanamericana.slice().reverse(),
      ],
    },
    // Centros de las capitales distritales según el directorio 2023 del INEI.
    // https://www.inei.gob.pe/media/MenuRecursivo/publicaciones_digitales/Est/Lib1903/libro.pdf
    supe: {
      centro: [-10.796111, -77.716111],
      puntos: [
        [-10.796169, -77.716595, "Paradero Plaza de Armas"],
        [-10.795182, -77.721145],
        [-10.793532, -77.730021],
        [-10.793969, -77.733145],
        [-10.794434, -77.734817, "Paradero Leticia"],
        [-10.796619, -77.740431],
        [-10.796528, -77.740854, "Paradero Puerto Supe"],
        [-10.795020, -77.741208],
        [-10.786236, -77.742093],
        [-10.782545, -77.742422],
        [-10.778150, -77.744337],
        [-10.773474, -77.746587],
        [-10.762525, -77.751896],
        [-10.756861, -77.756184],
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
    paramonga: {
      centro: [-10.674722, -77.818056],
      puntos: [
        [-10.674652762710023, -77.81874886720881, "Salida PGA"],
        [-10.674207003964884, -77.81247601911937, "Paradero Iglesia"],
        [-10.672294457010235, -77.79459179071642],
        [-10.672624143107637, -77.79384404732642],
        [-10.689724745651388, -77.78721696823668],
        [-10.689704362140676, -77.7870558072624],
        [-10.689745374054711, -77.7851508625952],
        [-10.696252062273986, -77.78020169056464, "Paradero Municipalidad"],
        [-10.727224052901311, -77.7771454744742],
        [-10.727560058045674, -77.77688932350878],
        [-10.726589652532605, -77.77434801288788],
        [-10.727552957174582, -77.77398598440554],
        [-10.727172471814264, -77.77301726207142, "Llegada UNAB"],
      ],
      regreso: [
        [-10.727172471814264, -77.77301726207142, "Salida UNAB"],
        [-10.727552957174582, -77.77398598440554],
        [-10.726589652532605, -77.77434801288788],
        [-10.727560058045674, -77.77688932350878],
        [-10.727224052901311, -77.7771454744742],
        [-10.696388359061979, -77.78013778593083, "Paradero Plaza de Pativilca"],
        [-10.689745374054711, -77.7851508625952],
        [-10.689704362140676, -77.7870558072624],
        [-10.689724745651388, -77.78721696823668],
        [-10.672624143107637, -77.79384404732642],
        [-10.672294457010235, -77.79459179071642],
        [-10.674207003964884, -77.81247601911937, "Paradero Iglesia"],
        [-10.674652762710023, -77.81874886720881, "Llegada PGA"],
      ],
    },
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

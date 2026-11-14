/**
 * Keisel - Configuración Global del Sistema
 * Universidad Nacional de Barranca (UNAB)
 */
const KeiselConfig = {
  // Endpoints del Backend Node.js / Express
  API_BASE_URL: "/api",
  API_TAILSCALE_URL: "http://100.67.14.105:3000/api",

  // Configuración del Mapa Leaflet
  MAP: {
    DEFAULT_CENTER: [-10.749, -77.76],
    DEFAULT_ZOOM: 15,
    MIN_ZOOM: 12,
    MAX_ZOOM: 19,
    TILE_LAYER:
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    ATTRIBUTION:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },

  // Tiempos y sondeos (ms)
  POLLING_INTERVAL_MS: 3000,
  REQUEST_TIMEOUT_MS: 4000,
};

// Variables para compatibilidad retroactiva
var API_BASE_URL = KeiselConfig.API_BASE_URL;
var API_TAILSCALE_URL = KeiselConfig.API_TAILSCALE_URL;

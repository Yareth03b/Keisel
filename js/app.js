// --- ESTADO GENERAL Y RUTAS DE API ---

var vistaActiva = "mapa";

// API_BASE_URL y API_TAILSCALE_URL provistos globalmente por js/config.js

// --- ENRUTADOR DE PANTALLAS ---

function navegarA(vista) {
  vistaActiva = "mapa";
  var vMapa = document.getElementById("vista-mapa");
  if (!vMapa) return;
  vMapa.classList.remove("hidden");
  vMapa.style.display = "flex";

  initLeafletMap();
  iniciarPollingGps();
  achicarPanelBuses();

  if (map) {
    setTimeout(function () {
      map.invalidateSize();
    }, 150);
  }
}

// El sitio abre directamente en el mapa, sin selector de acceso.
function arrancarMapa() {
  navegarA("mapa");

  if (map) {
    setTimeout(function () { map.invalidateSize(); }, 100);
    setTimeout(function () { map.invalidateSize(); }, 400);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancarMapa);
} else {
  arrancarMapa();
}

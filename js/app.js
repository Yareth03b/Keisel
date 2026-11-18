// --- ESTADO GENERAL Y RUTAS DE API ---

var vistaActiva = "inicio";

// API_BASE_URL y API_TAILSCALE_URL provistos globalmente por js/config.js

// --- ENRUTADOR DE PANTALLAS ---

function navegarA(vista) {
  vistaActiva = vista;

  var vInicio = document.getElementById("vista-inicio");
  var vMapa = document.getElementById("vista-mapa");

  if (vInicio) {
    vInicio.classList.add("hidden");
    vInicio.style.display = "none";
  }

  if (vMapa) {
    vMapa.classList.add("hidden");
    vMapa.style.display = "none";
  }

  if (vista === "inicio") {
    if (vInicio) {
      vInicio.classList.remove("hidden");
      vInicio.style.display = "flex";
    }
    detenerPollingGps();
  } else if (vista === "mapa") {
    var backText = document.getElementById("btn-mapa-back-text");
    if (backText) {
      backText.innerText = "Estudiantes";
    }

    if (vMapa) {
      vMapa.classList.remove("hidden");
      vMapa.style.display = "flex";
    }

    initLeafletMap();
    iniciarPollingGps();
    achicarPanelBuses();

    if (map) {
      setTimeout(function () {
        map.invalidateSize();
      }, 150);
    }
  }
}

// --- INICIALIZACIÓN SEGÚN LA PÁGINA ---

var esPaginaEstudiantesDirecta =
  window.location.pathname.includes("mapa_estudiantes") ||
  (document.getElementById("vista-inicio") &&
    document.getElementById("vista-inicio").classList.contains("hidden"));

if (esPaginaEstudiantesDirecta) {
  function arrancarMapaEstudiantes() {
    navegarA("mapa");
    initLeafletMap();
    iniciarPollingGps();

    if (map) {
      setTimeout(function () {
        map.invalidateSize();
      }, 100);
      setTimeout(function () {
        map.invalidateSize();
      }, 400);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arrancarMapaEstudiantes);
  } else {
    arrancarMapaEstudiantes();
  }

  window.addEventListener("load", arrancarMapaEstudiantes);
} else {
  window.addEventListener("load", function () {
    if (
      window.location.hash === "#mapa" ||
      window.location.search.includes("mapa")
    ) {
      navegarA("mapa");
    }
  });
}

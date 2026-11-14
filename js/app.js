// --- ESTADO GENERAL Y RUTAS DE API ---

var vistaActiva = "inicio";

var origenVistaMapa = "inicio";

var meadowEngine = null;

var esAdminAutenticado = false;

var API_BASE_URL = "/api";

var API_TAILSCALE_URL = "http://100.67.14.105:3000/api";

// --- ENRUTADOR DE PANTALLAS ---

function navegarA(vista) {
  vistaActiva = vista;

  var vInicio = document.getElementById("vista-inicio");

  var vMapa = document.getElementById("vista-mapa");

  var vAdminLogin = document.getElementById("vista-admin-login");

  var vAdmin = document.getElementById("vista-admin");

  var btnVolverAdmin = document.getElementById("btn-volver-admin");

  if (vInicio) {
    vInicio.classList.add("hidden");
    vInicio.style.display = "none";
  }

  if (vMapa) {
    vMapa.classList.add("hidden");
    vMapa.style.display = "none";
  }

  if (vAdminLogin) {
    vAdminLogin.classList.add("hidden");
    vAdminLogin.style.display = "none";
  }

  if (vAdmin) {
    vAdmin.classList.add("hidden");
    vAdmin.style.display = "none";
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
      if (origenVistaMapa === "admin" || esAdminAutenticado) {
        backText.innerText = "Panel Admin";
      } else {
        backText.innerText = "Estudiantes";
      }
    }

    if (vMapa) {
      vMapa.classList.remove("hidden");
      vMapa.style.display = "flex";
    }

    if (btnVolverAdmin) {
      if (esAdminAutenticado) btnVolverAdmin.classList.remove("hidden");
      else btnVolverAdmin.classList.add("hidden");
    }

    initLeafletMap();

    iniciarPollingGps();

    achicarPanelBuses();

    if (map) {
      setTimeout(function () {
        map.invalidateSize();
      }, 150);
    }
  } else if (vista === "admin-login") {
    if (vAdminLogin) {
      vAdminLogin.classList.remove("hidden");
      vAdminLogin.style.display = "flex";
    }

    detenerPollingGps();

    iniciarFondoStardust();
  } else if (vista === "admin") {
    if (vAdmin) {
      vAdmin.classList.remove("hidden");

      vAdmin.style.display = "flex";
    }

    detenerPollingGps();
  }
}

function toggleAdminPasswordVis() {
  var pwd = document.getElementById("adminPassword");

  var eye = document.getElementById("adminEyeIcon");

  if (pwd && eye) {
    var isPass = pwd.type === "password";

    pwd.type = isPass ? "text" : "password";

    eye.innerText = isPass ? "visibility" : "visibility_off";
  }
}

// --- MOTOR C�SMICO STARDUST CANVAS 2D (ULTRA LIGERO) ---

var stardustEngine = null;

function iniciarFondoStardust() {
  if (stardustEngine) {
    stardustEngine.resize();

    return;
  }

  var viewport = document.getElementById("stardust-viewport");

  if (!viewport) return;

  if (typeof window.initStardustBackground === "function") {
    try {
      stardustEngine = window.initStardustBackground(viewport, {
        background: "#040711",

        particleColor: "#ffffff",

        particleDensity: 1.2,

        minSize: 0.5,

        maxSize: 1.2,

        speed: 6,

        movement: 2.5,

        angle: 180,
      });
    } catch (e) {
      console.warn("Error inicializando Stardust:", e);
    }
  } else {
    setTimeout(iniciarFondoStardust, 150);
  }
}

// --- AUTENTICACIÓN ADMINISTRADOR (100% DINÁMICA POR SERVIDOR - CERO CLAVES EN PLANO) ---

async function handleAdminLoginSubmit(e) {
  if (e) e.preventDefault();
  var acc = (document.getElementById("adminEmail").value || "").trim();
  var pwd = (document.getElementById("adminPassword").value || "").trim();
  var btn = document.getElementById("btnAdminLogin");
  var errBox = document.getElementById("admin-login-error");

  if (errBox) errBox.classList.add("hidden");

  if (!acc || !pwd) {
    if (errBox) {
      errBox.innerText = "Ingresa tu usuario y contraseña.";
      errBox.classList.remove("hidden");
    }
    showToast("Ingresa tu usuario y contraseña.");
    return;
  }

  var origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "<span>Verificando credenciales...</span>";

  function reportarErrorLogin(mensaje) {
    var textoError =
      mensaje || "Cuenta o contraseña incorrecta en Active Directory.";
    if (errBox) {
      errBox.innerText = textoError;
      errBox.classList.remove("hidden");
    }
    showToast(textoError);
    btn.disabled = false;
    btn.innerHTML = origHtml;
    var pInput = document.getElementById("adminPassword");
    if (pInput) {
      pInput.value = "";
      pInput.focus();
    }
  }

  try {
    var resp = await KeiselAPI.loginAdmin(acc, pwd);
    if (resp.ok) {
      var data = await resp.json();
      if (
        data.status === "success" &&
        data.usuario &&
        data.usuario.rol === "ADMIN"
      ) {
        esAdminAutenticado = true;
        showToast("Acceso Concedido por Active Directory");
        btn.disabled = false;
        btn.innerHTML = origHtml;
        navegarA("admin");
        return;
      } else {
        reportarErrorLogin(
          "El usuario no cuenta con privilegios de Administrador.",
        );
        return;
      }
    } else if (resp.status === 401) {
      reportarErrorLogin("Credenciales no autorizadas en el dominio keisel.me");
      return;
    } else {
      reportarErrorLogin("Error del servidor: HTTP " + resp.status);
      return;
    }
  } catch (err) {
    console.warn("Fallo de conexión:", err);
    reportarErrorLogin(
      "No se pudo conectar con Active Directory. Verifique que el servidor de dominio (.253) y la API estén encendidos.",
    );
  }
}

function handleAdminLogout() {
  esAdminAutenticado = false;

  showToast("Cerrando sesión de Administrador...");

  setTimeout(function () {
    navegarA("inicio");
  }, 350);
}

function handleLogoutAdmin() {
  handleAdminLogout();
}

function limpiarSenalSupabase(customBusId) {
  var targetBusId = customBusId || "bus_keisel_1";
  KeiselAPI.corteEmergencia(targetBusId);
}

// [El módulo de Mapa Leaflet ha sido extraído a js/map.js]

// showToast centralizado en config.js

// Métodos del Panel Administrador

// [El módulo del Panel Administrador ha sido extraído a js/admin.js]

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

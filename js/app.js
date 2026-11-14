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

function showToast(msg) {
  var toast = document.getElementById("toast-notify");

  var toastMsg = document.getElementById("toast-msg");

  if (!toast || !toastMsg) return;

  toastMsg.textContent = msg;

  toast.classList.remove("opacity-0", "translate-y-2");

  toast.classList.add("opacity-100", "translate-y-0");

  if (window.toastTimeout) clearTimeout(window.toastTimeout);

  window.toastTimeout = setTimeout(function () {
    toast.classList.add("opacity-0", "translate-y-2");

    toast.classList.remove("opacity-100", "translate-y-0");
  }, 2600);
}

// Métodos del Panel Administrador

// --- MÉTODOS DEL PANEL ADMINISTRADOR ---

let newBusCounter = 4;

let newDriverCounter = 4;

let targetDeleteCardId = null;

function showToast(msg) {
  const toast = document.getElementById("toast-notify");

  const toastMsg = document.getElementById("toast-msg");

  if (!toast || !toastMsg) return;

  toastMsg.textContent = msg;

  toast.classList.remove("opacity-0", "translate-y-2");

  toast.classList.add("opacity-100", "translate-y-0");

  if (window.toastTimeout) clearTimeout(window.toastTimeout);

  window.toastTimeout = setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2");

    toast.classList.remove("opacity-100", "translate-y-0");
  }, 2400);
}

function toggleBusModal(show) {
  const modal = document.getElementById("modal-bus");

  if (!modal) return;

  if (show) {
    modal.classList.remove("hidden");

    const nameInput = document.getElementById("bus-input-name");

    if (nameInput) setTimeout(() => nameInput.focus(), 50);
  } else {
    modal.classList.add("hidden");
  }
}

function toggleDriverModal(show) {
  const modal = document.getElementById("modal-driver");

  if (!modal) return;

  if (show) {
    modal.classList.remove("hidden");

    const nameInput = document.getElementById("driver-input-name");

    if (nameInput) setTimeout(() => nameInput.focus(), 50);
  } else {
    modal.classList.add("hidden");
  }
}

function toggleEditDriverModal(show) {
  const modal = document.getElementById("modal-edit-driver");

  if (!modal) return;

  if (show) modal.classList.remove("hidden");
  else modal.classList.add("hidden");
}

function toggleEditBusModal(show) {
  const modal = document.getElementById("modal-edit-bus");

  if (!modal) return;

  if (show) modal.classList.remove("hidden");
  else modal.classList.add("hidden");
}

function handleBackdropClick(event, modalId) {
  if (event.target.id === modalId) {
    document.getElementById(modalId).classList.add("hidden");
  }
}

function openEditDriverModal(name, dni, route, bus, cardId) {
  document.getElementById("edit-driver-target-id").value = cardId;

  document.getElementById("edit-driver-input-name").value = name;

  document.getElementById("edit-driver-input-dni").value = dni;

  document.getElementById("edit-driver-input-route").value = route;

  document.getElementById("edit-driver-input-bus").value = bus || "";

  toggleEditDriverModal(true);
}

function handleSaveEditDriver(e) {
  e.preventDefault();

  const cardId = document.getElementById("edit-driver-target-id").value;

  const name = document.getElementById("edit-driver-input-name").value;

  const dni = document.getElementById("edit-driver-input-dni").value;

  const route = document.getElementById("edit-driver-input-route").value;

  const card = document.getElementById(cardId);

  if (card) {
    const nameEl = card.querySelector("p.text-\\[15px\\]");

    const dniEl = card.querySelector("p.text-xs");

    if (nameEl) nameEl.textContent = name;

    if (dniEl) dniEl.textContent = "DNI " + dni;
  }

  toggleEditDriverModal(false);

  showToast("Conductor actualizado");
}

function openEditBusModal(name, route, c1, c2, cardId) {
  document.getElementById("edit-bus-target-id").value = cardId;

  document.getElementById("edit-bus-input-name").value = name;

  document.getElementById("edit-bus-input-route").value = route;

  document.getElementById("edit-bus-input-c1").value = c1 || "";

  toggleEditBusModal(true);
}

function handleSaveEditBus(e) {
  e.preventDefault();

  const cardId = document.getElementById("edit-bus-target-id").value;

  const name = document.getElementById("edit-bus-input-name").value;

  const route = document.getElementById("edit-bus-input-route").value;

  const card = document.getElementById(cardId);

  if (card) {
    const nameSpan = card.querySelector("span.text-\\[15px\\]");

    if (nameSpan) nameSpan.textContent = name;
  }

  toggleEditBusModal(false);

  showToast("Bus actualizado");
}

function handleCreateBus(e) {
  e.preventDefault();

  const name =
    document.getElementById("bus-input-name").value.trim() ||
    "Bus 0" + newBusCounter;

  const route = document.getElementById("bus-input-route").value;

  const c1 = document.getElementById("bus-input-c1").value;

  const busId = "bus-card-" + newBusCounter;

  const stateId = "bus-state-" + newBusCounter;

  const busKey = "bus_keisel_" + newBusCounter;

  const busHtml = `

        <div class="py-4 space-y-3" id="${busId}">

          <div class="flex items-center justify-between">

            <div class="flex items-center gap-2">

              <span class="text-[15px] font-medium text-white whitespace-nowrap">${name}</span>

              <span class="text-neutral-600">•</span>

              <span class="text-[15px] text-neutral-300">${route}</span>

            </div>

            <span class="text-[11px] tracking-wide uppercase px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 font-medium" id="${stateId}">En ruta</span>

          </div>

          <div class="space-y-1.5 pt-0.5">

            <div class="flex items-center justify-between text-xs">

              <span class="${c1 ? "text-neutral-400" : "text-neutral-500"}">

                <span class="${c1 ? "text-neutral-500" : "text-neutral-600"}">C1:</span> ${c1 || "Sin asignar"}

              </span>

              <span class="text-[11px] text-neutral-400 font-medium">${c1 ? "En turno" : "Disponible"}</span>

            </div>

          </div>

          <div class="flex items-center justify-between pt-1 border-t border-neutral-900/60">

            <span class="text-[11px] text-neutral-500">ID: ${busKey}</span>

            <div class="flex items-center gap-2">

              <button class="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded border border-neutral-800 hover:border-neutral-600 transition-colors cursor-pointer" onclick="openEditBusModal('${name}', '${route}', '${c1}', '', '${busId}')">Editar</button>

              <button class="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded border border-neutral-800 hover:border-neutral-600 transition-colors cursor-pointer" onclick="triggerEmergencyCut('${name}', '${busId}', '${stateId}', '${busKey}')">Corte</button>

              <button class="text-xs text-neutral-500 hover:text-white px-2 py-1 rounded border border-neutral-800 hover:border-neutral-600 transition-colors cursor-pointer" onclick="confirmDeleteBus('${name}', '${busId}')">Eliminar</button>

            </div>

          </div>

        </div>

      `;

  const busesList = document.getElementById("buses-list");

  if (busesList) busesList.insertAdjacentHTML("beforeend", busHtml);

  newBusCounter++;

  toggleBusModal(false);

  e.target.reset();

  showToast(name + " registrado con éxito");
}

function handleCreateDriver(e) {
  e.preventDefault();

  const name = document.getElementById("driver-input-name").value.trim();

  const dni = document.getElementById("driver-input-dni").value.trim();

  const route = document.getElementById("driver-input-route").value;

  const driverId = newDriverCounter;

  const driverHtml = `

        <div class="py-4 space-y-3" id="driver-card-${driverId}">

          <div class="flex items-start justify-between">

            <div>

              <p class="text-[15px] font-medium text-white">${name}</p>

              <p class="text-xs text-neutral-500 mt-0.5">DNI ${dni}</p>

            </div>

            <span class="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 font-medium" id="driver-status-${driverId}">

              Activo

            </span>

          </div>

          <div class="flex items-center justify-between pt-1">

            <div class="flex items-center gap-2">

              <span class="text-xs text-neutral-500">Ruta:</span>

              <div class="relative">

                <select class="bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs rounded px-2 py-1 pr-6 focus:outline-none focus:border-neutral-600 appearance-none cursor-pointer" onchange="updateDriverRoute(${driverId}, this.value)">

                  <option value="Barranca" ${route === "Barranca" ? "selected" : ""}>Barranca</option>

                  <option value="Supe" ${route === "Supe" ? "selected" : ""}>Supe</option>

                  <option value="Paramonga" ${route === "Paramonga" ? "selected" : ""}>Paramonga</option>

                </select>

                <span class="material-symbols-outlined pointer-events-none absolute right-1 top-1.5 text-[14px] text-neutral-500">expand_more</span>

              </div>

            </div>

            <div class="flex items-center gap-2.5">

              <button class="text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer" onclick="openEditDriverModal('${name}', '${dni}', '${route}', '', 'driver-card-${driverId}')">Editar</button>

              <button class="text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer" id="driver-btn-${driverId}" onclick="toggleDriverAccess(${driverId})">Desactivar</button>

              <button class="text-xs text-neutral-500 hover:text-white transition-colors cursor-pointer" onclick="confirmDeleteDriver('${name}', 'driver-card-${driverId}')">Eliminar</button>

            </div>

          </div>

        </div>

      `;

  const driversList = document.getElementById("drivers-list");

  if (driversList) driversList.insertAdjacentHTML("beforeend", driverHtml);

  newDriverCounter++;

  toggleDriverModal(false);

  e.target.reset();

  showToast("Conductor añadido");
}

function triggerEmergencyCut(busName, cardId, stateId, busKey) {
  const modal = document.getElementById("modal-emergency");

  const title = document.getElementById("emergency-title");

  const confirmBtn = document.getElementById("emergency-confirm-btn");

  title.textContent = "Corte: " + busName;

  modal.classList.remove("hidden");

  confirmBtn.onclick = function () {
    const card = document.getElementById(cardId);

    const state = document.getElementById(stateId);

    if (card) card.classList.add("opacity-50");

    if (state) state.textContent = "Apagado";

    // Limpiar la señal real en Supabase para que el bus desaparezca del mapa

    limpiarSenalSupabase(busKey);

    closeEmergencyModal();

    showToast("Corte de señal aplicado a " + busName);
  };
}

function closeEmergencyModal() {
  document.getElementById("modal-emergency").classList.add("hidden");
}

function confirmDeleteDriver(name, cardId) {
  targetDeleteCardId = cardId;

  document.getElementById("delete-dialog-title").textContent =
    "¿Eliminar a " + name + "?";

  document.getElementById("delete-confirm-btn").onclick = function () {
    const card = document.getElementById(targetDeleteCardId);

    if (card) card.remove();

    closeDeleteModal();

    showToast(name + " eliminado");
  };

  document.getElementById("modal-confirm-delete").classList.remove("hidden");
}

function confirmDeleteBus(name, cardId) {
  targetDeleteCardId = cardId;

  document.getElementById("delete-dialog-title").textContent =
    "¿Eliminar " + name + "?";

  document.getElementById("delete-confirm-btn").onclick = function () {
    const card = document.getElementById(targetDeleteCardId);

    if (card) card.remove();

    closeDeleteModal();

    showToast(name + " eliminado");
  };

  document.getElementById("modal-confirm-delete").classList.remove("hidden");
}

function closeDeleteModal() {
  document.getElementById("modal-confirm-delete").classList.add("hidden");

  targetDeleteCardId = null;
}

function updateDriverRoute(id, route) {
  showToast("Ruta actualizada a " + route);
}

function toggleDriverAccess(id) {
  const statusBadge = document.getElementById("driver-status-" + id);

  const btn = document.getElementById("driver-btn-" + id);

  const card = document.getElementById("driver-card-" + id);

  if (!statusBadge || !btn || !card) return;

  if (statusBadge.textContent.trim().toUpperCase() === "ACTIVO") {
    statusBadge.textContent = "Inactivo";

    btn.textContent = "Activar";

    card.classList.add("opacity-60");

    showToast("Acceso desactivado");
  } else {
    statusBadge.textContent = "Activo";

    btn.textContent = "Desactivar";

    card.classList.remove("opacity-60");

    showToast("Acceso activado");
  }
}

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    toggleBusModal(false);

    toggleDriverModal(false);

    toggleEditDriverModal(false);

    toggleEditBusModal(false);

    closeEmergencyModal();

    closeDeleteModal();
  }
});

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

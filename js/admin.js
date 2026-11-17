let newBusCounter = 4;

let newDriverCounter = 4;

let targetDeleteCardId = null;

// showToast centralizado en js/config.js

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

  function escaparHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const busHtml = `
        <div class="py-4 space-y-3" id="${busId}">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-[15px] font-medium text-white whitespace-nowrap">${escaparHtml(name)}</span>
              <span class="text-neutral-600">•</span>
              <span class="text-[15px] text-neutral-300">${escaparHtml(route)}</span>
            </div>
            <span class="text-[11px] tracking-wide uppercase px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 font-medium" id="${stateId}">En ruta</span>
          </div>
          <div class="space-y-1.5 pt-0.5">
            <div class="flex items-center justify-between text-xs">
              <span class="${c1 ? "text-neutral-400" : "text-neutral-500"}">
                <span class="${c1 ? "text-neutral-500" : "text-neutral-600"}">C1:</span> ${escaparHtml(c1) || "Sin asignar"}
              </span>
              <span class="text-[11px] text-neutral-400 font-medium">${c1 ? "En turno" : "Disponible"}</span>
            </div>
          </div>
          <div class="flex items-center justify-between pt-1 border-t border-neutral-900/60">
            <span class="text-[11px] text-neutral-500">ID: ${busKey}</span>
            <div class="flex items-center gap-2">
              <button data-action="edit-bus" class="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded border border-neutral-800 hover:border-neutral-600 transition-colors cursor-pointer">Editar</button>
              <button data-action="cut-bus" class="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded border border-neutral-800 hover:border-neutral-600 transition-colors cursor-pointer">Corte</button>
              <button data-action="del-bus" class="text-xs text-neutral-500 hover:text-white px-2 py-1 rounded border border-neutral-800 hover:border-neutral-600 transition-colors cursor-pointer">Eliminar</button>
            </div>
          </div>
        </div>
      `;

  const busesList = document.getElementById("buses-list");

  if (busesList) {
    busesList.insertAdjacentHTML("beforeend", busHtml);
    const card = document.getElementById(busId);
    if (card) {
      card.querySelector('[data-action="edit-bus"]')?.addEventListener("click", () => openEditBusModal(name, route, c1, "", busId));
      card.querySelector('[data-action="cut-bus"]')?.addEventListener("click", () => triggerEmergencyCut(name, busId, stateId, busKey));
      card.querySelector('[data-action="del-bus"]')?.addEventListener("click", () => confirmDeleteBus(name, busId));
    }
  }

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

  function escaparHtmlDriver(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const driverHtml = `
        <div class="py-4 space-y-3" id="driver-card-${driverId}">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-[15px] font-medium text-white">${escaparHtmlDriver(name)}</p>
              <p class="text-xs text-neutral-500 mt-0.5">DNI ${escaparHtmlDriver(dni)}</p>
            </div>
            <span class="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 font-medium" id="driver-status-${driverId}">
              Activo
            </span>
          </div>
          <div class="flex items-center justify-between pt-1">
            <div class="flex items-center gap-2">
              <span class="text-xs text-neutral-500">Ruta:</span>
              <div class="relative">
                <select data-action="route-driver" class="bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs rounded px-2 py-1 pr-6 focus:outline-none focus:border-neutral-600 appearance-none cursor-pointer">
                  <option value="Barranca" ${route === "Barranca" ? "selected" : ""}>Barranca</option>
                  <option value="Supe" ${route === "Supe" ? "selected" : ""}>Supe</option>
                  <option value="Paramonga" ${route === "Paramonga" ? "selected" : ""}>Paramonga</option>
                </select>
                <span class="material-symbols-outlined pointer-events-none absolute right-1 top-1.5 text-[14px] text-neutral-500">expand_more</span>
              </div>
            </div>
            <div class="flex items-center gap-2.5">
              <button data-action="edit-driver" class="text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer">Editar</button>
              <button data-action="toggle-driver" class="text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer" id="driver-btn-${driverId}">Desactivar</button>
              <button data-action="del-driver" class="text-xs text-neutral-500 hover:text-white transition-colors cursor-pointer">Eliminar</button>
            </div>
          </div>
        </div>
      `;

  const driversList = document.getElementById("drivers-list");

  if (driversList) {
    driversList.insertAdjacentHTML("beforeend", driverHtml);
    const card = document.getElementById("driver-card-" + driverId);
    if (card) {
      card.querySelector('[data-action="route-driver"]')?.addEventListener("change", (ev) => updateDriverRoute(driverId, ev.target.value));
      card.querySelector('[data-action="edit-driver"]')?.addEventListener("click", () => openEditDriverModal(name, dni, route, "", "driver-card-" + driverId));
      card.querySelector('[data-action="toggle-driver"]')?.addEventListener("click", () => toggleDriverAccess(driverId));
      card.querySelector('[data-action="del-driver"]')?.addEventListener("click", () => confirmDeleteDriver(name, "driver-card-" + driverId));
    }
  }

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

  confirmBtn.onclick = async function () {
    const ok = await KeiselAPI.corteEmergencia(busKey);
    closeEmergencyModal();

    if (!ok) {
      showToast("Error: sesion expirada o sin permisos para aplicar corte");
      return;
    }

    const card = document.getElementById(cardId);
    const state = document.getElementById(stateId);
    if (card) card.classList.add("opacity-60");
    if (state) state.textContent = "DESCONECTADO";
    showToast("Corte de señal aplicado a " + busName);
    actualizarEstadoBusesEnVivo();
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

// --- SINCRONIZACIÓN REAL CON AD / SQL SERVER Y MONITOREO EN VIVO DE BUSES ---

var adminBusesTimer = null;
var conductoresAdminCache = [];

var MAPA_RUTAS_ADMIN = {
  Barranca: { ruta: "Bus 01 • Barranca -> UNAB", busId: "bus_keisel_1", placa: "EUA-482" },
  Supe: { ruta: "Bus 02 • Supe -> UNAB", busId: "bus_keisel_2", placa: "EUA-519" },
  Paramonga: { ruta: "Bus 03 • Paramonga -> UNAB", busId: "bus_keisel_3", placa: "EUA-604" },
};

function detectarNombreRutaCorto(rutaTexto) {
  var r = String(rutaTexto || "").toLowerCase();
  if (r.includes("supe")) return "Supe";
  if (r.includes("paramonga")) return "Paramonga";
  return "Barranca";
}

function escaparHtml(txt) {
  return String(txt || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function cargarConductoresAdmin() {
  var list = document.getElementById("drivers-list");
  if (!list || typeof KeiselAPI === "undefined") return;

  try {
    var resp = await KeiselAPI.obtenerConductoresAdmin();
    if (!resp || !Array.isArray(resp.conductores)) return;
    conductoresAdminCache = resp.conductores;
    renderizarListaConductores(conductoresAdminCache);
  } catch (err) {
    console.warn("No se pudo cargar conductores reales:", err);
  }
}

function renderizarListaConductores(lista) {
  var list = document.getElementById("drivers-list");
  if (!list) return;
  if (!lista || lista.length === 0) {
    list.innerHTML = '<p class="py-4 text-xs text-neutral-500">Sin conductores sincronizados en Active Directory.</p>';
    return;
  }

  list.innerHTML = lista
    .map(function (c, idx) {
      var idNum = c.usuario_id || idx + 1;
      var rutaCorta = detectarNombreRutaCorto(c.ruta_asignada);
      var activo = c.activo === true || c.activo === 1;
      return (
        '<div class="py-4 space-y-3 ' + (activo ? "" : "opacity-60") + '" id="driver-card-' + idNum + '">' +
          '<div class="flex items-start justify-between">' +
            '<div>' +
              '<p class="text-[15px] font-medium text-white">' + escaparHtml(c.nombre_completo) + "</p>" +
              '<p class="text-xs text-neutral-500 mt-0.5">' + escaparHtml(c.usuario_correo) + " • " + escaparHtml(c.placa_unidad || "Sin placa") + "</p>" +
            "</div>" +
            '<span class="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded ' +
              (activo ? "bg-neutral-900 text-emerald-400 border border-emerald-900/50" : "bg-neutral-900 text-neutral-500") +
              ' font-medium">' + (activo ? "Activo" : "Inactivo") + "</span>" +
          "</div>" +
          '<div class="flex items-center justify-between pt-1">' +
            '<div class="flex items-center gap-2">' +
              '<span class="text-xs text-neutral-500">Ruta:</span>' +
              '<select class="bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-neutral-600 cursor-pointer" ' +
                'onchange="guardarCambioRutaConductor(\'' + escaparHtml(c.usuario_correo) + '\', this.value)">' +
                '<option value="Barranca"' + (rutaCorta === "Barranca" ? " selected" : "") + ">Barranca</option>" +
                '<option value="Supe"' + (rutaCorta === "Supe" ? " selected" : "") + ">Supe</option>" +
                '<option value="Paramonga"' + (rutaCorta === "Paramonga" ? " selected" : "") + ">Paramonga</option>" +
              "</select>" +
            "</div>" +
            '<button type="button" class="text-xs text-neutral-300 hover:text-white px-2.5 py-1 rounded border border-neutral-800 hover:border-neutral-600 transition-colors cursor-pointer" ' +
              'onclick="alternarEstadoConductor(\'' + escaparHtml(c.usuario_correo) + '\')">' +
              (activo ? "Desactivar" : "Activar") +
            "</button>" +
          "</div>" +
        "</div>"
      );
    })
    .join("");
}

async function guardarCambioRutaConductor(correo, rutaCorta) {
  var c = conductoresAdminCache.find(function (x) { return x.usuario_correo === correo; });
  var cfg = MAPA_RUTAS_ADMIN[rutaCorta] || MAPA_RUTAS_ADMIN.Barranca;
  if (!c) return;

  var ok = await KeiselAPI.guardarConductorAdmin({
    usuario_correo: c.usuario_correo,
    nombre_completo: c.nombre_completo,
    ruta_asignada: cfg.ruta,
    placa_unidad: cfg.placa,
    bus_rastreo_id: cfg.busId,
    activo: c.activo ? 1 : 0,
  });
  if (ok) {
    showToast("Ruta actualizada a " + rutaCorta);
    cargarConductoresAdmin();
  } else {
    showToast("Error guardando ruta en SQL Server");
  }
}

async function alternarEstadoConductor(correo) {
  var c = conductoresAdminCache.find(function (x) { return x.usuario_correo === correo; });
  if (!c) return;
  var nuevoEstado = c.activo ? 0 : 1;

  var ok = await KeiselAPI.guardarConductorAdmin({
    usuario_correo: c.usuario_correo,
    nombre_completo: c.nombre_completo,
    ruta_asignada: c.ruta_asignada,
    placa_unidad: c.placa_unidad,
    bus_rastreo_id: c.bus_rastreo_id || "bus_keisel_1",
    activo: nuevoEstado,
  });
  if (ok) {
    showToast(nuevoEstado ? "Conductor activado" : "Conductor desactivado");
    cargarConductoresAdmin();
  } else {
    showToast("Error actualizando estado en SQL Server");
  }
}

async function actualizarEstadoBusesEnVivo() {
  if (typeof KeiselAPI === "undefined") return;
  var datos = await KeiselAPI.obtenerGps();
  if (!Array.isArray(datos)) return;

  var mapa = {
    bus_keisel_1: 1,
    bus_keisel_2: 2,
    bus_keisel_3: 3,
  };

  datos.forEach(function (b) {
    var num = mapa[b.id];
    if (!num) return;
    var badge = document.getElementById("bus-state-" + num);
    var card = document.getElementById("bus-card-" + num);
    var enRuta = Boolean(b.en_ruta) && b.latitud !== null && b.longitud !== null;

    if (badge) {
      badge.textContent = enRuta ? "EN RUTA" : "DESCONECTADO";
      badge.className = enRuta
        ? "text-[11px] tracking-wide uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-medium"
        : "text-[11px] tracking-wide uppercase px-2 py-0.5 rounded bg-neutral-900 text-neutral-500 font-medium";
    }
    if (card) {
      if (enRuta) card.classList.remove("opacity-60");
      else card.classList.add("opacity-60");
    }
  });
}

function iniciarMonitoreoBusesAdmin() {
  detenerMonitoreoBusesAdmin();
  actualizarEstadoBusesEnVivo();
  adminBusesTimer = setInterval(actualizarEstadoBusesEnVivo, 3000);
}

function detenerMonitoreoBusesAdmin() {
  if (adminBusesTimer) {
    clearInterval(adminBusesTimer);
    adminBusesTimer = null;
  }
}

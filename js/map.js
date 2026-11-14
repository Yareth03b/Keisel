/**
 * Keisel - Motor de Mapa Leaflet y Telemetría en Tiempo Real
 */

// --- MAPA LEAFLET EN TIEMPO REAL (OPENSTREETMAP OSCURO - CERO WATERMARK) ---

var map = null;

var busMarker = null;

var userMarker = null;

var busPosActual = null;

var userPosActual = null;

var gpsInterval = null;

var watchUserLocationId = null;

function initLeafletMap() {
  if (map) {
    map.invalidateSize();

    return;
  }

  var mapEl = document.getElementById("map");

  if (!mapEl || typeof L === "undefined") return;

  var barrancaCentro = [-10.7516, -77.761];

  map = L.map("map", {
    center: barrancaCentro,

    zoom: 15,

    zoomControl: false,

    attributionControl: true,
  });

  // Capa oficial de OpenStreetMap

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,

    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  iniciarUbicacionUsuario();
}

function achicarPanelBuses() {
  var panel = document.getElementById("panel-tarjeta-bus");

  var btnCirculo = document.getElementById("btn-desplegar-buses");

  if (panel) panel.style.display = "none";

  if (btnCirculo) btnCirculo.style.display = "flex";
}

function expandirPanelBuses() {
  var panel = document.getElementById("panel-tarjeta-bus");

  var btnCirculo = document.getElementById("btn-desplegar-buses");

  if (btnCirculo) btnCirculo.style.display = "none";

  if (panel) panel.style.display = "flex";
}

function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  var R = 6371000;

  var dLat = ((lat2 - lat1) * Math.PI) / 180;

  var dLon = ((lon2 - lon1) * Math.PI) / 180;

  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function aplicarDispersionVisual(buses) {
  if (!buses || buses.length <= 1) return buses;

  var lista = buses.map(function (b) {
    var lat = Number(b.latitud);

    var lng = Number(b.longitud);

    return {
      id: b.id,

      nombre: b.nombre,

      ruta: b.ruta,

      placa: b.placa,

      latitud: lat,

      longitud: lng,

      latReal: lat,

      lngReal: lng,

      actualizado_en: b.actualizado_en,
    };
  });

  // Detecta colisiones directas (< 35 metros) para que los marcadores no se tapen

  for (var i = 0; i < lista.length; i++) {
    var colisiones = [i];

    for (var j = i + 1; j < lista.length; j++) {
      var d = calcularDistanciaMetros(
        lista[i].latReal,
        lista[i].lngReal,
        lista[j].latReal,
        lista[j].lngReal,
      );

      if (d < 35.0) {
        colisiones.push(j);
      }
    }

    if (colisiones.length > 1) {
      // Separación angular limpia de ~22 metros para visualización simultánea de todos los buses

      var radioGrados = 0.0002;

      for (var k = 0; k < colisiones.length; k++) {
        var idx = colisiones[k];

        var angulo = ((2 * Math.PI) / colisiones.length) * k;

        lista[idx].latitud = Number(
          (lista[idx].latReal + Math.sin(angulo) * radioGrados).toFixed(7),
        );

        lista[idx].longitud = Number(
          (lista[idx].lngReal + Math.cos(angulo) * radioGrados).toFixed(7),
        );
      }
    }
  }

  return lista;
}

var busMarkers = {};

var BUS_CATALOGO = {
  bus_keisel_1: { nombre: "Bus 01", ruta: "Barranca - UNAB", placa: "EUA-482" },

  bus_keisel_2: { nombre: "Bus 02", ruta: "Supe - UNAB", placa: "B4T-912" },

  bus_keisel_3: {
    nombre: "Bus 03",
    ruta: "Paramonga - UNAB",
    placa: "C1V-554",
  },
};

function centrarEnBus(especificoId) {
  if (!map) return;

  var ids = Object.keys(busMarkers);

  if (ids.length === 0) {
    if (typeof showToast === "function")
      showToast("No hay ningún bus transmitiendo en este momento.");

    return;
  }

  if (especificoId && busMarkers[especificoId]) {
    var target = busMarkers[especificoId];

    map.flyTo([target.lat, target.lng], 17, { animate: true, duration: 0.8 });

    target.marker.openPopup();

    return;
  }

  if (ids.length === 1) {
    var b = busMarkers[ids[0]];

    map.flyTo([b.lat, b.lng], 16, { animate: true, duration: 0.8 });

    b.marker.openPopup();
  } else {
    var group = [];

    ids.forEach(function (id) {
      group.push([busMarkers[id].lat, busMarkers[id].lng]);
    });

    if (typeof userPosActual !== "undefined" && userPosActual) {
      group.push(userPosActual);
    }

    var bounds = L.latLngBounds(group);

    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
  }
}

// --- VARIABLES DE GEOLOCALIZACIÓN Y ESTABILIZACIÓN ---

var userPosFijada = null;

var userWatchId = null;

var mejorAccuracyUsuario = 999;

var yaCentroUsuario = false;

var confirmacionesMovUser = 0;

var UMBRAL_MOVIMIENTO_METROS = 8.0;

var origenVistaMapa = null;

function verMapaDesdeAdmin() {
  origenVistaMapa = "admin";

  navegarA("mapa");
}

function retrocederDesdeMapa() {
  if (origenVistaMapa === "admin" || esAdminAutenticado) {
    origenVistaMapa = null;

    navegarA("admin");
  } else {
    navegarA("inicio");
  }
}

// --- UBICACIÓN DEL ESTUDIANTE: PUNTO BLANCO LIMPIO Y EXACTO ---

function dibujarPuntoBlancoUsuario(lat, lng) {
  if (!map || typeof L === "undefined") return;

  if (!userMarker) {
    var userIcon = L.divIcon({
      className: "user-marker-container",

      html: '<div style="position:relative;"><div class="user-pulse-halo"></div><div class="user-white-dot"></div></div>',

      iconSize: [18, 18],

      iconAnchor: [9, 9],
    });

    userMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 })

      .addTo(map)

      .bindPopup("<b>Tu ubicación actual</b>");
  } else {
    userMarker.setLatLng([lat, lng]);
  }
}

function procesarLecturaGpsUsuario(pos) {
  if (!pos || !pos.coords) return;

  var lat = pos.coords.latitude;

  var lng = pos.coords.longitude;

  var accuracy = pos.coords.accuracy || 20;

  var speed = pos.coords.speed;

  // Si el bus está muy cerca del estudiante, vincular sutilmente para evitar jitter

  if (busPosActual && accuracy > 15) {
    var distAlBus = calcularDistanciaMetros(
      lat,
      lng,
      busPosActual[0],
      busPosActual[1],
    );

    if (distAlBus < 150) {
      lat = busPosActual[0] + 0.000012;

      lng = busPosActual[1] + 0.000015;
    }
  }

  // Primera lectura GPS: fijar punto blanco de inmediato

  if (!userPosFijada) {
    userPosFijada = [lat, lng];

    userPosActual = [lat, lng];

    mejorAccuracyUsuario = accuracy;

    dibujarPuntoBlancoUsuario(lat, lng);

    if (!yaCentroUsuario && map && !busPosActual) {
      yaCentroUsuario = true;

      map.flyTo(userPosActual, 17, { animate: true, duration: 1 });
    }

    return;
  }

  // Descartar lecturas ruidosas mayores a 50m si ya tenemos posición

  if (accuracy > 50) {
    return;
  }

  var distancia = calcularDistanciaMetros(
    userPosFijada[0],
    userPosFijada[1],
    lat,
    lng,
  );

  // Si está quieto o la distancia es menor al umbral de 8m, no mover el punto

  if (
    (speed !== null &&
      speed !== undefined &&
      speed < 0.5 &&
      distancia < 15.0) ||
    distancia < UMBRAL_MOVIMIENTO_METROS
  ) {
    confirmacionesMovUser = 0;

    return;
  }

  // 3 confirmaciones para evitar saltos bruscos

  confirmacionesMovUser++;

  if (confirmacionesMovUser < 3) {
    return;
  }

  confirmacionesMovUser = 0;

  // Suavizado exponencial para desplazamiento fluido

  var latSuavizada = userPosFijada[0] * 0.3 + lat * 0.7;

  var lngSuavizada = userPosFijada[1] * 0.3 + lng * 0.7;

  userPosFijada = [latSuavizada, lngSuavizada];

  userPosActual = [latSuavizada, lngSuavizada];

  dibujarPuntoBlancoUsuario(latSuavizada, lngSuavizada);
}

function iniciarUbicacionUsuario() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    function (pos) {
      procesarLecturaGpsUsuario(pos);
    },

    function (err) {
      console.warn("Geolocalización inicial:", err.message);
    },

    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
  );

  if (userWatchId === null) {
    userWatchId = navigator.geolocation.watchPosition(
      function (pos) {
        procesarLecturaGpsUsuario(pos);
      },

      function (err) {
        console.warn("Watch geolocalización:", err.message);
      },

      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
  }
}

function centrarEnMiUbicacion() {
  if (userPosActual && map) {
    map.flyTo(userPosActual, 17, { animate: true, duration: 0.8 });

    if (userMarker) userMarker.openPopup();
  }

  iniciarUbicacionUsuario();
}

// --- MODAL Y CONFIGURACIÓN DE PERMISO DE UBICACIÓN ---

function abrirModalUbicacion() {
  var modal = document.getElementById("modal-permiso-ubicacion");
  if (modal) modal.classList.remove("hidden");
}

function cerrarModalUbicacion() {
  var modal = document.getElementById("modal-permiso-ubicacion");
  if (modal) modal.classList.add("hidden");
}

function configurarPermisoUbicacion(tipo) {
  cerrarModalUbicacion();
  iniciarUbicacionUsuario();
  if (typeof showToast === "function") {
    if (tipo === "siempre") {
      showToast("Permiso de ubicación concedido");
    } else {
      showToast("Ubicación activada");
    }
  }
}

window.abrirModalUbicacion = abrirModalUbicacion;
window.cerrarModalUbicacion = cerrarModalUbicacion;
window.configurarPermisoUbicacion = configurarPermisoUbicacion;
window.centrarEnMiUbicacion = centrarEnMiUbicacion;

function actualizarBusesActivos(busesList) {
  if (!map || typeof L === "undefined") return;

  var validos = (busesList || []).filter(function (b) {
    if (!b) return false;
    var rawLat = b.latitud !== undefined ? b.latitud : b.lat;
    var rawLng = b.longitud !== undefined ? b.longitud : b.lng;
    if (rawLat === null || rawLng === null || rawLat === undefined || rawLng === undefined) return false;

    var lat = Number(rawLat);
    var lng = Number(rawLng);

    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return false;

    var fecha = b.actualizado_en || b.fecha_actualizacion || b.timestamp;
    if (fecha) {
      var t = new Date(fecha).getTime();
      if (!isNaN(t)) {
        var diffSeg = (Date.now() - t) / 1000;
        if (diffSeg > 600) return false;
      }
    }

    return true;
  });

  // Aplica dispersión visual inteligente si están muy juntos para que ambos se vean simultáneamente
  var dispersados = aplicarDispersionVisual(validos);
  var idsRecibidos = new Set();

  dispersados.forEach(function (b) {
    var bId = b.id || b.bus_id || b.busId || "bus_keisel_1";
    idsRecibidos.add(bId);

    var lat = Number(b.latitud !== undefined ? b.latitud : b.lat);
    var lng = Number(b.longitud !== undefined ? b.longitud : b.lng);

    var info = BUS_CATALOGO[bId] || {
      nombre: b.nombre || "Bus " + bId.replace("bus_keisel_", ""),

      ruta: b.ruta || "Ruta Universitaria Activa",

      placa: b.placa || "",
    };

    if (!busMarkers[bId]) {
      var busSvg =
        '<svg style="width:16px;height:16px;" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect height="16" rx="4" width="18" x="3" y="3"></rect><path d="M3 11h18"></path><path d="M19 19v2"></path><path d="M5 19v2"></path><circle cx="7.5" cy="15" fill="#FFFFFF" r="1.2" stroke="none"></circle><circle cx="16.5" cy="15" fill="#FFFFFF" r="1.2" stroke="none"></circle></svg>';

      var busHtml =
        '<div style="position:relative; display:flex; flex-direction:column; align-items:center;">' +
        '<div class="bus-pulse-ring"></div>' +
        '<div class="bus-pin-core">' +
        busSvg +
        "</div>" +
        '<span style="background:#141416; color:#FFFFFF; border:1px solid rgba(255,255,255,0.4); font-size:10px; font-weight:800; padding:1px 6px; border-radius:6px; margin-top:3px; white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,0.8); letter-spacing:0.02em;">' +
        info.nombre +
        "</span>" +
        "</div>";

      var busIcon = L.divIcon({
        className: "bus-marker-container",

        html: busHtml,

        iconSize: [40, 52],

        iconAnchor: [20, 20],
      });

      var marker = L.marker([lat, lng], { icon: busIcon, zIndexOffset: 1500 })

        .addTo(map)

        .bindPopup(
          "<b>" +
            info.nombre +
            "</b><br>" +
            info.ruta +
            (info.placa ? "<br>Placa: " + info.placa : ""),
        );

      marker.on("click", function () {
        expandirPanelBuses();

        centrarEnBus(bId);
      });

      busMarkers[bId] = { marker: marker, lat: lat, lng: lng, info: info };
    } else {
      busMarkers[bId].marker.setLatLng([lat, lng]);

      busMarkers[bId].lat = lat;

      busMarkers[bId].lng = lng;

      busMarkers[bId].info = info;
    }
  });

  // Remover del mapa buses que hayan apagado transmisión

  Object.keys(busMarkers).forEach(function (oldId) {
    if (!idsRecibidos.has(oldId)) {
      map.removeLayer(busMarkers[oldId].marker);

      delete busMarkers[oldId];
    }
  });

  var activeCount = Object.keys(busMarkers).length;

  var dot = document.getElementById("live-dot");

  var status = document.getElementById("header-status");

  var btnC = document.getElementById("btn-centrar-bus");

  var badge = document.getElementById("bus-live-badge");

  var nameEl = document.getElementById("bus-main-name");

  var sub = document.getElementById("bus-subtext");

  var chips = document.getElementById("bus-chips-container");

  if (activeCount === 0) {
    busPosActual = null;

    if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-neutral-600";

    if (status) status.innerText = "SIN BUS EN RUTA";

    if (btnC) btnC.style.display = "none";

    if (badge) {
      badge.innerText = "DESCONECTADO";

      badge.className =
        "text-[9px] font-bold text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded-full tracking-wider uppercase";
    }

    if (nameEl) nameEl.innerText = "Bus Universitario";

    if (sub) sub.innerText = "Esperando señal GPS activa...";

    if (chips) chips.innerHTML = "";
  } else if (activeCount === 1) {
    var firstId = Object.keys(busMarkers)[0];

    var firstBus = busMarkers[firstId];

    busPosActual = [firstBus.lat, firstBus.lng];

    if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-white animate-pulse";

    if (status) status.innerText = "1 BUS EN RUTA";

    if (btnC) btnC.style.display = "flex";

    if (badge) {
      badge.innerText = "EN VIVO";

      badge.className =
        "text-[9px] font-bold text-black bg-white px-2 py-0.5 rounded-full tracking-wider uppercase";
    }

    if (nameEl) nameEl.innerText = firstBus.info.nombre;

    if (sub) sub.innerText = firstBus.info.ruta;

    if (chips) chips.innerHTML = "";
  } else {
    var idsActivos = Object.keys(busMarkers);

    var firstBus = busMarkers[idsActivos[0]];

    busPosActual = [firstBus.lat, firstBus.lng];

    if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-white animate-pulse";

    if (status) status.innerText = activeCount + " BUSES EN RUTA";

    if (btnC) btnC.style.display = "flex";

    if (badge) {
      badge.innerText = activeCount + " EN VIVO";

      badge.className =
        "text-[9px] font-bold text-black bg-white px-2 py-0.5 rounded-full tracking-wider uppercase";
    }

    if (nameEl) nameEl.innerText = activeCount + " Buses en Ruta";

    var nombresRutas = idsActivos
      .map(function (id) {
        return (
          busMarkers[id].info.nombre +
          " (" +
          busMarkers[id].info.ruta.split(" - ")[0] +
          ")"
        );
      })
      .join(" · ");

    if (sub) sub.innerText = nombresRutas;

    if (chips) {
      var chipsHtml =
        '<button onclick="centrarEnBus()" class="text-[10px] bg-white/10 hover:bg-white/20 text-white font-bold px-2 py-0.5 rounded-lg transition-all cursor-pointer">Todos</button>';

      idsActivos.forEach(function (id) {
        chipsHtml +=
          "<button onclick=\"centrarEnBus('" +
          id +
          '\')" class="text-[10px] bg-white/10 hover:bg-white/20 text-white font-bold px-2 py-0.5 rounded-lg transition-all cursor-pointer">' +
          busMarkers[id].info.nombre +
          "</button>";
      });

      chips.innerHTML = chipsHtml;
    }
  }
}

function ocultarBus() {
  actualizarBusesActivos([]);
}

// --- TELEMETRÍA NATIVA: API NODE.JS + SQL SERVER (LAN / TAILSCALE) ---

async function cargarPosicionApi() {
  try {
    var buses = await KeiselAPI.obtenerGps();
    if (buses && buses.length > 0) {
      actualizarBusesActivos(buses);
    } else {
      ocultarBus();
    }
  } catch (err) {
    ocultarBus();
  }
}

function iniciarPollingGps() {
  detenerPollingGps();

  cargarPosicionApi();

  gpsInterval = setInterval(cargarPosicionApi, 3000);
}

function detenerPollingGps() {
  if (gpsInterval) {
    clearInterval(gpsInterval);

    gpsInterval = null;
  }
}

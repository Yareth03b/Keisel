var map = null;

function escaparHtml(valor) {
  return String(valor || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

var busMarker = null;

var userMarker = null;

var userAccuracyCircle = null;

var recorridoRutaLayer = null;

var busSeleccionadoId = null;

var inicioTransmisionPorBus = new Map();

var ultimaConsultaRuta = { ts: 0, busId: null, busLat: null, busLng: null, userLat: null, userLng: null };

var ultimaEtaTexto = "";

var animacionesMarcadores = new WeakMap();

var busPosActual = null;

function animarMarcador(marker, desde, hasta, duracionMs) {
  if (!marker || !desde || !hasta) return;
  var dist = calcularDistanciaMetros(desde[0], desde[1], hasta[0], hasta[1]);
  if (dist < 1.5 || dist > 5000) {
    marker.setLatLng(hasta);
    return;
  }
  var prevRaf = animacionesMarcadores.get(marker);
  if (prevRaf) cancelAnimationFrame(prevRaf);

  var inicio = performance.now();
  var dur = duracionMs || 1400;

  function paso(ahora) {
    var prog = Math.min(1, (ahora - inicio) / dur);
    var ease = 1 - Math.pow(1 - prog, 3); // ease-out cubic
    var lat = desde[0] + (hasta[0] - desde[0]) * ease;
    var lng = desde[1] + (hasta[1] - desde[1]) * ease;
    marker.setLatLng([lat, lng]);
    if (prog < 1) {
      var id = requestAnimationFrame(paso);
      animacionesMarcadores.set(marker, id);
    } else {
      animacionesMarcadores.delete(marker);
    }
  }
  animacionesMarcadores.set(marker, requestAnimationFrame(paso));
}

var cacheSnapBus = {};

async function resolverPuntoEnPista(bId, rawLat, rawLng) {
  var prev = cacheSnapBus[bId];
  var ahora = Date.now();

  // Si el bus sigue en el mismo punto (< 3 m) o se consultó hace < 1.2 s, reutilizar SIEMPRE la coordenada ya pegada a la pista
  if (
    prev &&
    prev.snapLat !== undefined &&
    (calcularDistanciaMetros(prev.rawLat, prev.rawLng, rawLat, rawLng) < 3.0 ||
      ahora - prev.ts < 1200)
  ) {
    return [prev.snapLat, prev.snapLng];
  }

  var url =
    "https://router.project-osrm.org/nearest/v1/driving/" +
    rawLng.toFixed(6) + "," + rawLat.toFixed(6) + "?number=1";

  var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 5000) : null;

  try {
    var resp = await fetch(url, ctrl ? { signal: ctrl.signal } : {});
    if (timer) clearTimeout(timer);
    if (resp && resp.ok) {
      var data = await resp.json();
      var wp = data && data.waypoints && data.waypoints[0];
      // Pega estrictamente al eje de la vía más cercana (hasta 85 m de tolerancia ante rebote urbano)
      if (wp && wp.location && wp.distance <= 85) {
        var snapLat = wp.location[1];
        var snapLng = wp.location[0];
        cacheSnapBus[bId] = {
          ts: ahora,
          rawLat: rawLat,
          rawLng: rawLng,
          snapLat: snapLat,
          snapLng: snapLng,
        };
        return [snapLat, snapLng];
      }
    }
  } catch (e) {
    if (timer) clearTimeout(timer);
    // Si OSRM falla momentáneamente pero teníamos un punto en pista muy cercano (< 12 m), mantenerlo en pista
    if (prev && prev.snapLat !== undefined && calcularDistanciaMetros(prev.rawLat, prev.rawLng, rawLat, rawLng) < 12.0) {
      return [prev.snapLat, prev.snapLng];
    }
  }

  return [rawLat, rawLng];
}

async function preajustarBusesAPista(busesList) {
  if (!Array.isArray(busesList) || busesList.length === 0) return [];
  var copia = await Promise.all(
    busesList.map(async function (b) {
      if (!b) return b;
      var rawLat = Number(b.latitud !== undefined ? b.latitud : b.lat);
      var rawLng = Number(b.longitud !== undefined ? b.longitud : b.lng);
      if (isNaN(rawLat) || isNaN(rawLng) || (rawLat === 0 && rawLng === 0)) return b;
      var bId = b.id || b.bus_id || b.busId || "bus_keisel_1";
      var puntoPista = await resolverPuntoEnPista(bId, rawLat, rawLng);
      var clon = Object.assign({}, b);
      clon.latitud = puntoPista[0];
      clon.longitud = puntoPista[1];
      return clon;
    }),
  );
  return copia;
}

function limpiarRutaMapa() {
  ultimaEtaTexto = "";
  ultimaConsultaRuta.busId = null;
}

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

  map = L.map("map", {
    center: KeiselConfig.MAP.DEFAULT_CENTER,

    zoom: KeiselConfig.MAP.DEFAULT_ZOOM,

    zoomControl: false,

    attributionControl: false,
  });
  
  if (map.attributionControl) {
    map.attributionControl.setPrefix(false);
  }

  L.tileLayer(KeiselConfig.MAP.TILE_LAYER, {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  var botonesRuta = document.querySelectorAll("#filtro-rutas .btn-ruta");
  botonesRuta.forEach(function (btn) {
    var activo = btn.getAttribute("data-ruta") === "barranca";
    btn.classList.toggle("btn-ruta--activo", activo);
    btn.setAttribute("aria-selected", activo ? "true" : "false");
  });
  enfocarRutaFiltro(KeiselConfig.RUTAS.barranca);
  iniciarSimulacionBarranca();

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

function calcularRumbo(lat1, lon1, lat2, lon2) {
  var phi1 = (lat1 * Math.PI) / 180;
  var phi2 = (lat2 * Math.PI) / 180;
  var dLam = ((lon2 - lon1) * Math.PI) / 180;
  var y = Math.sin(dLam) * Math.cos(phi2);
  var x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLam);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
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

var rutaFiltroActiva = "barranca";
var ultimosBusesApi = [];
var simulacionBarranca = {
  marker: null,
  raf: null,
  visible: false,
  puntos: [],
  segmentos: [],
  duracionCicloMs: 0,
  desfaseDiarioMs: 0,
  tramo: 0,
  avanceMs: 0,
  pausaMs: 0,
  ultimoFrame: null,
  latLng: null,
};
var SIMULACION_VELOCIDAD_MPS = 4.2;
var SIMULACION_PARADA_MS = 10000;

var ETIQUETAS_RUTA = {
  todos: "Todas las rutas",
  barranca: "Barranca",
  supe: "Supe",
  paramonga: "Paramonga",
};

var BUS_CATALOGO = {
  bus_keisel_1: { nombre: "Bus 01", ruta: "Barranca - UNAB", placa: "EUA-482" },
  bus_keisel_2: { nombre: "Bus 02", ruta: "Supe - UNAB", placa: "EUA-519" },
  bus_keisel_3: { nombre: "Bus 03", ruta: "Paramonga - UNAB", placa: "EUA-604" },
};

function coincideFiltroRuta(b) {
  if (!rutaFiltroActiva || rutaFiltroActiva === "todos") return true;
  var bId = (b && (b.id || b.bus_id || b.busId)) || "bus_keisel_1";
  var cat = BUS_CATALOGO[bId];
  var textoRuta = (
    (b && (b.ruta || b.ruta_asignada)) ||
    (cat && cat.ruta) ||
    ""
  ).toLowerCase();
  return textoRuta.indexOf(rutaFiltroActiva) !== -1;
}

function seleccionarFiltroRuta(ruta) {
  var nuevoFiltro = (ruta || "todos").toLowerCase();
  if (nuevoFiltro !== rutaFiltroActiva) limpiarRutaMapa();
  rutaFiltroActiva = nuevoFiltro;
  centrarUsuarioPendiente = false;

  var botones = document.querySelectorAll("#filtro-rutas .btn-ruta");
  botones.forEach(function (btn) {
    var activo = btn.getAttribute("data-ruta") === rutaFiltroActiva;
    btn.classList.toggle("btn-ruta--activo", activo);
    btn.setAttribute("aria-selected", activo ? "true" : "false");
  });

  actualizarBusesActivos(ultimosBusesApi, true);
  enfocarRutaFiltro(KeiselConfig.RUTAS[rutaFiltroActiva]);
}

function enfocarRutaFiltro(ruta) {
  var mensaje = document.getElementById("mensaje-recorrido");
  mensaje.textContent = "";
  if (!map) return;

  map.stop();
  map.closePopup();
  if (recorridoRutaLayer) {
    map.removeLayer(recorridoRutaLayer);
    recorridoRutaLayer = null;
  }

  if (ruta && ruta.puntos) {
    var puntosRuta = rutaFiltroActiva === "paramonga" && ruta.regreso
      ? ruta.puntos.concat(ruta.regreso)
      : ruta.puntos;
    dibujarRecorridoRuta(puntosRuta);
    return;
  }

  if (!ruta && rutaFiltroActiva === "todos" && simulacionBarranca.visible) {
    dibujarRecorridoRuta(KeiselConfig.RUTAS.barranca.puntos);
    return;
  }

  if (ruta) mensaje.textContent = "Recorrido y paraderos pendientes de confirmar";
  if (Object.keys(busMarkers).length > 0) {
    centrarEnBus();
  } else if (ruta) {
    map.setView(ruta.centro, 14, { animate: false });
  } else {
    map.setView(KeiselConfig.MAP.DEFAULT_CENTER, KeiselConfig.MAP.DEFAULT_ZOOM, { animate: false });
  }
}

function dibujarRecorridoRuta(puntos) {
  var coordenadas = puntos.map(function ([lat, lng]) { return [lat, lng]; });
  var indiceProceres = puntos.findIndex(function (p) {
    return p[2] && p[2].toLowerCase().indexOf("proceres") !== -1;
  });
  var lineaIda;
  var lineaVuelta;
  var lineas = [];

  if (rutaFiltroActiva === "supe" || rutaFiltroActiva === "paramonga") {
    lineas.push(L.polyline(coordenadas, {
      color: "#ef3340",
      weight: 5,
      opacity: 0.95,
      interactive: false,
    }));
  } else if (indiceProceres > 0) {
    lineaIda = L.polyline(coordenadas.slice(0, indiceProceres + 1), {
      color: "#168bff",
      weight: 5,
      opacity: 0.95,
      interactive: false,
    });
    lineaVuelta = L.polyline(coordenadas.slice(indiceProceres), {
      color: "#facc15",
      weight: 5,
      opacity: 0.95,
      interactive: false,
    });
    lineas.push(lineaIda, lineaVuelta);
  } else {
    lineaIda = L.polyline(coordenadas, {
      color: "#168bff",
      weight: 5,
      opacity: 0.95,
      interactive: false,
    });
    lineas.push(lineaIda);
  }

  var icono = L.divIcon({ className: "paradero-icono", iconSize: [14, 14] });
  var capas = lineas.slice();
  puntos.forEach(function ([lat, lng, nombre]) {
    if (!nombre) return;
    var marcador = L.marker([lat, lng], { icon: icono, title: nombre })
      .bindPopup(escaparHtml(nombre));
    capas.push(marcador);
  });
  recorridoRutaLayer = L.layerGroup(capas).addTo(map);
  lineas.forEach(function (linea) { linea.bringToBack(); });

  var header = document.querySelector(".hud-header");
  map.fitBounds(L.latLngBounds(coordenadas), {
    paddingTopLeft: [24, Math.ceil(header.getBoundingClientRect().bottom) + 16],
    paddingBottomRight: [40, 76],
    maxZoom: 16,
    animate: false,
  });
}

function cambiarVisibilidadSimulacionBarranca(mostrar) {
  simulacionBarranca.visible = Boolean(mostrar);

  if (!map || !simulacionBarranca.marker) return;
  var estaEnMapa = map.hasLayer(simulacionBarranca.marker);
  if (simulacionBarranca.visible && !estaEnMapa) {
    simulacionBarranca.marker.addTo(map);
  } else if (!simulacionBarranca.visible && estaEnMapa) {
    map.removeLayer(simulacionBarranca.marker);
  }
}

function avanzarSimulacionBarranca() {
  var ahora = new Date();
  var inicioDiaUtc = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate());
  var fase = ((Date.now() - inicioDiaUtc + simulacionBarranca.desfaseDiarioMs) % simulacionBarranca.duracionCicloMs + simulacionBarranca.duracionCicloMs) % simulacionBarranca.duracionCicloMs;
  var segmentos = simulacionBarranca.segmentos;

  for (var i = 0; i < segmentos.length; i++) {
    var segmento = segmentos[i];
    if (fase < segmento.duracionMs) {
      simulacionBarranca.tramo = i;
      simulacionBarranca.latLng = [
        segmento.desde[0] + (segmento.hasta[0] - segmento.desde[0]) * (fase / segmento.duracionMs),
        segmento.desde[1] + (segmento.hasta[1] - segmento.desde[1]) * (fase / segmento.duracionMs),
      ];
      break;
    }
    fase -= segmento.duracionMs;

    if (fase < segmento.pausaMs) {
      simulacionBarranca.tramo = i;
      simulacionBarranca.latLng = [segmento.hasta[0], segmento.hasta[1]];
      break;
    }
    fase -= segmento.pausaMs;
  }

  if (simulacionBarranca.marker && simulacionBarranca.latLng) {
    simulacionBarranca.marker.setLatLng(simulacionBarranca.latLng);
    var elemento = simulacionBarranca.marker.getElement();
    var flecha = elemento && elemento.querySelector(".bus-heading-wrap");
    if (flecha) {
      var tramoActual = simulacionBarranca.tramo;
      var puntoDesde = simulacionBarranca.puntos[tramoActual];
      var puntoHasta = simulacionBarranca.puntos[tramoActual + 1];
      if (puntoDesde && puntoHasta) {
        var rumbo = calcularRumbo(puntoDesde[0], puntoDesde[1], puntoHasta[0], puntoHasta[1]);
        flecha.style.opacity = "1";
        flecha.style.transform = "rotate(" + Math.round(rumbo) + "deg)";
      }
    }
  }
  simulacionBarranca.raf = window.requestAnimationFrame(avanzarSimulacionBarranca);
}

function iniciarSimulacionBarranca() {
  if (!map || simulacionBarranca.marker) return;

  var rutaCompleta = KeiselConfig.RUTAS.barranca.puntos.map(function (p) {
    return [p[0], p[1], p[2]];
  });
  var indiceGrau = rutaCompleta.findIndex(function (p) {
    return p[2] && p[2].toLowerCase().indexOf("grau") !== -1;
  });
  simulacionBarranca.puntos = indiceGrau > 0
    ? rutaCompleta.slice(indiceGrau).concat(rutaCompleta.slice(1, indiceGrau + 1))
    : rutaCompleta;

  simulacionBarranca.segmentos = [];
  simulacionBarranca.duracionCicloMs = 0;
  for (var i = 0; i < simulacionBarranca.puntos.length - 1; i++) {
    var puntoA = simulacionBarranca.puntos[i];
    var puntoB = simulacionBarranca.puntos[i + 1];
    var distanciaTramo = calcularDistanciaMetros(puntoA[0], puntoA[1], puntoB[0], puntoB[1]);
    var duracionTramo = Math.max(1, (distanciaTramo / SIMULACION_VELOCIDAD_MPS) * 1000);
    var pausaParadero = puntoB[2] ? SIMULACION_PARADA_MS : 0;
    simulacionBarranca.segmentos.push({
      desde: puntoA,
      hasta: puntoB,
      duracionMs: duracionTramo,
      pausaMs: pausaParadero,
    });
    simulacionBarranca.duracionCicloMs += duracionTramo + pausaParadero;
  }

  var fechaSemilla = "keisel-barranca-demo-v1";
  var semilla = 2166136261;
  for (var k = 0; k < fechaSemilla.length; k++) {
    semilla ^= fechaSemilla.charCodeAt(k);
    semilla = Math.imul(semilla, 16777619);
  }
  simulacionBarranca.desfaseDiarioMs = (semilla >>> 0) % simulacionBarranca.duracionCicloMs;

  var busSvg =
    '<svg style="width:16px;height:16px;" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect height="16" rx="4" width="18" x="3" y="3"></rect><path d="M3 11h18"></path><path d="M19 19v2"></path><path d="M5 19v2"></path><circle cx="7.5" cy="15" fill="#FFFFFF" r="1.2" stroke="none"></circle><circle cx="16.5" cy="15" fill="#FFFFFF" r="1.2" stroke="none"></circle></svg>';
  var busHtml =
    '<div style="position:relative; display:flex; flex-direction:column; align-items:center;">' +
    '<div class="bus-pulse-ring"></div>' +
    '<div class="bus-heading-wrap" style="position:absolute;top:-7px;left:50%;width:10px;height:10px;margin-left:-5px;transform-origin:5px 25px;opacity:0;transition:transform 0.6s ease-out,opacity 0.3s ease;pointer-events:none;">' +
    '<svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,0 9,8 5,6 1,8" fill="#38bdf8"/></svg>' +
    "</div>" +
    '<div class="bus-pin-core">' + busSvg + "</div>" +
    '<span style="background:#141416; color:#FFFFFF; border:1px solid rgba(255,255,255,0.4); font-size:10px; font-weight:800; padding:1px 6px; border-radius:6px; margin-top:3px; white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,0.8); letter-spacing:0.02em;">Bus 01</span>' +
    "</div>";
  var icono = L.divIcon({
    className: "bus-marker-container",
    iconSize: [40, 52],
    iconAnchor: [20, 20],
    html: busHtml,
  });

  simulacionBarranca.latLng = [simulacionBarranca.puntos[0][0], simulacionBarranca.puntos[0][1]];
  simulacionBarranca.marker = L.marker(simulacionBarranca.latLng, {
    icon: icono,
    zIndexOffset: 1700,
  }).bindPopup("<b>Bus 01</b><br>Ruta Barranca · UNAB");
  simulacionBarranca.marker.on("click", function () {
    map.flyTo(simulacionBarranca.latLng, 16, { animate: true, duration: 0.8 });
  });

  cambiarVisibilidadSimulacionBarranca(
    rutaFiltroActiva === "barranca" || rutaFiltroActiva === "todos",
  );
  avanzarSimulacionBarranca();
}

window.seleccionarFiltroRuta = seleccionarFiltroRuta;

function centrarEnBus(especificoId) {
  if (!map) return;

  var ids = Object.keys(busMarkers);

  if (ids.length === 0) {
    if (typeof showToast === "function")
      showToast("No hay ningún bus transmitiendo en este momento.");

    return;
  }

  if (especificoId && busMarkers[especificoId]) {
    busSeleccionadoId = especificoId;
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

var centrarUsuarioPendiente = false;

var confirmacionesMovUser = 0;

var UMBRAL_MOVIMIENTO_METROS = 8.0;

// --- UBICACIÓN DEL ESTUDIANTE: PUNTO BLANCO LIMPIO Y EXACTO ---

function dibujarPuntoBlancoUsuario(lat, lng) {
  if (!map || typeof L === "undefined") return;
  if (userAccuracyCircle) {
    map.removeLayer(userAccuracyCircle);
    userAccuracyCircle = null;
  }

  if (!userMarker) {
    var userIcon = L.divIcon({
      className: "user-marker-container",

      html: '<div style="position:relative;width:18px;height:18px;">' +
        '<div id="user-compass-beam" class="user-compass-beam">' +
        '<svg viewBox="0 0 72 72" width="72" height="72">' +
        '<defs><radialGradient id="keiselBeamGrad" cx="50%" cy="50%" r="50%">' +
        '<stop offset="0%" stop-color="#38bdf8" stop-opacity="0.55"/>' +
        '<stop offset="65%" stop-color="#38bdf8" stop-opacity="0.22"/>' +
        '<stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/>' +
        '</radialGradient></defs>' +
        '<path d="M36,36 L14,6 A36,36 0 0,1 58,6 Z" fill="url(#keiselBeamGrad)"/>' +
        '</svg></div>' +
        '<div class="user-pulse-halo"></div>' +
        '<div class="user-white-dot"></div>' +
        '</div>',

      iconSize: [18, 18],

      iconAnchor: [9, 9],
    });

    userMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 })

      .addTo(map)

      .bindPopup("<b>Tu ubicación actual</b>");
  } else {
    var prev = userMarker.getLatLng();
    animarMarcador(userMarker, [prev.lat, prev.lng], [lat, lng], 900);
  }
}

var brujulaUsuario = {
  iniciada: false,
  anguloVisual: null,
  ultimoSensorTs: 0,
};

function actualizarHazBrujula(grados) {
  if (typeof grados !== "number" || isNaN(grados)) return;
  var objetivo = ((grados % 360) + 360) % 360;

  if (brujulaUsuario.anguloVisual === null) {
    brujulaUsuario.anguloVisual = objetivo;
  } else {
    // Interpolación por el ángulo más corto (evita giro brusco al cruzar 0°/360°)
    var actualMod = ((brujulaUsuario.anguloVisual % 360) + 360) % 360;
    var delta = objetivo - actualMod;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    brujulaUsuario.anguloVisual += delta * 0.35;
  }

  var beam = document.getElementById("user-compass-beam");
  if (beam) {
    beam.classList.add("user-compass-beam--activo");
    beam.style.transform = "rotate(" + brujulaUsuario.anguloVisual.toFixed(1) + "deg)";
  }
}

function manejarOrientacionDispositivo(ev) {
  var heading = null;
  if (typeof ev.webkitCompassHeading === "number" && !isNaN(ev.webkitCompassHeading)) {
    heading = ev.webkitCompassHeading;
  } else if (ev.absolute === true && typeof ev.alpha === "number" && !isNaN(ev.alpha)) {
    heading = (360 - ev.alpha) % 360;
  } else if (typeof ev.alpha === "number" && !isNaN(ev.alpha)) {
    heading = (360 - ev.alpha) % 360;
  }
  if (heading !== null) {
    brujulaUsuario.ultimoSensorTs = Date.now();
    actualizarHazBrujula(heading);
  }
}

function iniciarBrujulaUsuario(desdeGestoUsuario) {
  if (brujulaUsuario.iniciada || typeof window === "undefined") return;

  if (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    if (!desdeGestoUsuario) return;
    DeviceOrientationEvent.requestPermission()
      .then(function (estado) {
        if (estado === "granted") {
          brujulaUsuario.iniciada = true;
          window.addEventListener("deviceorientation", manejarOrientacionDispositivo, true);
        }
      })
      .catch(function () {});
    return;
  }

  if ("ondeviceorientationabsolute" in window) {
    brujulaUsuario.iniciada = true;
    window.addEventListener("deviceorientationabsolute", manejarOrientacionDispositivo, true);
  } else if ("ondeviceorientation" in window) {
    brujulaUsuario.iniciada = true;
    window.addEventListener("deviceorientation", manejarOrientacionDispositivo, true);
  }
}

var kalmanUsuario = {
  lat: null,
  lng: null,
  varianza: -1,
  ultimoTs: 0,
  qMetrosPorSeg: 2.5,
};

function procesarLecturaGpsUsuario(pos) {
  if (!pos || !pos.coords) return;

  var lat = pos.coords.latitude;
  var lng = pos.coords.longitude;
  var accuracy = Math.max(pos.coords.accuracy || 20, 3);
  var speed = pos.coords.speed;
  var gpsHeading = pos.coords.heading;
  var ahora = pos.timestamp || Date.now();

  if (
    typeof gpsHeading === "number" &&
    !isNaN(gpsHeading) &&
    gpsHeading >= 0 &&
    Date.now() - brujulaUsuario.ultimoSensorTs > 3000
  ) {
    actualizarHazBrujula(gpsHeading);
  }

  // Descartar lecturas extremadamente imprecisas (> 100 m) si ya tenemos estado Kalman
  if (kalmanUsuario.varianza >= 0 && accuracy > 100) {
    return;
  }

  // Inicialización del Filtro de Kalman en la primera lectura
  if (kalmanUsuario.varianza < 0) {
    kalmanUsuario.lat = lat;
    kalmanUsuario.lng = lng;
    kalmanUsuario.varianza = accuracy * accuracy;
    kalmanUsuario.ultimoTs = ahora;

    userPosFijada = [lat, lng];
    userPosActual = [lat, lng];
    mejorAccuracyUsuario = accuracy;

    dibujarPuntoBlancoUsuario(lat, lng);

    if (map && (centrarUsuarioPendiente ||
        (!yaCentroUsuario && !busPosActual && rutaFiltroActiva === "todos"))) {
      centrarUsuarioPendiente = false;
      yaCentroUsuario = true;
      map.flyTo(userPosActual, 17, { animate: true, duration: 1 });
    }
    return;
  }

  // Predicción temporal del Filtro de Kalman (Q depende del tiempo y velocidad real)
  var dtSeg = Math.max(0, (ahora - kalmanUsuario.ultimoTs) / 1000);
  if (dtSeg > 0) {
    var qVel = speed !== null && speed !== undefined && speed > 0.8 ? Math.max(speed, 2.5) : kalmanUsuario.qMetrosPorSeg;
    kalmanUsuario.varianza += dtSeg * qVel * qVel;
    kalmanUsuario.ultimoTs = ahora;
  }

  // Ganancia óptima de Kalman K = P / (P + R), donde R = accuracy^2
  var kGain = kalmanUsuario.varianza / (kalmanUsuario.varianza + accuracy * accuracy);
  kalmanUsuario.lat += kGain * (lat - kalmanUsuario.lat);
  kalmanUsuario.lng += kGain * (lng - kalmanUsuario.lng);
  kalmanUsuario.varianza = (1 - kGain) * kalmanUsuario.varianza;

  var distFiltrada = calcularDistanciaMetros(
    userPosFijada[0],
    userPosFijada[1],
    kalmanUsuario.lat,
    kalmanUsuario.lng,
  );

  // Evitar micro-vibraciones menores a 2.5 m cuando está detenido
  if (distFiltrada < 2.5 && (!speed || speed < 0.5)) {
    return;
  }

  userPosFijada = [kalmanUsuario.lat, kalmanUsuario.lng];
  userPosActual = [kalmanUsuario.lat, kalmanUsuario.lng];
  dibujarPuntoBlancoUsuario(kalmanUsuario.lat, kalmanUsuario.lng);

  if (busSeleccionadoId && busMarkers[busSeleccionadoId]) {
    var bAct = busMarkers[busSeleccionadoId];

  }
}

function iniciarUbicacionUsuario() {
  iniciarBrujulaUsuario(false);
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
  centrarUsuarioPendiente = !userPosActual;
  if (userPosActual && map) {
    map.flyTo(userPosActual, 18, { animate: true, duration: 0.8 });

    if (userMarker) userMarker.openPopup();
  }

  // Permitir recalibración inmediata si el usuario se movió de interior a exterior
  if (kalmanUsuario) {
    kalmanUsuario.varianza = -1;
  }
  iniciarBrujulaUsuario(true);
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

var ultimaTelemetriaTs = 0;
var frescuraInterval = null;

function refrescarTextoFrescura() {
  var el = document.getElementById("bus-frescura");
  if (!el) return;
  if (!ultimaTelemetriaTs || Object.keys(busMarkers).length === 0) {
    el.hidden = true;
    return;
  }
  var seg = Math.max(0, Math.round((Date.now() - ultimaTelemetriaTs) / 1000));
  var texto = seg < 60 ? "Actualizado hace " + seg + " s" : "Actualizado hace " + Math.floor(seg / 60) + " min";
  el.textContent = texto;
  el.classList.toggle("tarjeta-bus-frescura--lenta", seg > 15);
  el.hidden = false;
}

function iniciarRelojFrescura() {
  if (frescuraInterval) return;
  frescuraInterval = setInterval(refrescarTextoFrescura, 1000);
}

function actualizarBusesActivos(busesList, desdeFiltro) {
  if (!desdeFiltro) {
    ultimosBusesApi = Array.isArray(busesList) ? busesList.slice() : [];
  }
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

  // Una respuesta válida actualiza los inicios de todos los buses, incluso los ocultos por el filtro.
  if (!desdeFiltro && Array.isArray(busesList)) {
    var ahora = performance.now();
    var inicios = new Map();
    validos.forEach(function (b) {
      var id = b.id || b.bus_id || b.busId || "bus_keisel_1";
      inicios.set(id, inicioTransmisionPorBus.get(id) ?? ahora);
    });
    inicioTransmisionPorBus = inicios;
  }

  validos = validos.filter(coincideFiltroRuta);

  var bus01RealActivo = validos.some(function (b) {
    return (b.id || b.bus_id || b.busId) === "bus_keisel_1";
  });
  cambiarVisibilidadSimulacionBarranca(
    (rutaFiltroActiva === "barranca" || rutaFiltroActiva === "todos") &&
      !bus01RealActivo,
  );

  var tsMax = 0;
  validos.forEach(function (b) {
    var f = b.actualizado_en || b.fecha_actualizacion || b.timestamp;
    var tt = f ? new Date(f).getTime() : NaN;
    if (!isNaN(tt) && tt > tsMax) tsMax = tt;
  });
  if (validos.length > 0) {
    // Se acota a la hora local para evitar valores negativos por desfase de reloj servidor/cliente
    ultimaTelemetriaTs = tsMax ? Math.min(tsMax, Date.now()) : Date.now();
    iniciarRelojFrescura();
  }

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
        '<div class="bus-heading-wrap" style="position:absolute;top:-7px;left:50%;width:10px;height:10px;margin-left:-5px;transform-origin:5px 25px;opacity:0;transition:transform 0.6s ease-out,opacity 0.3s ease;pointer-events:none;">' +
        '<svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,0 9,8 5,6 1,8" fill="#38bdf8"/></svg>' +
        "</div>" +
        '<div class="bus-pin-core">' +
        busSvg +
        "</div>" +
        '<span style="background:#141416; color:#FFFFFF; border:1px solid rgba(255,255,255,0.4); font-size:10px; font-weight:800; padding:1px 6px; border-radius:6px; margin-top:3px; white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,0.8); letter-spacing:0.02em;">' +
        escaparHtml(info.nombre) +
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
            escaparHtml(info.nombre) +
            "</b><br>" +
            escaparHtml(info.ruta) +
            (info.placa ? "<br>Placa: " + escaparHtml(info.placa) : ""),
        );

      marker.on("click", function () {
        expandirPanelBuses();

        centrarEnBus(bId);
      });

      busMarkers[bId] = { marker: marker, lat: lat, lng: lng, info: info };
    } else {
      var prevLat = busMarkers[bId].lat;
      var prevLng = busMarkers[bId].lng;
      animarMarcador(busMarkers[bId].marker, [prevLat, prevLng], [lat, lng], 1400);

      busMarkers[bId].lat = lat;

      busMarkers[bId].lng = lng;

      busMarkers[bId].info = info;

      var distMov = calcularDistanciaMetros(prevLat, prevLng, lat, lng);
      if (distMov >= 3) {
        var rumbo = calcularRumbo(prevLat, prevLng, lat, lng);
        var elBus = busMarkers[bId].marker.getElement();
        if (elBus) {
          var flecha = elBus.querySelector(".bus-heading-wrap");
          if (flecha) {
            flecha.style.opacity = "1";
            flecha.style.transform = "rotate(" + Math.round(rumbo) + "deg)";
          }
        }
      }

      // El bus ya llega preajustado al eje vial antes de renderizarse
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

  var btnSeguir = document.getElementById("btn-seguir-bus");
  if (btnSeguir) btnSeguir.style.display = activeCount === 0 ? "none" : "flex";
  refrescarTextoFrescura();

  var dot = document.getElementById("live-dot");

  var status = document.getElementById("header-status");

  var btnC = document.getElementById("btn-centrar-bus");

  var badge = document.getElementById("bus-live-badge");

  var nameEl = document.getElementById("bus-main-name");

  var sub = document.getElementById("bus-subtext");

  var chips = document.getElementById("bus-chips-container");

  if (activeCount === 0) {
    busPosActual = null;
    busSeleccionadoId = null;
    limpiarRutaMapa();

    if (dot) dot.className = simulacionBarranca.visible ? "estado-dot estado-dot--activo" : "estado-dot";

    var etiqueta = ETIQUETAS_RUTA[rutaFiltroActiva] || "Ruta";
    if (status) {
      status.innerText = simulacionBarranca.visible
        ? "BARRANCA"
        : rutaFiltroActiva === "todos"
          ? "SIN BUS EN RUTA"
          : "SIN BUS EN " + etiqueta.toUpperCase();
    }

    if (btnC) btnC.style.display = "none";

    if (badge) {
      badge.innerText = simulacionBarranca.visible ? "RECORRIENDO" : "DESCONECTADO";

      badge.className = "badge-vivo";
    }

    if (nameEl) {
      nameEl.innerText = simulacionBarranca.visible
        ? "Bus 01"
        : rutaFiltroActiva === "todos"
          ? "Bus Universitario"
          : "Ruta " + etiqueta;
    }

    if (sub) {
      sub.innerText = simulacionBarranca.visible
        ? "Barranca → UNAB · pausas de 10 s en paraderos"
        : rutaFiltroActiva === "todos"
          ? "Esperando señal GPS activa..."
          : "Sin buses activos en " + etiqueta + " en este momento.";
    }

    if (chips) chips.innerHTML = "";
  } else if (activeCount === 1) {
    var firstId = Object.keys(busMarkers)[0];

    var firstBus = busMarkers[firstId];

    busPosActual = [firstBus.lat, firstBus.lng];

    if (dot) dot.className = "estado-dot estado-dot--activo";

    if (status) status.innerText = "1 BUS EN RUTA";

    if (btnC) btnC.style.display = "flex";

    if (badge) {
      badge.innerText = "EN VIVO";

      badge.className =
        "badge-vivo badge-vivo--activo";
    }

    if (nameEl) nameEl.innerText = firstBus.info.nombre;

    busSeleccionadoId = firstId;

    if (sub) {
      sub.innerText = ultimaEtaTexto
        ? firstBus.info.ruta + " · " + ultimaEtaTexto
        : firstBus.info.ruta;
    }

    if (chips) chips.innerHTML = "";
  } else {
    var idsActivos = Object.keys(busMarkers);

    if (!busSeleccionadoId || !busMarkers[busSeleccionadoId]) {
      busSeleccionadoId = idsActivos[0];
    }
    var firstBus = busMarkers[busSeleccionadoId];

    busPosActual = [firstBus.lat, firstBus.lng];


    if (dot) dot.className = "estado-dot estado-dot--activo";

    if (status) status.innerText = activeCount + " BUSES EN RUTA";

    if (btnC) btnC.style.display = "flex";

    if (badge) {
      badge.innerText = activeCount + " EN VIVO";

      badge.className =
        "badge-vivo badge-vivo--activo";
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
      chips.textContent = "";

      var btnTodos = document.createElement("button");
      btnTodos.className =
        "chip-bus";
      btnTodos.textContent = "Todos";
      btnTodos.addEventListener("click", function () {
        centrarEnBus();
      });
      chips.appendChild(btnTodos);

      idsActivos.forEach(function (id) {
        var btnBus = document.createElement("button");
        btnBus.className =
          "chip-bus";
        btnBus.textContent = busMarkers[id].info.nombre;
        btnBus.addEventListener("click", function () {
          centrarEnBus(id);
        });
        chips.appendChild(btnBus);
      });
    }
  }
}

// --- TELEMETRÍA NATIVA: API NODE.JS + SQL SERVER (LAN / TAILSCALE) ---

var numeroSondeoGps = 0;
var ultimoSondeoGpsAplicado = 0;

async function cargarPosicionApi() {
  var sondeo = ++numeroSondeoGps;
  var busesEnPista = null;
  try {
    var buses = await KeiselAPI.obtenerGps();
    if (Array.isArray(buses)) busesEnPista = await preajustarBusesAPista(buses);
  } catch (err) {
    // Un fallo de consulta no confirma que el conductor haya detenido la transmisión.
  }

  if (sondeo <= ultimoSondeoGpsAplicado) return;
  ultimoSondeoGpsAplicado = sondeo;
  actualizarBusesActivos(busesEnPista);
}

function iniciarPollingGps() {
  detenerPollingGps();

  cargarPosicionApi();

  gpsInterval = setInterval(cargarPosicionApi, 1500);
}

function detenerPollingGps() {
  if (gpsInterval) {
    clearInterval(gpsInterval);

    gpsInterval = null;
  }
}

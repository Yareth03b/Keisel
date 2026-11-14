    // --- ESTADO GENERAL Y RUTAS DE API ---
    var vistaActiva = 'inicio';
    var origenVistaMapa = 'inicio';
    var meadowEngine = null;
    var esAdminAutenticado = false;

    var API_BASE_URL = '/api';
    var API_TAILSCALE_URL = 'http://100.67.14.105:3000/api';

    // --- ENRUTADOR DE PANTALLAS ---
    function navegarA(vista) {
      vistaActiva = vista;
      var vInicio = document.getElementById('vista-inicio');
      var vMapa = document.getElementById('vista-mapa');
      var vAdminLogin = document.getElementById('vista-admin-login');
      var vAdmin = document.getElementById('vista-admin');
      var btnVolverAdmin = document.getElementById('btn-volver-admin');

      if (vInicio) { vInicio.classList.add('hidden'); vInicio.style.display = 'none'; }
      if (vMapa) { vMapa.classList.add('hidden'); vMapa.style.display = 'none'; }
      if (vAdminLogin) { vAdminLogin.classList.add('hidden'); vAdminLogin.style.display = 'none'; }
      if (vAdmin) { vAdmin.classList.add('hidden'); vAdmin.style.display = 'none'; }

      if (vista === 'inicio') {
        if (vInicio) { vInicio.classList.remove('hidden'); vInicio.style.display = 'flex'; }
        detenerPollingGps();
      } else if (vista === 'mapa') {
        var backText = document.getElementById('btn-mapa-back-text');
        if (backText) {
          if (origenVistaMapa === 'admin' || esAdminAutenticado) {
            backText.innerText = "Panel Admin";
          } else {
            backText.innerText = "Estudiantes";
          }
        }
        if (vMapa) { vMapa.classList.remove('hidden'); vMapa.style.display = 'flex'; }
        if (btnVolverAdmin) {
          if (esAdminAutenticado) btnVolverAdmin.classList.remove('hidden');
          else btnVolverAdmin.classList.add('hidden');
        }
        initLeafletMap();
        iniciarPollingGps();
        achicarPanelBuses();
        if (map) {
          setTimeout(function() { map.invalidateSize(); }, 150);
        }
      } else if (vista === 'admin-login') {
        if (vAdminLogin) { vAdminLogin.classList.remove('hidden'); vAdminLogin.style.display = 'flex'; }
        detenerPollingGps();
        iniciarFondoStardust();
      } else if (vista === 'admin') {
        if (vAdmin) {
          vAdmin.classList.remove('hidden');
          vAdmin.style.display = 'flex';
        }
        detenerPollingGps();
      }
    }

    function toggleAdminPasswordVis() {
      var pwd = document.getElementById('adminPassword');
      var eye = document.getElementById('adminEyeIcon');
      if (pwd && eye) {
        var isPass = pwd.type === 'password';
        pwd.type = isPass ? 'text' : 'password';
        eye.innerText = isPass ? 'visibility' : 'visibility_off';
      }
    }

        // --- MOTOR C�SMICO STARDUST CANVAS 2D (ULTRA LIGERO) ---
    var stardustEngine = null;
    function iniciarFondoStardust() {
      if (stardustEngine) {
        stardustEngine.resize();
        return;
      }
      var viewport = document.getElementById('stardust-viewport');
      if (!viewport) return;

      if (typeof window.initStardustBackground === 'function') {
        try {
          stardustEngine = window.initStardustBackground(viewport, {
            background: '#040711',
            particleColor: '#ffffff',
            particleDensity: 1.2,
            minSize: 0.5,
            maxSize: 1.2,
            speed: 6,
            movement: 2.5,
            angle: 180
          });
        } catch (e) {
          console.warn('Error inicializando Stardust:', e);
        }
      } else {
        setTimeout(iniciarFondoStardust, 150);
      }
    }

    // --- AUTENTICACIÓN ADMINISTRADOR (100% DINÁMICA POR SERVIDOR - CERO CLAVES EN PLANO) ---
    async function handleAdminLoginSubmit(e) {
      if (e) e.preventDefault();
      var acc = (document.getElementById('adminEmail').value || '').trim();
      var pwd = (document.getElementById('adminPassword').value || '').trim();
      var btn = document.getElementById('btnAdminLogin');
      var errBox = document.getElementById('admin-login-error');

      if (errBox) errBox.classList.add('hidden');

      if (!acc || !pwd) {
        if (errBox) {
          errBox.innerText = "Ingresa tu usuario y contraseña.";
          errBox.classList.remove('hidden');
        }
        showToast("Ingresa tu usuario y contraseña.");
        return;
      }

      var origHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span>Verificando credenciales...</span>';

      function reportarErrorLogin(mensaje) {
        var textoError = mensaje || "Cuenta o contraseña incorrecta en Active Directory.";
        if (errBox) {
          errBox.innerText = textoError;
          errBox.classList.remove('hidden');
        }
        showToast(textoError);
        btn.disabled = false;
        btn.innerHTML = origHtml;
        var pInput = document.getElementById('adminPassword');
        if (pInput) {
          pInput.value = '';
          pInput.focus();
        }
      }

      try {
        var endpoints = [API_BASE_URL, API_TAILSCALE_URL];

        for (var i = 0; i < endpoints.length; i++) {
          try {
            var resp = await fetch(endpoints[i] + '/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ usuario: acc, contrasena: pwd }),
              signal: AbortSignal.timeout(4000)
            });

            if (resp.ok) {
              var data = await resp.json();
              if (data.status === 'success' && data.usuario && data.usuario.rol === 'ADMIN') {
                API_BASE_URL = endpoints[i];
                esAdminAutenticado = true;
                showToast("Acceso Concedido por Active Directory");
                btn.disabled = false;
                btn.innerHTML = origHtml;
                navegarA('admin');
                return;
              } else {
                reportarErrorLogin("El usuario no cuenta con privilegios de Administrador.");
                return;
              }
            } else if (resp.status === 401) {
              reportarErrorLogin("Credenciales no autorizadas en el dominio keisel.me");
              return;
            }
          } catch (netErr) {
            // Error de conexión con el endpoint actual, continuar con el siguiente
          }
        }

        // Si ningún servidor respondió (servidores apagados o sin conexión)
        reportarErrorLogin("No se pudo conectar con Active Directory. Verifique que el servidor de dominio (.253) y la API estén encendidos.");
      } catch (err) {
        console.warn("Fallo de conexión:", err);
        reportarErrorLogin("Error de comunicación con el servicio de autenticación.");
      }
    }

    function handleAdminLogout() {
      esAdminAutenticado = false;
      showToast("Cerrando sesión de Administrador...");
      setTimeout(function() {
        navegarA('inicio');
      }, 350);
    }

    function handleLogoutAdmin() {
      handleAdminLogout();
    }

    function limpiarSenalSupabase(customBusId) {
      var targetBusId = customBusId || 'bus_keisel_1';
      var payload = JSON.stringify({ id: targetBusId });

      fetch(API_BASE_URL + '/corte-emergencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      }).catch(function() {
        fetch(API_TAILSCALE_URL + '/corte-emergencia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload
        }).catch(function(e) {
          console.warn('Error en corte de emergencia:', e);
        });
      });
    }

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
      var mapEl = document.getElementById('map');
      if (!mapEl || typeof L === 'undefined') return;

      var barrancaCentro = [-10.7516, -77.7610];
      map = L.map('map', {
        center: barrancaCentro,
        zoom: 15,
        zoomControl: false,
        attributionControl: true
      });

      // Capa oficial de OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      iniciarUbicacionUsuario();
    }

    
    function achicarPanelBuses() {
      var panel = document.getElementById('panel-tarjeta-bus');
      var btnCirculo = document.getElementById('btn-desplegar-buses');
      if (panel) panel.style.display = 'none';
      if (btnCirculo) btnCirculo.style.display = 'flex';
    }

    function expandirPanelBuses() {
      var panel = document.getElementById('panel-tarjeta-bus');
      var btnCirculo = document.getElementById('btn-desplegar-buses');
      if (btnCirculo) btnCirculo.style.display = 'none';
      if (panel) panel.style.display = 'flex';
    }

    function centrarEnMiUbicacion() {
      obtenerUbicacionAltaPrecision();
      if (map && userPosActual) {
        map.flyTo(userPosActual, 17, { animate: true, duration: 1 });
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(pos) {
          userPosActual = [pos.coords.latitude, pos.coords.longitude];
          dibujarPuntoUsuario(userPosActual[0], userPosActual[1]);
          if (map) map.flyTo(userPosActual, 17, { animate: true, duration: 1 });
        });
      }
    }

    function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
      var R = 6371000;
      var dLat = (lat2 - lat1) * Math.PI / 180;
      var dLon = (lon2 - lon1) * Math.PI / 180;
      var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    function aplicarDispersionVisual(buses) {
      if (!buses || buses.length <= 1) return buses;
      var lista = buses.map(function(b) {
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
          actualizado_en: b.actualizado_en
        };
      });

      // Detecta colisiones directas (< 35 metros) para que los marcadores no se tapen
      for (var i = 0; i < lista.length; i++) {
        var colisiones = [i];
        for (var j = i + 1; j < lista.length; j++) {
          var d = calcularDistanciaMetros(lista[i].latReal, lista[i].lngReal, lista[j].latReal, lista[j].lngReal);
          if (d < 35.0) {
            colisiones.push(j);
          }
        }
        if (colisiones.length > 1) {
          // Separación angular limpia de ~22 metros para visualización simultánea de todos los buses
          var radioGrados = 0.00020;
          for (var k = 0; k < colisiones.length; k++) {
            var idx = colisiones[k];
            var angulo = (2 * Math.PI / colisiones.length) * k;
            lista[idx].latitud = Number((lista[idx].latReal + Math.sin(angulo) * radioGrados).toFixed(7));
            lista[idx].longitud = Number((lista[idx].lngReal + Math.cos(angulo) * radioGrados).toFixed(7));
          }
        }
      }
      return lista;
    }

    var busMarkers = {};
    var BUS_CATALOGO = {
      "bus_keisel_1": { nombre: "Bus 01", ruta: "Barranca - UNAB", placa: "EUA-482" },
      "bus_keisel_2": { nombre: "Bus 02", ruta: "Supe - UNAB", placa: "B4T-912" },
      "bus_keisel_3": { nombre: "Bus 03", ruta: "Paramonga - UNAB", placa: "C1V-554" }
    };

    function centrarEnBus(especificoId) {
      if (!map) return;
      var ids = Object.keys(busMarkers);
      if (ids.length === 0) {
        if (typeof showToast === 'function') showToast("No hay ningún bus transmitiendo en este momento.");
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
        ids.forEach(function(id) {
          group.push([busMarkers[id].lat, busMarkers[id].lng]);
        });
        if (typeof userPosActual !== 'undefined' && userPosActual) {
          group.push(userPosActual);
        }
        var bounds = L.latLngBounds(group);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
      }
    }

    function dibujarPuntoUsuario(lat, lng) {
      if (!map || typeof L === 'undefined') return;
      if (!userMarker) {
        var userIcon = L.divIcon({
          className: 'user-marker-container',
          html: '<div style="position:relative;"><div class="user-pulse-halo"></div><div class="user-white-dot"></div></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });
        userMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
      } else {
        userMarker.setLatLng([lat, lng]);
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
      origenVistaMapa = 'admin';
      navegarA('mapa');
    }

    function retrocederDesdeMapa() {
      if (origenVistaMapa === 'admin' || esAdminAutenticado) {
        origenVistaMapa = null;
        navegarA('admin');
      } else {
        navegarA('inicio');
      }
    }

    // --- UBICACIÓN DEL ESTUDIANTE: PUNTO BLANCO LIMPIO Y EXACTO ---
    function dibujarPuntoBlancoUsuario(lat, lng) {
      if (!map || typeof L === 'undefined') return;
      if (!userMarker) {
        var userIcon = L.divIcon({
          className: 'user-marker-container',
          html: '<div style="position:relative;"><div class="user-pulse-halo"></div><div class="user-white-dot"></div></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9]
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
        var distAlBus = calcularDistanciaMetros(lat, lng, busPosActual[0], busPosActual[1]);
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

      var distancia = calcularDistanciaMetros(userPosFijada[0], userPosFijada[1], lat, lng);

      // Si está quieto o la distancia es menor al umbral de 8m, no mover el punto
      if ((speed !== null && speed !== undefined && speed < 0.5 && distancia < 15.0) || distancia < UMBRAL_MOVIMIENTO_METROS) {
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
      var latSuavizada = (userPosFijada[0] * 0.3) + (lat * 0.7);
      var lngSuavizada = (userPosFijada[1] * 0.3) + (lng * 0.7);

      userPosFijada = [latSuavizada, lngSuavizada];
      userPosActual = [latSuavizada, lngSuavizada];
      dibujarPuntoBlancoUsuario(latSuavizada, lngSuavizada);
    }

    function iniciarUbicacionUsuario() {
      if (!navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(
        function(pos) {
          procesarLecturaGpsUsuario(pos);
        },
        function(err) {
          console.warn("Geolocalización inicial:", err.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      if (userWatchId === null) {
        userWatchId = navigator.geolocation.watchPosition(
          function(pos) {
            procesarLecturaGpsUsuario(pos);
          },
          function(err) {
            console.warn("Watch geolocalización:", err.message);
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
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

    function actualizarBusesActivos(busesList) {
      if (!map || typeof L === 'undefined') return;

      var validos = (busesList || []).filter(function(b) {
        if (!b || b.latitud === null || b.longitud === null) return false;
        var lat = Number(b.latitud);
        var lng = Number(b.longitud);
        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return false;

        if (b.actualizado_en) {
          var t = new Date(b.actualizado_en).getTime();
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

      dispersados.forEach(function(b) {
        var bId = b.id || 'bus_keisel_1';
        idsRecibidos.add(bId);

        var lat = b.latitud;
        var lng = b.longitud;
        var info = BUS_CATALOGO[bId] || {
          nombre: b.nombre || ("Bus " + bId.replace('bus_keisel_', '')),
          ruta: b.ruta || "Ruta Universitaria Activa",
          placa: b.placa || ""
        };

        if (!busMarkers[bId]) {
          var busSvg = '<svg style="width:16px;height:16px;" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect height="16" rx="4" width="18" x="3" y="3"></rect><path d="M3 11h18"></path><path d="M19 19v2"></path><path d="M5 19v2"></path><circle cx="7.5" cy="15" fill="#FFFFFF" r="1.2" stroke="none"></circle><circle cx="16.5" cy="15" fill="#FFFFFF" r="1.2" stroke="none"></circle></svg>';
          
          var busHtml = '<div style="position:relative; display:flex; flex-direction:column; align-items:center;">' +
                          '<div class="bus-pulse-ring"></div>' +
                          '<div class="bus-pin-core">' + busSvg + '</div>' +
                          '<span style="background:#141416; color:#FFFFFF; border:1px solid rgba(255,255,255,0.4); font-size:10px; font-weight:800; padding:1px 6px; border-radius:6px; margin-top:3px; white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,0.8); letter-spacing:0.02em;">' + info.nombre + '</span>' +
                        '</div>';

          var busIcon = L.divIcon({
            className: 'bus-marker-container',
            html: busHtml,
            iconSize: [40, 52],
            iconAnchor: [20, 20]
          });

          var marker = L.marker([lat, lng], { icon: busIcon, zIndexOffset: 1500 })
            .addTo(map)
            .bindPopup("<b>" + info.nombre + "</b><br>" + info.ruta + (info.placa ? "<br>Placa: " + info.placa : ""));

          marker.on('click', function() {
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
      Object.keys(busMarkers).forEach(function(oldId) {
        if (!idsRecibidos.has(oldId)) {
          map.removeLayer(busMarkers[oldId].marker);
          delete busMarkers[oldId];
        }
      });

      var activeCount = Object.keys(busMarkers).length;

      var dot = document.getElementById('live-dot');
      var status = document.getElementById('header-status');
      var btnC = document.getElementById('btn-centrar-bus');
      var badge = document.getElementById('bus-live-badge');
      var nameEl = document.getElementById('bus-main-name');
      var sub = document.getElementById('bus-subtext');
      var chips = document.getElementById('bus-chips-container');

      if (activeCount === 0) {
        busPosActual = null;
        if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-neutral-600";
        if (status) status.innerText = "SIN BUS EN RUTA";
        if (btnC) btnC.style.display = 'none';
        if (badge) {
          badge.innerText = "DESCONECTADO";
          badge.className = "text-[9px] font-bold text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded-full tracking-wider uppercase";
        }
        if (nameEl) nameEl.innerText = "Bus Universitario";
        if (sub) sub.innerText = "Esperando señal GPS activa...";
        if (chips) chips.innerHTML = '';
      } else if (activeCount === 1) {
        var firstId = Object.keys(busMarkers)[0];
        var firstBus = busMarkers[firstId];
        busPosActual = [firstBus.lat, firstBus.lng];

        if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-white animate-pulse";
        if (status) status.innerText = "1 BUS EN RUTA";
        if (btnC) btnC.style.display = 'flex';
        if (badge) {
          badge.innerText = "EN VIVO";
          badge.className = "text-[9px] font-bold text-black bg-white px-2 py-0.5 rounded-full tracking-wider uppercase";
        }
        if (nameEl) nameEl.innerText = firstBus.info.nombre;
        if (sub) sub.innerText = firstBus.info.ruta;
        if (chips) chips.innerHTML = '';
      } else {
        var idsActivos = Object.keys(busMarkers);
        var firstBus = busMarkers[idsActivos[0]];
        busPosActual = [firstBus.lat, firstBus.lng];

        if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-white animate-pulse";
        if (status) status.innerText = activeCount + " BUSES EN RUTA";
        if (btnC) btnC.style.display = 'flex';
        if (badge) {
          badge.innerText = activeCount + " EN VIVO";
          badge.className = "text-[9px] font-bold text-black bg-white px-2 py-0.5 rounded-full tracking-wider uppercase";
        }
        if (nameEl) nameEl.innerText = activeCount + " Buses en Ruta";
        
        var nombresRutas = idsActivos.map(function(id) {
          return busMarkers[id].info.nombre + " (" + busMarkers[id].info.ruta.split(' - ')[0] + ")";
        }).join(" · ");
        if (sub) sub.innerText = nombresRutas;

        if (chips) {
          var chipsHtml = '<button onclick="centrarEnBus()" class="text-[10px] bg-white/10 hover:bg-white/20 text-white font-bold px-2 py-0.5 rounded-lg transition-all cursor-pointer">Todos</button>';
          idsActivos.forEach(function(id) {
            chipsHtml += '<button onclick="centrarEnBus(\'' + id + '\')" class="text-[10px] bg-white/10 hover:bg-white/20 text-white font-bold px-2 py-0.5 rounded-lg transition-all cursor-pointer">' + busMarkers[id].info.nombre + '</button>';
          });
          chips.innerHTML = chipsHtml;
        }
      }
    }

    function ocultarBus() {
      actualizarBusesActivos([]);
    }

    // --- TELEMETRÍA NATIVA: API NODE.JS + SQL SERVER (LAN / TAILSCALE) ---
    function cargarPosicionApi() {
      // 1. Probar endpoint primario API en RHEL (LAN 192.168.50.252 / Hostname local)
      fetch(API_BASE_URL + '/obtener-gps', { method: 'GET', cache: 'no-store' })
        .then(function(r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function(buses) {
          if (Array.isArray(buses)) {
            actualizarBusesActivos(buses);
          } else {
            ocultarBus();
          }
        })
        .catch(function() {
          // 2. Probar endpoint de respaldo vía VPN Tailscale (100.67.14.105)
          fetch(API_TAILSCALE_URL + '/obtener-gps', { method: 'GET', cache: 'no-store' })
            .then(function(r) {
              if (!r.ok) throw new Error("HTTP " + r.status);
              return r.json();
            })
            .then(function(buses) {
              if (Array.isArray(buses)) {
                actualizarBusesActivos(buses);
              } else {
                ocultarBus();
              }
            })
            .catch(function() {
              // 3. Probar ruta relativa /api/obtener-gps (Apache Proxy inverso o Cloudflare Tunnel)
              fetch('/api/obtener-gps', { method: 'GET', cache: 'no-store' })
                .then(function(r) {
                  if (!r.ok) throw new Error("HTTP " + r.status);
                  return r.json();
                })
                .then(function(buses) {
                  if (Array.isArray(buses)) {
                    actualizarBusesActivos(buses);
                  } else {
                    ocultarBus();
                  }
                })
                .catch(function() {
                  ocultarBus();
                });
            });
        });
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

    function showToast(msg) {
      var toast = document.getElementById('toast-notify');
      var toastMsg = document.getElementById('toast-msg');
      if (!toast || !toastMsg) return;
      toastMsg.textContent = msg;
      toast.classList.remove('opacity-0', 'translate-y-2');
      toast.classList.add('opacity-100', 'translate-y-0');

      if (window.toastTimeout) clearTimeout(window.toastTimeout);
      window.toastTimeout = setTimeout(function() {
        toast.classList.add('opacity-0', 'translate-y-2');
        toast.classList.remove('opacity-100', 'translate-y-0');
      }, 2600);
    }

    // Métodos del Panel Administrador
// --- MÉTODOS DEL PANEL ADMINISTRADOR ---
    let newBusCounter = 4;
    let newDriverCounter = 4;
    let targetDeleteCardId = null;

    function showToast(msg) {
      const toast = document.getElementById('toast-notify');
      const toastMsg = document.getElementById('toast-msg');
      if (!toast || !toastMsg) return;
      toastMsg.textContent = msg;
      toast.classList.remove('opacity-0', 'translate-y-2');
      toast.classList.add('opacity-100', 'translate-y-0');

      if (window.toastTimeout) clearTimeout(window.toastTimeout);
      window.toastTimeout = setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        toast.classList.remove('opacity-100', 'translate-y-0');
      }, 2400);
    }

    function toggleBusModal(show) {
      const modal = document.getElementById('modal-bus');
      if (!modal) return;
      if (show) {
        modal.classList.remove('hidden');
        const nameInput = document.getElementById('bus-input-name');
        if (nameInput) setTimeout(() => nameInput.focus(), 50);
      } else {
        modal.classList.add('hidden');
      }
    }

    function toggleDriverModal(show) {
      const modal = document.getElementById('modal-driver');
      if (!modal) return;
      if (show) {
        modal.classList.remove('hidden');
        const nameInput = document.getElementById('driver-input-name');
        if (nameInput) setTimeout(() => nameInput.focus(), 50);
      } else {
        modal.classList.add('hidden');
      }
    }

    function toggleEditDriverModal(show) {
      const modal = document.getElementById('modal-edit-driver');
      if (!modal) return;
      if (show) modal.classList.remove('hidden');
      else modal.classList.add('hidden');
    }

    function toggleEditBusModal(show) {
      const modal = document.getElementById('modal-edit-bus');
      if (!modal) return;
      if (show) modal.classList.remove('hidden');
      else modal.classList.add('hidden');
    }

    function handleBackdropClick(event, modalId) {
      if (event.target.id === modalId) {
        document.getElementById(modalId).classList.add('hidden');
      }
    }

    function openEditDriverModal(name, dni, route, bus, cardId) {
      document.getElementById('edit-driver-target-id').value = cardId;
      document.getElementById('edit-driver-input-name').value = name;
      document.getElementById('edit-driver-input-dni').value = dni;
      document.getElementById('edit-driver-input-route').value = route;
      document.getElementById('edit-driver-input-bus').value = bus || '';
      toggleEditDriverModal(true);
    }

    function handleSaveEditDriver(e) {
      e.preventDefault();
      const cardId = document.getElementById('edit-driver-target-id').value;
      const name = document.getElementById('edit-driver-input-name').value;
      const dni = document.getElementById('edit-driver-input-dni').value;
      const route = document.getElementById('edit-driver-input-route').value;
      
      const card = document.getElementById(cardId);
      if (card) {
        const nameEl = card.querySelector('p.text-\\[15px\\]');
        const dniEl = card.querySelector('p.text-xs');
        if (nameEl) nameEl.textContent = name;
        if (dniEl) dniEl.textContent = 'DNI ' + dni;
      }
      toggleEditDriverModal(false);
      showToast('Conductor actualizado');
    }

    function openEditBusModal(name, route, c1, c2, cardId) {
      document.getElementById('edit-bus-target-id').value = cardId;
      document.getElementById('edit-bus-input-name').value = name;
      document.getElementById('edit-bus-input-route').value = route;
      document.getElementById('edit-bus-input-c1').value = c1 || '';
      toggleEditBusModal(true);
    }

    function handleSaveEditBus(e) {
      e.preventDefault();
      const cardId = document.getElementById('edit-bus-target-id').value;
      const name = document.getElementById('edit-bus-input-name').value;
      const route = document.getElementById('edit-bus-input-route').value;
      
      const card = document.getElementById(cardId);
      if (card) {
        const nameSpan = card.querySelector('span.text-\\[15px\\]');
        if (nameSpan) nameSpan.textContent = name;
      }
      toggleEditBusModal(false);
      showToast('Bus actualizado');
    }

    function handleCreateBus(e) {
      e.preventDefault();
      const name = document.getElementById('bus-input-name').value.trim() || ('Bus 0' + newBusCounter);
      const route = document.getElementById('bus-input-route').value;
      const c1 = document.getElementById('bus-input-c1').value;

      const busId = 'bus-card-' + newBusCounter;
      const stateId = 'bus-state-' + newBusCounter;
      const busKey = 'bus_keisel_' + newBusCounter;

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
              <span class="${c1 ? 'text-neutral-400' : 'text-neutral-500'}">
                <span class="${c1 ? 'text-neutral-500' : 'text-neutral-600'}">C1:</span> ${c1 || 'Sin asignar'}
              </span>
              <span class="text-[11px] text-neutral-400 font-medium">${c1 ? 'En turno' : 'Disponible'}</span>
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

      const busesList = document.getElementById('buses-list');
      if (busesList) busesList.insertAdjacentHTML('beforeend', busHtml);

      newBusCounter++;
      toggleBusModal(false);
      e.target.reset();
      showToast(name + ' registrado con éxito');
    }

    function handleCreateDriver(e) {
      e.preventDefault();
      const name = document.getElementById('driver-input-name').value.trim();
      const dni = document.getElementById('driver-input-dni').value.trim();
      const route = document.getElementById('driver-input-route').value;

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
                  <option value="Barranca" ${route === 'Barranca' ? 'selected' : ''}>Barranca</option>
                  <option value="Supe" ${route === 'Supe' ? 'selected' : ''}>Supe</option>
                  <option value="Paramonga" ${route === 'Paramonga' ? 'selected' : ''}>Paramonga</option>
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

      const driversList = document.getElementById('drivers-list');
      if (driversList) driversList.insertAdjacentHTML('beforeend', driverHtml);

      newDriverCounter++;
      toggleDriverModal(false);
      e.target.reset();
      showToast('Conductor añadido');
    }

    function triggerEmergencyCut(busName, cardId, stateId, busKey) {
      const modal = document.getElementById('modal-emergency');
      const title = document.getElementById('emergency-title');
      const confirmBtn = document.getElementById('emergency-confirm-btn');

      title.textContent = 'Corte: ' + busName;
      modal.classList.remove('hidden');

      confirmBtn.onclick = function() {
        const card = document.getElementById(cardId);
        const state = document.getElementById(stateId);
        if (card) card.classList.add('opacity-50');
        if (state) state.textContent = 'Apagado';
        
        // Limpiar la señal real en Supabase para que el bus desaparezca del mapa
        limpiarSenalSupabase(busKey);

        closeEmergencyModal();
        showToast('Corte de señal aplicado a ' + busName);
      };
    }

    function closeEmergencyModal() {
      document.getElementById('modal-emergency').classList.add('hidden');
    }

    function confirmDeleteDriver(name, cardId) {
      targetDeleteCardId = cardId;
      document.getElementById('delete-dialog-title').textContent = '¿Eliminar a ' + name + '?';
      document.getElementById('delete-confirm-btn').onclick = function() {
        const card = document.getElementById(targetDeleteCardId);
        if (card) card.remove();
        closeDeleteModal();
        showToast(name + ' eliminado');
      };
      document.getElementById('modal-confirm-delete').classList.remove('hidden');
    }

    function confirmDeleteBus(name, cardId) {
      targetDeleteCardId = cardId;
      document.getElementById('delete-dialog-title').textContent = '¿Eliminar ' + name + '?';
      document.getElementById('delete-confirm-btn').onclick = function() {
        const card = document.getElementById(targetDeleteCardId);
        if (card) card.remove();
        closeDeleteModal();
        showToast(name + ' eliminado');
      };
      document.getElementById('modal-confirm-delete').classList.remove('hidden');
    }

    function closeDeleteModal() {
      document.getElementById('modal-confirm-delete').classList.add('hidden');
      targetDeleteCardId = null;
    }

    function updateDriverRoute(id, route) {
      showToast('Ruta actualizada a ' + route);
    }

    function toggleDriverAccess(id) {
      const statusBadge = document.getElementById('driver-status-' + id);
      const btn = document.getElementById('driver-btn-' + id);
      const card = document.getElementById('driver-card-' + id);

      if (!statusBadge || !btn || !card) return;

      if (statusBadge.textContent.trim().toUpperCase() === 'ACTIVO') {
        statusBadge.textContent = 'Inactivo';
        btn.textContent = 'Activar';
        card.classList.add('opacity-60');
        showToast('Acceso desactivado');
      } else {
        statusBadge.textContent = 'Activo';
        btn.textContent = 'Desactivar';
        card.classList.remove('opacity-60');
        showToast('Acceso activado');
      }
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        toggleBusModal(false);
        toggleDriverModal(false);
        toggleEditDriverModal(false);
        toggleEditBusModal(false);
        closeEmergencyModal();
        closeDeleteModal();
      }
    });
  
  
        // --- INICIALIZACIÓN SEGÚN LA PÁGINA ---
    var esPaginaEstudiantesDirecta = window.location.pathname.includes('mapa_estudiantes') || 
      (document.getElementById('vista-inicio') && document.getElementById('vista-inicio').classList.contains('hidden'));

    if (esPaginaEstudiantesDirecta) {
      function arrancarMapaEstudiantes() {
        navegarA('mapa');
        initLeafletMap();
        iniciarPollingGps();
        if (map) {
          setTimeout(function() { map.invalidateSize(); }, 100);
          setTimeout(function() { map.invalidateSize(); }, 400);
        }
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', arrancarMapaEstudiantes);
      } else {
        arrancarMapaEstudiantes();
      }
      window.addEventListener('load', arrancarMapaEstudiantes);
    } else {
      window.addEventListener('load', function() {
        if (window.location.hash === '#mapa' || window.location.search.includes('mapa')) {
          navegarA('mapa');
        }
      });
    }
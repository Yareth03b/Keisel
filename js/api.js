/**
 * Keisel - Cliente de Red y Servicios de API Desacoplados
 * Manejo de alta disponibilidad (failover automático LAN -> Tailscale -> Proxy Relativo)
 */
const KeiselAPI = {
  /**
   * Obtiene la lista ordenada de endpoints para tolerancia a fallos
   */
  getEndpoints: function () {
    var list = [];
    if (typeof KeiselConfig !== "undefined") {
      if (KeiselConfig.API_BASE_URL) list.push(KeiselConfig.API_BASE_URL);
      if (KeiselConfig.API_LAN_URL) list.push(KeiselConfig.API_LAN_URL);
      if (KeiselConfig.API_TAILSCALE_URL) list.push(KeiselConfig.API_TAILSCALE_URL);
    }
    if (list.length === 0) {
      list = ["/api", "http://192.168.50.252:3000/api", "http://100.67.14.105:3000/api"];
    }
    return list;
  },

  /**
   * Ejecuta peticiones HTTP con rotación secuencial y timeout seguro
   */
  request: async function (path, options) {
    options = options || {};
    var endpoints = this.getEndpoints();
    var timeout =
      options.timeout ||
      (typeof KeiselConfig !== "undefined"
        ? KeiselConfig.REQUEST_TIMEOUT_MS
        : 4000);
    var lastError = null;

    for (var i = 0; i < endpoints.length; i++) {
      var base = endpoints[i];
      var url = base + path;
      try {
        var fetchOpts = {
          method: options.method || "GET",
          headers: options.headers || {},
          cache: options.cache || "default",
        };
        if (options.body) fetchOpts.body = options.body;
        if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) {
          fetchOpts.signal = AbortSignal.timeout(timeout);
        }

        var response = await fetch(url, fetchOpts);
        // 404 en ruta relativa (ej. Live Server sin proxy) o 502-504 (Node caido):
        // se intenta el siguiente endpoint (LAN -> Tailscale) en lugar de fallar.
        var esFalloDeProxy =
          (base === "/api" && response.status === 404) ||
          (response.status >= 502 && response.status <= 504);
        if (esFalloDeProxy && i < endpoints.length - 1) {
          lastError = new Error("Gateway HTTP " + response.status + " en " + base);
          continue;
        }
        return response;
      } catch (err) {
        lastError = err;
        // Continuar con el siguiente endpoint de respaldo si el actual falla
      }
    }
    throw (
      lastError ||
      new Error("No fue posible conectar con ningún servidor de la API.")
    );
  },

  /**
   * Consulta las posiciones GPS activas de los buses en SQL Server
   */
  obtenerGps: async function () {
    try {
      var response = await this.request("/obtener-gps", {
        method: "GET",
        cache: "no-store",
        timeout: 2500,
      });
      if (!response.ok) return [];
      var data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      return [];
    }
  },

  /**
   * Valida credenciales contra Active Directory (LDAP)
   */
  loginAdmin: async function (usuario, contrasena) {
    return await this.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: usuario, contrasena: contrasena }),
      timeout: 4500,
    });
  },

  /**
   * Envía la orden de corte de emergencia de telemetría (requiere token ADMIN)
   */
  corteEmergencia: async function (busId) {
    try {
      var targetId = busId || "bus_keisel_1";
      var headers = { "Content-Type": "application/json" };
      try {
        var token = sessionStorage.getItem("keisel_admin_token");
        if (token) headers["Authorization"] = "Bearer " + token;
      } catch (storageErr) {}

      var response = await this.request("/corte-emergencia", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ id: targetId }),
        timeout: 3000,
      });
      return response.ok;
    } catch (err) {
      console.warn("Error enviando corte de emergencia:", err);
      return false;
    }
  },

  /**
   * Lista los conductores sincronizados desde AD en KeiselDB (requiere token ADMIN)
   */
  obtenerConductoresAdmin: async function () {
    var headers = {};
    try {
      var token = sessionStorage.getItem("keisel_admin_token");
      if (token) headers["Authorization"] = "Bearer " + token;
    } catch (e) {}
    var response = await this.request("/admin/conductores", {
      method: "GET",
      headers: headers,
      cache: "no-store",
      timeout: 4500,
    });
    if (!response.ok) return null;
    return await response.json();
  },

  /**
   * Actualiza la asignación operativa (ruta, bus, placa, activo) de un conductor en KeiselDB
   */
  guardarConductorAdmin: async function (datos) {
    var headers = { "Content-Type": "application/json" };
    try {
      var token = sessionStorage.getItem("keisel_admin_token");
      if (token) headers["Authorization"] = "Bearer " + token;
    } catch (e) {}
    var response = await this.request("/admin/conductor", {
      method: "POST",
      headers: headers,
      body: JSON.stringify(datos),
      timeout: 4500,
    });
    return response.ok;
  },
};

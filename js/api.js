/**
 * Keisel - Cliente de Red y Servicios de API Desacoplados
 * Manejo de alta disponibilidad (failover automático LAN -> Tailscale -> Proxy Relativo)
 */
const KeiselAPI = {
  /**
   * Obtiene la lista ordenada de endpoints para tolerancia a fallos
   */
  getEndpoints: function () {
    return [
      typeof KeiselConfig !== "undefined" ? KeiselConfig.API_BASE_URL : "/api",
      typeof KeiselConfig !== "undefined"
        ? KeiselConfig.API_TAILSCALE_URL
        : "http://100.67.14.105:3000/api",
      "/api",
    ];
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
   * Envía la orden de corte de emergencia de telemetría
   */
  corteEmergencia: async function (busId) {
    try {
      var targetId = busId || "bus_keisel_1";
      var response = await this.request("/corte-emergencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: targetId }),
        timeout: 3000,
      });
      return response.ok;
    } catch (err) {
      console.warn("Error enviando corte de emergencia:", err);
      return false;
    }
  },
};

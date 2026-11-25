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
    try {
      var params = new URLSearchParams(window.location.search);
      var apiParam = params.get("api");
      if (apiParam && /^https?:\/\//i.test(apiParam)) {
        var limpia = apiParam.replace(/\/+$/, "");
        localStorage.setItem("keisel_api_tunnel", limpia);
        list.push(limpia);
      } else {
        var guardada = localStorage.getItem("keisel_api_tunnel");
        if (guardada && /^https?:\/\//i.test(guardada)) {
          list.push(guardada);
        }
      }
    } catch (e) {}
    var esPagesDev =
      typeof window !== "undefined" &&
      window.location &&
      /pages\.dev$/i.test(window.location.hostname || "");
    if (typeof KeiselConfig !== "undefined") {
      if (KeiselConfig.API_BASE_URL && !esPagesDev) list.push(KeiselConfig.API_BASE_URL);
      if (KeiselConfig.API_TUNNEL_URL) list.push(KeiselConfig.API_TUNNEL_URL);
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
      if (!response.ok) return null;
      var data = await response.json();
      return Array.isArray(data) ? data : null;
    } catch (err) {
      return null;
    }
  },

};

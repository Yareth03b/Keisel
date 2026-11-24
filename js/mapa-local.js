// Cartografía de respaldo servida por Keisel. El archivo local contiene geometrías de OpenStreetMap.
async function cargarMapaLocal(mapa) {
  var respuesta = await fetch("assets/mapas/barranca.json");
  if (!respuesta.ok) throw new Error("Cartografía local HTTP " + respuesta.status);
  var datos = await respuesta.json();
  var estilos = {
    agua: { relleno: "#acd5df" },
    parque: { relleno: "#cbe6ba" },
    campus: { relleno: "#fffbd8" },
    edificio: { relleno: "#ded9d4" },
    rio: { color: "#9ecdd9", ancho: 3 },
    calle: { color: "#ffffff", ancho: 4 },
    avenida: { color: "#f5cc8b", ancho: 6 },
  };
  var elementos = Object.keys(estilos).map(function (tipo) {
    return datos.features.filter(function (fila) { return fila[0] === tipo; }).map(function (fila) {
      var puntos = fila[2].map(function (par) { return mapa.project(par, 0); });
      return { tipo: tipo, nombre: fila[1], puntos: puntos, limites: L.bounds(puntos) };
    });
  }).flat();
  var lugares = datos.places.map(function (fila) {
    return { nombre: fila[0], punto: mapa.project(fila[1], 0) };
  });

  var capa = L.gridLayer({
    zIndex: 1,
    bounds: [[-10.828, -77.850], [-10.653, -77.688]],
    noWrap: true,
  });
  capa.createTile = function (tile) {
    var lienzo = document.createElement("canvas");
    var lado = this.getTileSize().x;
    lienzo.width = lienzo.height = lado;
    var ctx = lienzo.getContext("2d");
    var escala = Math.pow(2, tile.z);
    var origen = L.point(tile.x * lado, tile.y * lado);
    var limites = L.bounds(origen.subtract([48, 48]).divideBy(escala), origen.add([lado + 48, lado + 48]).divideBy(escala));
    ctx.fillStyle = "#eeeae5";
    ctx.fillRect(0, 0, lado, lado);
    ctx.lineCap = ctx.lineJoin = "round";
    var etiquetas = [];
    elementos.forEach(function (elemento) {
      if (!elemento.limites.intersects(limites)) return;
      var estilo = estilos[elemento.tipo];
      var puntos = elemento.puntos;
      ctx.beginPath();
      puntos.forEach(function (punto, i) {
        var x = punto.x * escala - origen.x;
        var y = punto.y * escala - origen.y;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      if (estilo.relleno) {
        ctx.fillStyle = estilo.relleno;
        ctx.fill();
      } else {
        ctx.strokeStyle = estilo.color;
        ctx.lineWidth = Math.max(1, Math.min(16, estilo.ancho * Math.pow(1.45, tile.z - 16)));
        ctx.stroke();
      }
      if (!elemento.nombre || tile.z < 16 || (elemento.tipo !== "avenida" && elemento.tipo !== "calle" && elemento.tipo !== "campus")) return;
      var candidato = elemento.limites.getSize().multiplyBy(escala);
      if (Math.max(candidato.x, candidato.y) < elemento.nombre.length * 7 + 32) return;
      etiquetas.push({ nombre: elemento.nombre, punto: puntos[Math.floor(puntos.length / 2)] });
    });
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.strokeStyle = "#faf8f3";
    ctx.lineWidth = 3;
    ctx.fillStyle = "#383532";
    var ocupados = [];
    var textos = tile.z < 16 ? lugares : etiquetas;
    textos.forEach(function (etiqueta) {
      var centro = etiqueta.punto.multiplyBy(escala).subtract(origen);
      var radio = ctx.measureText(etiqueta.nombre).width / 2 + 3;
      var caja = L.bounds(centro.subtract([radio, 10]), centro.add([radio, 5]));
      if (ocupados.some(function (otro) { return otro.intersects(caja); })) return;
      ocupados.push(caja);
      ctx.strokeText(etiqueta.nombre, centro.x, centro.y);
      ctx.fillText(etiqueta.nombre, centro.x, centro.y);
    });
    return lienzo;
  };
  capa.addTo(mapa);
}

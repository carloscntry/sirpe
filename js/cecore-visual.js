// ================= CECORE VISUAL INDEPENDIENTE =================
// Este archivo debe cargarse al final del index.html, después de map.js y heatmap-loader.js.
// Dibuja los CECORE directamente sobre el mapa Leaflet cuando el ámbito activo es Estado.

(function(){
  const CECORES = {
    "REGION 1": {nombre:"CECORE REGION 1", lat:20.168071, lon:-98.078960},
    "REGION 2": {nombre:"CECORE REGION 2", lat:19.8616700, lon:-98.0169652},
    "REGION 3": {nombre:"CECORE REGION 3", lat:19.826258, lon:-97.349342},
    "REGION 4": {nombre:"CECORE REGION 4", lat:19.278831, lon:-98.446680},
    "REGION 5": {nombre:"CECORE REGION 5", lat:19.03634600, lon:-98.19059700},
    "REGION 6": {nombre:"CECORE REGION 6", lat:18.989700, lon:-97.905805},
    "REGION 7": {nombre:"CECORE REGION 7", lat:19.009628, lon:-97.462171},
    "REGION 8": {nombre:"CECORE REGION 8", lat:18.885057, lon:-98.499458},
    "REGION 9": {nombre:"CECORE REGION 9", lat:18.233243, lon:-98.000000},
    "REGION 10": {nombre:"CECORE REGION 10", lat:18.479156, lon:-97.443413},
    "REGION 11": {nombre:"CECORE REGION 11", lat:18.378164, lon:-97.273977}
  };

  let cecoreLayer = null;
  let cecoreLabels = null;
  let cecoreLegend = null;

  function getState(){
    try{
      return Function("return typeof state !== 'undefined' ? state : null")();
    }catch(e){
      return null;
    }
  }

  function getMap(){
    const st = getState();
    return st && st.map ? st.map : null;
  }

  function isEstado(){
    const st = getState();
    const selector = document.getElementById("scopeSelector");
    const value = String(selector?.value || st?.currentScope || "").toLowerCase();
    const text = String(selector?.selectedOptions?.[0]?.textContent || "").toLowerCase();

    if(value.includes("estado") || value.includes("estatal")) return true;
    if(text.includes("estado") || text.includes("estatal")) return true;

    try{
      const sectors = st?.sectors || [];
      return sectors.some(f=>{
        const z = String(f?.properties?.zona || f?.properties?.REGION || f?.properties?.Name || "").toUpperCase();
        return z.includes("REGION");
      });
    }catch(e){
      return false;
    }
  }

  function removeLayer(map, layer){
    if(layer){
      try{ map.removeLayer(layer); }catch(e){}
    }
  }

  function removeLegend(map){
    if(cecoreLegend){
      try{ map.removeControl(cecoreLegend); }catch(e){}
      cecoreLegend = null;
    }
  }

  function clear(){
    const map = getMap();
    if(!map) return;
    removeLayer(map, cecoreLayer);
    removeLayer(map, cecoreLabels);
    removeLegend(map);
    cecoreLayer = null;
    cecoreLabels = null;
  }

  function addLegend(map){
    if(cecoreLegend) return;
    cecoreLegend = L.control({position:"topright"});
    cecoreLegend.onAdd = function(){
      const div = L.DomUtil.create("div", "sirpe-cecore-legend-final");
      div.style.background = "rgba(255,255,255,.97)";
      div.style.padding = "8px 10px";
      div.style.border = "1px solid #d5e0ea";
      div.style.borderRadius = "12px";
      div.style.boxShadow = "0 10px 24px rgba(15,35,58,.18)";
      div.style.fontSize = "12px";
      div.style.color = "#16324a";
      div.style.zIndex = "99999";
      div.innerHTML = '<b>CECORE</b><br><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#dc2626;border:2px solid #fff;box-shadow:0 0 0 1px #7f1d1d;margin-right:6px;vertical-align:middle;"></span> Centros Regionales';
      return div;
    };
    cecoreLegend.addTo(map);
  }

  function draw(){
    if(!window.L) return false;
    const map = getMap();
    if(!map) return false;

    clear();

    if(!isEstado()) return false;

    const circles = [];
    const labels = [];

    Object.entries(CECORES).forEach(([region, c])=>{
      const lat = Number(c.lat);
      const lon = Number(c.lon);
      if(!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const circle = L.circleMarker([lat, lon], {
        radius: 12,
        color: "#7f1d1d",
        weight: 3,
        fillColor: "#dc2626",
        fillOpacity: 1,
        opacity: 1
      });

      circle.bindPopup(
        "<b>" + c.nombre + "</b><br>" +
        "Región: <b>" + region + "</b><br>" +
        "Latitud: " + lat.toFixed(6) + "<br>" +
        "Longitud: " + lon.toFixed(6) + "<br>" +
        '<a href="https://www.google.com/maps?q=' + lat + ',' + lon + '" target="_blank">Abrir en Google Maps</a>'
      );

      const label = L.marker([lat, lon], {
        interactive:false,
        zIndexOffset: 50000,
        icon: L.divIcon({
          className: "sirpe-cecore-label-final",
          html: '<div style="background:#fff;color:#7f1d1d;border:1px solid #fecaca;border-radius:8px;padding:2px 6px;font-size:11px;font-weight:900;box-shadow:0 4px 10px rgba(0,0,0,.22);white-space:nowrap;">' + region + "</div>",
          iconSize: null,
          iconAnchor: [-14, 30]
        })
      });

      circles.push(circle);
      labels.push(label);
    });

    cecoreLayer = L.layerGroup(circles).addTo(map);
    cecoreLabels = L.layerGroup(labels).addTo(map);

    try{
      cecoreLayer.eachLayer(l=>{ if(l.bringToFront) l.bringToFront(); });
      cecoreLabels.eachLayer(l=>{ if(l.setZIndexOffset) l.setZIndexOffset(50000); });
    }catch(e){}

    addLegend(map);

    console.info("CECORE visual independiente dibujado:", circles.length);
    return circles.length > 0;
  }

  window.renderCecoresVisualFinal = draw;

  function schedule(){
    setTimeout(draw, 100);
    setTimeout(draw, 700);
    setTimeout(draw, 1500);
    setTimeout(draw, 3000);
  }

  window.addEventListener("DOMContentLoaded", ()=>{
    const selector = document.getElementById("scopeSelector");
    if(selector){
      selector.addEventListener("change", schedule);
    }
    schedule();
  });

  setInterval(()=>{
    if(isEstado() && !cecoreLayer){
      draw();
    }
  }, 2500);
})();

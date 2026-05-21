// ================= CECORE VISUAL LIMPIO DEFINITIVO =================
// Dibuja CECORE pequeños y elimina automáticamente cualquier leyenda CECORE duplicada.

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

  function removeOldCecoreVisuals(){
    const map = getMap();
    const st = getState();

    if(map && st){
      if(st.cecoreLayer){
        try{ map.removeLayer(st.cecoreLayer); }catch(e){}
        st.cecoreLayer = null;
      }

      if(st.cecoreLabelLayer){
        try{ map.removeLayer(st.cecoreLabelLayer); }catch(e){}
        st.cecoreLabelLayer = null;
      }

      if(st.cecoreLegend){
        try{ map.removeControl(st.cecoreLegend); }catch(e){}
        st.cecoreLegend = null;
      }
    }

    if(map && cecoreLayer){
      try{ map.removeLayer(cecoreLayer); }catch(e){}
      cecoreLayer = null;
    }

    if(map && cecoreLegend){
      try{ map.removeControl(cecoreLegend); }catch(e){}
      cecoreLegend = null;
    }

    // Borra leyendas CECORE duplicadas creadas por parches anteriores.
    document.querySelectorAll(".leaflet-control").forEach(ctrl=>{
      const txt = (ctrl.textContent || "").toUpperCase().replace(/\s+/g, " ").trim();

      const isOldCecore =
        txt === "CECORE CENTRO REGIONAL" ||
        txt.includes("CECORE CENTRO REGIONAL") ||
        (
          txt.includes("CECORE") &&
          !txt.includes("CENTRO DE COORDINACIÓN REGIONAL") &&
          !txt.includes("CENTRO DE COORDINACION REGIONAL")
        );

      if(isOldCecore){
        ctrl.remove();
      }
    });

    // Borra etiquetas antiguas de regiones si alguna quedó suelta.
    document.querySelectorAll(
      ".sirpe-cecore-text-label, .sirpe-cecore-final-label, .sirpe-cecore-label-final, .sirpe-cecore-icon, .cecore-marker, .sirpe-cecore-marker"
    ).forEach(el=>{
      const marker = el.closest(".leaflet-marker-icon");
      if(marker) marker.remove();
      else el.remove();
    });
  }

  function addLegend(map){
    cecoreLegend = L.control({position:"topright"});

    cecoreLegend.onAdd = function(){
      const div = L.DomUtil.create("div", "sirpe-cecore-main-legend");

      div.style.background = "rgba(255,255,255,.97)";
      div.style.padding = "8px 10px";
      div.style.border = "1px solid #d5e0ea";
      div.style.borderRadius = "12px";
      div.style.boxShadow = "0 10px 24px rgba(15,35,58,.18)";
      div.style.fontSize = "12px";
      div.style.color = "#16324a";

      div.innerHTML =
        '<b>Centro de Coordinación Regional</b><br>' +
        '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#dc2626;border:2px solid #fff;box-shadow:0 0 0 1px #7f1d1d;margin-right:6px;vertical-align:middle;"></span>' +
        'CECORE';

      return div;
    };

    cecoreLegend.addTo(map);

    const st = getState();
    if(st) st.cecoreLegend = cecoreLegend;
  }

  function draw(){
    if(!window.L) return false;

    const map = getMap();
    if(!map) return false;

    removeOldCecoreVisuals();

    if(!isEstado()) return false;

    const circles = [];

    Object.entries(CECORES).forEach(([region, c])=>{
      const lat = Number(c.lat);
      const lon = Number(c.lon);

      if(!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const circle = L.circleMarker([lat, lon], {
        radius: 4,
        color: "#7f1d1d",
        weight: 1.5,
        fillColor: "#dc2626",
        fillOpacity: 0.95,
        opacity: 1
      });

      circle.bindPopup(
        "<b>" + c.nombre + "</b><br>" +
        "Región: <b>" + region + "</b><br>" +
        "Latitud: " + lat.toFixed(6) + "<br>" +
        "Longitud: " + lon.toFixed(6)
      );

      circles.push(circle);
    });

    cecoreLayer = L.layerGroup(circles).addTo(map);

    const st = getState();
    if(st){
      st.cecoreLayer = cecoreLayer;
      st.cecoreLabelLayer = null;
    }

    addLegend(map);
    removeOldCecoreVisuals();
    addLegend(map);

    return true;
  }

  function cleanupDuplicatesOnly(){
    document.querySelectorAll(".leaflet-control").forEach(ctrl=>{
      const txt = (ctrl.textContent || "").toUpperCase().replace(/\s+/g, " ").trim();

      if(
        txt === "CECORE CENTRO REGIONAL" ||
        txt.includes("CECORE CENTRO REGIONAL") ||
        (
          txt.includes("CECORE") &&
          !txt.includes("CENTRO DE COORDINACIÓN REGIONAL") &&
          !txt.includes("CENTRO DE COORDINACION REGIONAL")
        )
      ){
        ctrl.remove();
      }
    });

    const allMain = [...document.querySelectorAll(".leaflet-control")]
      .filter(ctrl=>{
        const txt = (ctrl.textContent || "").toUpperCase();
        return txt.includes("CENTRO DE COORDINACIÓN REGIONAL") || txt.includes("CENTRO DE COORDINACION REGIONAL");
      });

    allMain.slice(1).forEach(x=>x.remove());
  }

  function schedule(){
    setTimeout(draw, 100);
    setTimeout(draw, 700);
    setTimeout(draw, 1500);
    setTimeout(cleanupDuplicatesOnly, 2200);
  }

  window.renderCecoresVisualFinal = draw;
  window.renderCecoresOnStateMap = draw;

  window.addEventListener("DOMContentLoaded", ()=>{
    const selector = document.getElementById("scopeSelector");

    if(selector){
      selector.addEventListener("change", schedule);
    }

    schedule();
  });

  if(typeof window.drawMap === "function" && !window.__cecoreNoDuplicateWrapped){
    window.__cecoreNoDuplicateWrapped = true;
    const oldDrawMap = window.drawMap;

    window.drawMap = function(){
      const result = oldDrawMap.apply(this, arguments);
      schedule();
      return result;
    };
  }

  setInterval(()=>{
    if(isEstado()){
      cleanupDuplicatesOnly();
    }
  }, 500);

  setInterval(()=>{
    if(isEstado()){
      draw();
    }else{
      removeOldCecoreVisuals();
    }
  }, 4000);
})();

// ================= CECORE VISUAL FINAL LIMPIO =================
// Limpia capas/leyendas CECORE anteriores y dibuja símbolos pequeños sin etiquetas duplicadas.

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

  let cleanCecoreLayer = null;
  let cleanCecoreLegend = null;

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

  function removeKnownCecoreLayers(){
    const st = getState();
    const map = getMap();
    if(!map) return;

    const keys = [
      "cecoreLayer",
      "cecoreLabelLayer",
      "cecoreLegend"
    ];

    keys.forEach(k=>{
      if(st && st[k]){
        try{
          if(k.toLowerCase().includes("legend")) map.removeControl(st[k]);
          else map.removeLayer(st[k]);
        }catch(e){}
        st[k] = null;
      }
    });

    if(cleanCecoreLayer){
      try{ map.removeLayer(cleanCecoreLayer); }catch(e){}
      cleanCecoreLayer = null;
    }

    if(cleanCecoreLegend){
      try{ map.removeControl(cleanCecoreLegend); }catch(e){}
      cleanCecoreLegend = null;
    }

    // Quita leyendas DOM duplicadas creadas por parches anteriores.
    document.querySelectorAll(
      ".sirpe-cecore-visible-legend, .sirpe-cecore-final-legend, .sirpe-cecore-legend-final, .cecore-legend, .sirpe-cecore-visible-legend"
    ).forEach(el=>{
      const parent = el.closest(".leaflet-control");
      if(parent) parent.remove();
      else el.remove();
    });

    // Quita etiquetas REGION creadas por parches anteriores, si quedaron como divIcon.
    document.querySelectorAll(
      ".sirpe-cecore-text-label, .sirpe-cecore-final-label, .sirpe-cecore-label-final"
    ).forEach(el=>{
      const icon = el.closest(".leaflet-marker-icon");
      if(icon) icon.remove();
      else el.remove();
    });

    // Quita iconos pin antiguos creados por parches anteriores.
    document.querySelectorAll(
      ".sirpe-cecore-icon, .cecore-marker, .sirpe-cecore-marker"
    ).forEach(el=>{
      const icon = el.closest(".leaflet-marker-icon");
      if(icon) icon.remove();
      else el.remove();
    });
  }

  function addLegend(map){
    cleanCecoreLegend = L.control({position:"topright"});

    cleanCecoreLegend.onAdd = function(){
      const div = L.DomUtil.create("div", "sirpe-cecore-clean-legend");

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

    cleanCecoreLegend.addTo(map);
  }

  function draw(){
    if(!window.L) return false;

    const map = getMap();
    if(!map) return false;

    removeKnownCecoreLayers();

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

    cleanCecoreLayer = L.layerGroup(circles).addTo(map);

    // también guarda referencia en state para evitar que otros procesos de limpieza la ignoren
    const st = getState();
    if(st){
      st.cecoreLayer = cleanCecoreLayer;
      st.cecoreLabelLayer = null;
      st.cecoreLegend = cleanCecoreLegend;
    }

    addLegend(map);

    return true;
  }

  function schedule(){
    setTimeout(draw, 100);
    setTimeout(draw, 700);
    setTimeout(draw, 1500);
    setTimeout(draw, 3000);
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

  // Reaplica después de redibujos del mapa.
  if(typeof window.drawMap === "function" && !window.__cecoreCleanDrawWrapped){
    window.__cecoreCleanDrawWrapped = true;
    const oldDrawMap = window.drawMap;
    window.drawMap = function(){
      const result = oldDrawMap.apply(this, arguments);
      schedule();
      return result;
    };
  }

  setInterval(()=>{
    if(isEstado()){
      draw();
    }else{
      removeKnownCecoreLayers();
    }
  }, 3500);
})();

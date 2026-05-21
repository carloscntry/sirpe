
// ================= CECORE MAP VISUALIZATION =================
const CECORE_VISUAL_POINTS = {
  "REGION 1": {lat:20.168071, lon:-98.078960, nombre:"CECORE REGION 1"},
  "REGION 2": {lat:19.8616700, lon:-98.0169652, nombre:"CECORE REGION 2"},
  "REGION 3": {lat:19.826258, lon:-97.349342, nombre:"CECORE REGION 3"},
  "REGION 4": {lat:19.278831, lon:-98.446680, nombre:"CECORE REGION 4"},
  "REGION 5": {lat:19.03634600, lon:-98.19059700, nombre:"CECORE REGION 5"},
  "REGION 6": {lat:18.989700, lon:-97.905805, nombre:"CECORE REGION 6"},
  "REGION 7": {lat:19.009628, lon:-97.462171, nombre:"CECORE REGION 7"},
  "REGION 8": {lat:18.885057, lon:-98.499458, nombre:"CECORE REGION 8"},
  "REGION 9": {lat:18.233243, lon:-98.0, nombre:"CECORE REGION 9"},
  "REGION 10": {lat:18.479156, lon:-97.443413, nombre:"CECORE REGION 10"},
  "REGION 11": {lat:18.378164, lon:-97.273977, nombre:"CECORE REGION 11"}
};

function getCurrentScopeValue(){
  return document.getElementById('scopeSelector')?.value || state?.currentScope || 'municipio';
}

function renderCecoresOnStateMap(){
  if(!state.map) return;
  const scope = getCurrentScopeValue();

  if(state.cecoreLayer){
    try{ state.map.removeLayer(state.cecoreLayer); }catch(e){}
    state.cecoreLayer = null;
  }
  if(state.cecoreLegend){
    try{ state.map.removeControl(state.cecoreLegend); }catch(e){}
    state.cecoreLegend = null;
  }

  if(scope !== 'estado') return;

  const features = Object.entries(CECORE_VISUAL_POINTS).map(([region, c])=>({
    type:'Feature',
    properties:{ region, nombre:c.nombre, lat:c.lat, lon:c.lon },
    geometry:{ type:'Point', coordinates:[c.lon, c.lat] }
  }));

  state.cecoreLayer = L.geoJSON({type:'FeatureCollection', features}, {
    pointToLayer:(feature, latlng)=>{
      return L.marker(latlng, {
        zIndexOffset: 10000,
        icon: L.divIcon({
          className:'sirpe-cecore-marker',
          html:`<div style="
            width:24px;height:24px;border-radius:50% 50% 50% 0;
            background:#dc2626;border:3px solid #ffffff;
            transform:rotate(-45deg);
            box-shadow:0 6px 16px rgba(0,0,0,.35);">
            <span style="
              position:absolute;left:50%;top:50%;
              width:8px;height:8px;border-radius:50%;
              background:#ffffff;transform:translate(-50%,-50%);"></span>
          </div>`,
          iconSize:[30,30],
          iconAnchor:[15,30],
          popupAnchor:[0,-28]
        })
      });
    },
    onEachFeature:(feature, layer)=>{
      const p = feature.properties;
      layer.bindPopup(`
        <b>${p.nombre}</b><br>
        Región: <b>${p.region}</b><br>
        Latitud: ${Number(p.lat).toFixed(6)}<br>
        Longitud: ${Number(p.lon).toFixed(6)}<br>
        <a href="https://www.google.com/maps?q=${p.lat},${p.lon}" target="_blank">Abrir en Google Maps</a>
      `);
      layer.bindTooltip(p.nombre, {direction:'top'});
    }
  }).addTo(state.map);

  const legend = L.control({position:'topright'});
  legend.onAdd = function(){
    const div = L.DomUtil.create('div','sirpe-cecore-legend');
    div.style.background='rgba(255,255,255,.96)';
    div.style.padding='8px 10px';
    div.style.border='1px solid #d5e0ea';
    div.style.borderRadius='12px';
    div.style.boxShadow='0 10px 24px rgba(15,35,58,.14)';
    div.style.fontSize='12px';
    div.style.color='#16324a';
    div.innerHTML='<b>CECORE</b><br><span style="color:#dc2626;font-size:18px;">●</span> Centros de Coordinación Regional';
    return div;
  };
  legend.addTo(state.map);
  state.cecoreLegend = legend;
}
window.renderCecoresOnStateMap = renderCecoresOnStateMap;


// ================= MAP =================

function isEstadoScopeActive(){
  const scope = document.getElementById('scopeSelector')?.value || state?.currentScope || 'municipio';
  return scope === 'estado';
}

function buildCecoreFeatures(){
  if(typeof ESTADO_CECORES === 'undefined' || !ESTADO_CECORES) return [];
  return Object.entries(ESTADO_CECORES).map(([region, c])=>({
    type:'Feature',
    properties:{
      region,
      nombre:c.nombre || `CECORE ${region}`,
      tipo:'CECORE',
      lat:Number(c.lat),
      lon:Number(c.lon)
    },
    geometry:{
      type:'Point',
      coordinates:[Number(c.lon), Number(c.lat)]
    }
  })).filter(f=>Number.isFinite(f.properties.lat) && Number.isFinite(f.properties.lon));
}

function addCecoreLayerToMap(){
  if(!state.map || !isEstadoScopeActive()) return;
  if(state.cecoreLayer){
    try{ state.map.removeLayer(state.cecoreLayer); }catch(e){}
    state.cecoreLayer = null;
  }

  const features = buildCecoreFeatures();
  if(!features.length) return;

  state.cecoreLayer = L.geoJSON(
    {type:'FeatureCollection', features},
    {
      pointToLayer:(f, latlng)=>{
        return L.marker(latlng, {
          icon: L.divIcon({
            className:'cecore-marker',
            html:`<div style="
              width:22px;height:22px;border-radius:50% 50% 50% 0;
              background:#dc2626;border:3px solid #fff;
              transform:rotate(-45deg);
              box-shadow:0 4px 12px rgba(0,0,0,.28);
              position:relative;">
              <span style="
                position:absolute;left:50%;top:50%;
                width:7px;height:7px;border-radius:50%;
                background:#fff;transform:translate(-50%,-50%);"></span>
            </div>`,
            iconSize:[28,28],
            iconAnchor:[14,28],
            popupAnchor:[0,-24]
          })
        });
      },
      onEachFeature:(f,l)=>{
        const p=f.properties || {};
        l.bindPopup(`
          <b>${p.nombre}</b><br>
          Región: <b>${p.region}</b><br>
          Latitud: ${Number(p.lat).toFixed(6)}<br>
          Longitud: ${Number(p.lon).toFixed(6)}<br>
          <a href="https://www.google.com/maps?q=${p.lat},${p.lon}" target="_blank">Abrir en Google Maps</a>
        `);
        l.bindTooltip(`${p.nombre}`, {permanent:false, direction:'top'});
      }
    }
  ).addTo(state.map);
}

function addCecoreLegend(){
  if(!state.map || !isEstadoScopeActive()) return;
  if(state.cecoreLegend){
    try{ state.map.removeControl(state.cecoreLegend); }catch(e){}
    state.cecoreLegend = null;
  }
  const legend = L.control({position:'topleft'});
  legend.onAdd = function(){
    const div = L.DomUtil.create('div', 'info cecore-legend');
    div.style.background = 'rgba(255,255,255,.96)';
    div.style.border = '1px solid #d5e0ea';
    div.style.borderRadius = '12px';
    div.style.padding = '8px 10px';
    div.style.boxShadow = '0 10px 24px rgba(15,35,58,.10)';
    div.style.fontFamily = "'Noto Sans', sans-serif";
    div.style.fontSize = '12px';
    div.style.color = '#16324a';
    div.innerHTML = `<b>CECORE</b><br><span style="color:#dc2626;font-size:18px;vertical-align:middle;">●</span> Centros de Coordinación Regional`;
    return div;
  };
  legend.addTo(state.map);
  state.cecoreLegend = legend;
}



function renderScopePreview(features, scope='municipio'){
  if(!state.map || !Array.isArray(features) || !features.length) return;
  clearLayers();
  const color = scope==='estado' ? '#0f766e' : '#1e5b94';
  state.scopePreviewLayer = L.geoJSON(
    {type:'FeatureCollection', features},
    {
      style:()=>({color, weight:2.4, fillColor:color, fillOpacity:0.08, opacity:0.95}),
      onEachFeature:(f,l)=>{
        const zona = f.properties?.zona || f.properties?.name || f.properties?.nombre || 'Zona';
        l.bindPopup(`<b>${zona}</b><br><span class="muted">Ámbito: ${scope==='estado' ? 'Estado de Puebla' : 'Municipio de Puebla'}</span>`);
      }
    }
  ).addTo(state.map);
  if(scope==='estado'){
    addCecoreLayerToMap();
    addCecoreLegend();
  }
  try{
    const bounds = state.scopePreviewLayer.getBounds();
    if(bounds.isValid()) state.map.fitBounds(bounds.pad(0.03));
  }catch(e){}
}

function zoneOperationalStateMap(){
  const risk = {'Crítica':4,'Critica':4,'Atención':3,'Atencion':3,'Óptima':2,'Optima':2,'Punto fijo':1};
  const bucket = {};
  (state.summary || []).forEach(r=>{
    const zona = normalizeZoneName(r?.zona);
    if(!zona) return;
    const estado = r?.estado || 'Óptima';
    const score = risk[estado] || 0;
    if(!bucket[zona] || score > bucket[zona].score){
      bucket[zona] = { estado, score, data:r };
    }
  });
  return bucket;
}

function getZoneOperationalState(zona){
  const m = zoneOperationalStateMap();
  return m[normalizeZoneName(zona)] || null;
}

function getZoneStatusColor(estado){
  if(estado === 'Crítica' || estado === 'Critica') return '#dc2626';
  if(estado === 'Atención' || estado === 'Atencion') return '#f59e0b';
  if(estado === 'Punto fijo') return '#2563eb';
  if(estado === 'Óptima' || estado === 'Optima') return '#16a34a';
  return '#64748b';
}

function buildZonePopup(zona){
  const info = getZoneOperationalState(zona);
  if(!info){
    return `<b>${displayZoneName(normalizeZoneName(zona))}</b><br><span class="muted">Sin estado consolidado</span>`;
  }
  const r = info.data || {};
  return `<b>${displayZoneName(normalizeZoneName(zona))}</b><br>Estado: <b>${info.estado}</b><br>Unidad: ${r.unidad_a_emplear || r.unidad || 'N/D'}<br>Eventos: ${r.eventos_cubiertos ?? 'N/D'}<br>Tiempo: ${r.tiempo_total_min ?? 'N/D'} min`;
}

function addZoneStatusLegend(){
  if(!state.map) return;
  if(state.zoneStatusLegend){
    try{ state.map.removeControl(state.zoneStatusLegend); }catch(e){}
    state.zoneStatusLegend = null;
  }
  const legend = L.control({position:'bottomright'});
  legend.onAdd = function(){
    const div = L.DomUtil.create('div', 'info legend');
    div.style.background = 'rgba(255,255,255,.96)';
    div.style.border = '1px solid #d5e0ea';
    div.style.borderRadius = '12px';
    div.style.padding = '10px 12px';
    div.style.boxShadow = '0 10px 24px rgba(15,35,58,.10)';
    div.style.fontFamily = "'Noto Sans', sans-serif";
    div.style.fontSize = '12px';
    div.style.color = '#16324a';
    div.innerHTML = `
      <div style="font-weight:800; letter-spacing:.04em; text-transform:uppercase; color:#61758a; margin-bottom:8px;">Semáforo operativo</div>
      <div style="display:grid; gap:6px;">
        <div><span style="display:inline-block;width:12px;height:12px;border-radius:4px;background:#dc2626;margin-right:8px;"></span>Crítica</div>
        <div><span style="display:inline-block;width:12px;height:12px;border-radius:4px;background:#f59e0b;margin-right:8px;"></span>Atención</div>
        <div><span style="display:inline-block;width:12px;height:12px;border-radius:4px;background:#16a34a;margin-right:8px;"></span>Óptima</div>
        <div><span style="display:inline-block;width:12px;height:12px;border-radius:4px;background:#2563eb;margin-right:8px;"></span>Punto fijo</div>
      </div>
    `;
    return div;
  };
  legend.addTo(state.map);
  state.zoneStatusLegend = legend;
}


function drawMap(){
  clearLayers();
  state.sectorLayer=L.geoJSON(
    {type:'FeatureCollection',features:state.sectors},
    {
      style:f=>{
        const zona = normalizeZoneName(f.properties?.zona);
        const zoneState = getZoneOperationalState(zona);
        const color = zoneState ? getZoneStatusColor(zoneState.estado) : getZoneColor(zona);
        return {color, fillColor:color, weight:2.4, fillOpacity:0.18, opacity:0.95};
      },
      onEachFeature:(f,l)=>{
        const zona = normalizeZoneName(f.properties?.zona);
        l.bindPopup(buildZonePopup(zona));
      }
    }
  ).addTo(state.map);

  if(isEstadoScopeActive()){
    addCecoreLayerToMap();
    addCecoreLegend();
  }

  if(state.vectors && state.vectors.length){
    state.vectorLayer=L.geoJSON(
      {type:'FeatureCollection',features:state.vectors},
      {
        style:f=>{
          const zona = normalizeZoneName(f.properties?.zona || f.properties?.ZONA || f.properties?.Name);
          const zoneState = getZoneOperationalState(zona);
          const color = zoneState ? getZoneStatusColor(zoneState.estado) : getZoneColor(zona);
          return {color,weight:1.5,fillColor:color,dashArray:'4 4',fillOpacity:0.04,opacity:0.75};
        },
        onEachFeature:(f,l)=>{
          const zona = normalizeZoneName(f.properties?.zona || f.properties?.ZONA || f.properties?.Name || '');
          l.bindPopup(`<b>${f.properties?.vector_name || f.properties?.Name || 'Vector'}</b><br>${displayZoneName(zona)}<br>${buildZonePopup(zona).split('<br>').slice(1).join('<br>')}`);
        }
      }
    ).addTo(state.map);
  }

  const hotFeatures=state.hotspots.map(h=>({type:'Feature',properties:h,geometry:{type:'Point',coordinates:[h.lon,h.lat]}}));
  state.hotspotLayer=L.geoJSON(
    {type:'FeatureCollection',features:hotFeatures},
    {
      pointToLayer:(f,latlng)=>L.circleMarker(
        latlng,
        {radius:5+Math.min(14,f.properties.probabilidad*70),color:getZoneColor(f.properties.zona),fillColor:getZoneColor(f.properties.zona),fillOpacity:0.55,weight:1}
      ).bindPopup(`<b>${f.properties.nombre}</b><br>Zona ${displayZoneName(f.properties.zona)}<br>${f.properties.turno}<br>Eventos: ${f.properties.eventos}<br>Prob: ${f.properties.probabilidad.toFixed(3)}`)
    }
  ).addTo(state.map);

  const routeFeatures=state.routes.filter(r=>Array.isArray(r.points)&&r.points.length>=2).map(r=>({type:'Feature',properties:r,geometry:{type:'LineString',coordinates:r.points.map(p=>[p.lon,p.lat])}}));
  state.routeLayer=L.geoJSON(
    {type:'FeatureCollection',features:routeFeatures},
    {style:f=>({color:turnoColor(f.properties.turno),weight:4,opacity:0.85}),onEachFeature:(f,l)=>l.bindPopup(`<b>${f.properties.unidad}</b><br>Zona ${displayZoneName(f.properties.zona)}<br>${f.properties.turno}<br>Distancia: ${f.properties.distancia_km} km<br>Tiempo: ${f.properties.tiempo_total_min} min`) }
  ).addTo(state.map);

  const markers=[];
  state.routes.forEach(r=>{
    if(!r.points.length) return;
    const ini=r.points[0], fin=r.points[r.points.length-1];
    const inicioTipo=ini.cecore ? 'CECORE INICIO' : 'INICIO';
    const finTipo=fin.cecore ? 'CECORE FIN' : 'FIN';
    markers.push({type:'Feature',properties:{unidad:r.unidad,tipo:inicioTipo,nombre:ini.nombre},geometry:{type:'Point',coordinates:[ini.lon,ini.lat]}});
    markers.push({type:'Feature',properties:{unidad:r.unidad,tipo:finTipo,nombre:fin.nombre},geometry:{type:'Point',coordinates:[fin.lon,fin.lat]}});
  });
  state.markerLayer=L.geoJSON(
    {type:'FeatureCollection',features:markers},
    {pointToLayer:(f,latlng)=>{ const isStart=String(f.properties.tipo).includes('INICIO'); const isCecore=String(f.properties.tipo).includes('CECORE'); const color=isCecore?'#2563eb':(isStart?'#0f9d58':'#b45309'); return L.circleMarker(latlng,{radius:isCecore?9:7,color,fillColor:color,fillOpacity:.85,weight:2}).bindTooltip(`${f.properties.tipo} - ${f.properties.unidad}`); }}
  ).addTo(state.map);

  const layers=[state.sectorLayer,state.hotspotLayer,state.routeLayer,state.markerLayer];
  if(state.cecoreLayer) layers.push(state.cecoreLayer);
  if(state.vectorLayer) layers.push(state.vectorLayer);
  const all=L.featureGroup(layers);
  if(all.getLayers().length) state.map.fitBounds(all.getBounds().pad(0.05));

  addZoneStatusLegend();
}

function featureVerticesKmDistance(point, feature){
  let maxKm = 0;
  try{
    const coords = turf.coordAll(feature);
    coords.forEach(c=>{
      const d = haversineKm(point.geometry.coordinates[1], point.geometry.coordinates[0], c[1], c[0]);
      if(d > maxKm) maxKm = d;
    });
  }catch(e){}
  return maxKm;
}

function buildVoronoiPrepositioning(sectors, incidents, resources){
  const posts = [], cells = [];
  const basePostsInput = Math.max(1, toSafeInt(document.getElementById('voronoiBasePosts')?.value || 1, 1));
  const maxPostsInput = Math.max(basePostsInput, toSafeInt(document.getElementById('voronoiMaxPosts')?.value || 3, 3));
  const unitsPerPost = Math.max(1, toSafeInt(document.getElementById('voronoiUnitsPerPost')?.value || 3, 3));
  const speed = Math.max(5, Number(document.getElementById('voronoiSpeed')?.value || 30) || 30);
  const vectors = state.vectors || [];

  const routeUnitsByZone = {};
  (state.summary || []).forEach(r=>{
    const zona = normalizeZoneName(r?.zona);
    if(!zona) return;
    const unidad = r?.unidad_a_emplear || r?.unidad;
    if(!routeUnitsByZone[zona]) routeUnitsByZone[zona] = new Set();
    if(unidad) routeUnitsByZone[zona].add(String(unidad));
  });
  // fallback si summary aún no trae unidades
  if(!Object.keys(routeUnitsByZone).length && Array.isArray(state.routes)){
    (state.routes || []).forEach(r=>{
      const zona = normalizeZoneName(r?.zona);
      if(!zona) return;
      if(!routeUnitsByZone[zona]) routeUnitsByZone[zona] = new Set();
      if(r?.unidad) routeUnitsByZone[zona].add(String(r.unidad));
    });
  }

  (sectors || []).forEach((sector, idx)=>{
    const zona = normalizeZoneName(sector.properties?.zona || sector.properties?.ZONA || sector.properties?.Name) || `SECTOR ${idx+1}`;
    const incidentsZone = (incidents||[]).filter(i=> normalizeZoneName(i.zona) === zona);
    const vectorsZone = vectors.filter(v=> normalizeZoneName(v.properties?.zona || v.properties?.ZONA || v.properties?.Name) === zona);

    const totalUnits = toSafeInt(resources?.[zona]?.unidades, 0);
    const routeUnitsUsed = routeUnitsByZone[zona] ? routeUnitsByZone[zona].size : 0;
    const availableForStatic = Math.max(0, totalUnits - routeUnitsUsed);

    // Si no quedan unidades remanentes, no se generan puestos fijos.
    if(availableForStatic <= 0){
      return;
    }

    // Número de puestos limitado por las unidades remanentes.
    const basePosts = Math.min(availableForStatic, basePostsInput);
    const maxPosts = Math.min(availableForStatic, maxPostsInput);
    let nPosts = Math.min(maxPosts, Math.max(basePosts, Math.ceil(availableForStatic / unitsPerPost)));
    nPosts = Math.max(1, nPosts);

    let seedFeatures = [];
    incidentsZone.slice(0, nPosts * 3).forEach(inc=>{
      seedFeatures.push(turf.point([inc.lon, inc.lat], {seed_type:'incidente'}));
    });
    vectorsZone.forEach(v=>{
      try{
        seedFeatures.push(turf.pointOnFeature(v, {seed_type:'vector'}));
      }catch(e){}
    });
    if(!seedFeatures.length){
      try{ seedFeatures.push(turf.pointOnFeature(sector, {seed_type:'centro'})); }catch(e){}
    }

    const randomNeeded = Math.max(0, nPosts - seedFeatures.length);
    if(randomNeeded > 0){
      try{
        const randomPts = turf.randomPoint(randomNeeded * 6, {bbox: turf.bbox(sector)}).features.filter(p=> pointInFeature(p, sector)).slice(0, randomNeeded);
        seedFeatures = seedFeatures.concat(randomPts);
      }catch(e){}
    }
    if(seedFeatures.length < nPosts){
      while(seedFeatures.length < nPosts){
        try{ seedFeatures.push(turf.pointOnFeature(sector, {seed_type:'fallback'})); }catch(e){ break; }
      }
    }
    seedFeatures = seedFeatures.slice(0, nPosts);

    const unitAllocation = Array.from({length:nPosts}, (_,i)=> Math.floor(availableForStatic / nPosts) + (i < (availableForStatic % nPosts) ? 1 : 0));

    if(seedFeatures.length === 1){
      const p = seedFeatures[0];
      const coverageKm = featureVerticesKmDistance(p, sector);
      const eta = Number(((coverageKm / speed) * 60).toFixed(1));
      posts.push({
        zona,
        post_id:`${displayZoneName(zona)}-P1`,
        lon:p.geometry.coordinates[0],
        lat:p.geometry.coordinates[1],
        coverage_km:Number(coverageKm.toFixed(2)),
        eta_max_min:eta,
        unidades_sugeridas:unitAllocation[0] || 0,
        unidades_totales_zona:totalUnits,
        unidades_ruta:routeUnitsUsed,
        unidades_disponibles_fijas:availableForStatic
      });
      cells.push({zona, post_id:`${displayZoneName(zona)}-P1`, eta_max_min:eta, geometry: sector.geometry});
      return;
    }

    try{
      const fc = turf.featureCollection(seedFeatures);
      const bbox = turf.bbox(sector);
      const vor = turf.voronoi(fc, {bbox});
      if(vor?.features?.length){
        seedFeatures.forEach((seed, i)=>{
          let cell = null;
          for(const candidate of vor.features){
            if(!candidate) continue;
            try{
              if(pointInFeature(seed, candidate)){ cell = candidate; break; }
            }catch(e){}
          }
          if(!cell) return;
          let clipped = null;
          try{ clipped = turf.intersect(cell, sector); }catch(e){ clipped = null; }
          if(!clipped) clipped = cell;
          let pt = null;
          try{ pt = turf.pointOnFeature(clipped); }catch(e){ pt = seed; }
          const coverageKm = featureVerticesKmDistance(pt, clipped);
          const eta = Number(((coverageKm / speed) * 60).toFixed(1));
          const postId = `${displayZoneName(zona)}-P${i+1}`;
          posts.push({
            zona,
            post_id:postId,
            lon:pt.geometry.coordinates[0],
            lat:pt.geometry.coordinates[1],
            coverage_km:Number(coverageKm.toFixed(2)),
            eta_max_min:eta,
            unidades_sugeridas:unitAllocation[i] || 0,
            unidades_totales_zona:totalUnits,
            unidades_ruta:routeUnitsUsed,
            unidades_disponibles_fijas:availableForStatic
          });
          cells.push({zona, post_id:postId, eta_max_min:eta, geometry: clipped.geometry});
        });
      }
    }catch(e){
      seedFeatures.forEach((seed, i)=>{
        const coverageKm = featureVerticesKmDistance(seed, sector);
        const eta = Number(((coverageKm / speed) * 60).toFixed(1));
        const postId = `${displayZoneName(zona)}-P${i+1}`;
        posts.push({
          zona,
          post_id:postId,
          lon:seed.geometry.coordinates[0],
          lat:seed.geometry.coordinates[1],
          coverage_km:Number(coverageKm.toFixed(2)),
          eta_max_min:eta,
          unidades_sugeridas:unitAllocation[i] || 0,
          unidades_totales_zona:totalUnits,
          unidades_ruta:routeUnitsUsed,
          unidades_disponibles_fijas:availableForStatic
        });
        cells.push({zona, post_id:postId, eta_max_min:eta, geometry: sector.geometry});
      });
    }
  });

  state.staticPosts = posts;
  state.voronoiCells = cells;
}

function renderVoronoiPanel(){
  const status = document.getElementById('voronoiStatus');
  const summary = document.getElementById('voronoiSummary');
  const table = document.getElementById('voronoiTable');
  if(!status || !summary || !table) return;

  if(!state.staticPosts?.length){
    status.textContent = 'No se generaron puestos fijos Voronoi. Si las unidades ya fueron ocupadas por recorridos, no queda disponibilidad remanente para vigilancia estacionaria.';
    summary.innerHTML = '';
    table.innerHTML = '';
    return;
  }

  const byZone = {};
  state.staticPosts.forEach(p=>{
    if(!byZone[p.zona]) byZone[p.zona] = [];
    byZone[p.zona].push(p);
  });

  status.innerHTML = `<span class="station-badge">Voronoi activo</span> ${state.staticPosts.length} puestos calculados en ${Object.keys(byZone).length} zonas, respetando el presupuesto de unidades por zona.`;

  summary.innerHTML = Object.entries(byZone)
    .sort((a,b)=>zoneSortValue(a[0]) - zoneSortValue(b[0]))
    .map(([zona, arr])=>{
      const maxEta = Math.max(...arr.map(x=>Number(x.eta_max_min||0)));
      const totalUnits = arr[0]?.unidades_totales_zona ?? 0;
      const routeUnits = arr[0]?.unidades_ruta ?? 0;
      const fixedUnits = arr.reduce((s,x)=>s+Number(x.unidades_sugeridas||0),0);
      return `<div class="voronoi-summary-row"><span class="zone">${displayZoneName(zona)}</span><span class="posts">Puestos: ${arr.length} · Ruta: ${routeUnits} · Fijas: ${fixedUnits}/${totalUnits}</span><span class="eta">Tiempo máximo estimado: ${maxEta.toFixed(1)} min</span></div>`;
    }).join('');

  const headers = ['Zona','Puesto','Cobertura km','Tiempo máx. min','Unidades sugeridas','Presupuesto zona'];
  const rows = state.staticPosts.map(p=>`<tr><td>${displayZoneName(p.zona)}</td><td>${p.post_id}</td><td>${p.coverage_km}</td><td>${p.eta_max_min}</td><td>${p.unidades_sugeridas}</td><td>Total: ${p.unidades_totales_zona} · Ruta: ${p.unidades_ruta} · Fijas disp.: ${p.unidades_disponibles_fijas}</td></tr>`).join('');
  table.innerHTML = `<thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody>`;
}


// Ensure CECORE markers are rendered after every map redraw
if(typeof drawMap === 'function' && !window.__cecoreDrawMapWrapped){
  window.__cecoreDrawMapWrapped = true;
  const __sirpeOriginalDrawMapForCecores = drawMap;
  drawMap = function(){
    const result = __sirpeOriginalDrawMapForCecores.apply(this, arguments);
    setTimeout(()=>{ if(typeof window.renderCecoresOnStateMap==='function') window.renderCecoresOnStateMap(); }, 0);
    return result;
  };
}



// ================= CECORE SIMPLE VISIBLE MARKERS FIX =================
(function(){
  const CECORE_POINTS_VISIBLE = {
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

  function scopeIsEstado(){
    const selector=document.getElementById('scopeSelector');
    const scope=selector?.value || window.state?.currentScope || 'municipio';
    return scope === 'estado';
  }

  function removeCecoreVisualLayers(){
    if(!window.state?.map) return;
    if(window.state.cecoreLayer){ try{ window.state.map.removeLayer(window.state.cecoreLayer); }catch(e){} window.state.cecoreLayer=null; }
    if(window.state.cecoreLabelLayer){ try{ window.state.map.removeLayer(window.state.cecoreLabelLayer); }catch(e){} window.state.cecoreLabelLayer=null; }
    if(window.state.cecoreLegend){ try{ window.state.map.removeControl(window.state.cecoreLegend); }catch(e){} window.state.cecoreLegend=null; }
  }

  function addCecoreLegendVisible(){
    if(!window.state?.map || window.state.cecoreLegend) return;
    const legend=L.control({position:'topright'});
    legend.onAdd=function(){
      const div=L.DomUtil.create('div','sirpe-cecore-visible-legend');
      div.style.background='rgba(255,255,255,.96)';
      div.style.padding='8px 10px';
      div.style.border='1px solid #d5e0ea';
      div.style.borderRadius='12px';
      div.style.boxShadow='0 10px 24px rgba(15,35,58,.16)';
      div.style.fontSize='12px';
      div.style.color='#16324a';
      div.innerHTML='<b>CECORE</b><br><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#dc2626;border:2px solid #fff;box-shadow:0 0 0 1px #991b1b;margin-right:6px;"></span> Centro Regional';
      return div;
    };
    legend.addTo(window.state.map);
    window.state.cecoreLegend=legend;
  }

  window.renderCecoresOnStateMap = function(){
    try{
      if(!window.L || !window.state || !window.state.map) return;
      removeCecoreVisualLayers();
      if(!scopeIsEstado()) return;

      const catalog=window.ESTADO_CECORES || CECORE_POINTS_VISIBLE;
      const circles=[];
      const labels=[];

      Object.entries(catalog).forEach(([region,c])=>{
        const lat=Number(c.lat);
        const lon=Number(c.lon);
        if(!Number.isFinite(lat)||!Number.isFinite(lon)) return;

        const circle=L.circleMarker([lat,lon],{
          radius:10,
          color:'#7f1d1d',
          weight:3,
          fillColor:'#dc2626',
          fillOpacity:1,
          opacity:1,
          pane:'markerPane'
        }).bindPopup(
          '<b>'+(c.nombre || 'CECORE '+region)+'</b><br>'+
          'Región: <b>'+region+'</b><br>'+
          'Latitud: '+lat.toFixed(6)+'<br>'+
          'Longitud: '+lon.toFixed(6)+'<br>'+
          '<a href="https://www.google.com/maps?q='+lat+','+lon+'" target="_blank">Abrir en Google Maps</a>'
        );

        const label=L.marker([lat,lon],{
          interactive:false,
          zIndexOffset:30000,
          icon:L.divIcon({
            className:'sirpe-cecore-text-label',
            html:'<div style="background:#ffffff;color:#7f1d1d;border:1px solid #fecaca;border-radius:8px;padding:2px 6px;font-size:11px;font-weight:900;box-shadow:0 4px 10px rgba(0,0,0,.18);white-space:nowrap;">'+region+'</div>',
            iconSize:null,
            iconAnchor:[-12,28]
          })
        });

        circles.push(circle);
        labels.push(label);
      });

      window.state.cecoreLayer=L.layerGroup(circles).addTo(window.state.map);
      window.state.cecoreLabelLayer=L.layerGroup(labels).addTo(window.state.map);
      window.state.cecoreLayer.eachLayer(function(l){ if(l.bringToFront) l.bringToFront(); });
      addCecoreLegendVisible();
      console.info('CECORE visibles:', circles.length);
    }catch(e){
      console.warn('Error dibujando CECORE visibles:', e);
    }
  };

  function scheduleCecoreVisibleRender(){
    setTimeout(function(){ if(window.renderCecoresOnStateMap) window.renderCecoresOnStateMap(); },100);
    setTimeout(function(){ if(window.renderCecoresOnStateMap) window.renderCecoresOnStateMap(); },700);
    setTimeout(function(){ if(window.renderCecoresOnStateMap) window.renderCecoresOnStateMap(); },1800);
  }

  window.addEventListener('DOMContentLoaded',function(){
    const selector=document.getElementById('scopeSelector');
    if(selector && !selector.dataset.cecoreVisibleFix){
      selector.dataset.cecoreVisibleFix='1';
      selector.addEventListener('change', scheduleCecoreVisibleRender);
    }
    scheduleCecoreVisibleRender();
  });

  if(typeof window.drawMap === 'function' && !window.__cecoreVisibleDrawWrapped){
    window.__cecoreVisibleDrawWrapped=true;
    const oldDraw=window.drawMap;
    window.drawMap=function(){
      const result=oldDraw.apply(this,arguments);
      scheduleCecoreVisibleRender();
      return result;
    };
  }

  setInterval(function(){
    if(scopeIsEstado() && window.state?.map && !window.state.cecoreLayer){
      window.renderCecoresOnStateMap();
    }
  },2500);
})();


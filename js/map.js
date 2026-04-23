// ================= MAP =================


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
    markers.push({type:'Feature',properties:{unidad:r.unidad,tipo:'INICIO'},geometry:{type:'Point',coordinates:[ini.lon,ini.lat]}});
    markers.push({type:'Feature',properties:{unidad:r.unidad,tipo:'FIN'},geometry:{type:'Point',coordinates:[fin.lon,fin.lat]}});
  });
  state.markerLayer=L.geoJSON(
    {type:'FeatureCollection',features:markers},
    {pointToLayer:(f,latlng)=>L.circleMarker(latlng,{radius:7,color:f.properties.tipo==='INICIO'?'#0f9d58':'#b45309',fillColor:f.properties.tipo==='INICIO'?'#0f9d58':'#b45309',fillOpacity:.85,weight:2}).bindTooltip(`${f.properties.tipo} - ${f.properties.unidad}`)}
  ).addTo(state.map);

  const layers=[state.sectorLayer,state.hotspotLayer,state.routeLayer,state.markerLayer];
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

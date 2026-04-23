// ================= MAP =================
function drawMap(){
  clearLayers();
  state.sectorLayer=L.geoJSON({type:'FeatureCollection',features:state.sectors},{style:f=>({color:getZoneColor(normalizeZoneName(f.properties?.zona)),fillColor:getZoneColor(normalizeZoneName(f.properties?.zona)),weight:2,fillOpacity:0.12,opacity:0.9}), onEachFeature:(f,l)=>l.bindPopup(`<b>${displayZoneName(normalizeZoneName(f.properties?.zona))}</b>`)}).addTo(state.map);
  if(state.vectors && state.vectors.length){
    state.vectorLayer=L.geoJSON({type:'FeatureCollection',features:state.vectors},{style:f=>({color:getZoneColor(normalizeZoneName(f.properties?.zona)),weight:1.5,fillColor:getZoneColor(normalizeZoneName(f.properties?.zona)),dashArray:'4 4',fillOpacity:0.04,opacity:0.7}), onEachFeature:(f,l)=>l.bindPopup(`<b>${f.properties?.vector_name || f.properties?.Name || 'Vector'}</b><br>${displayZoneName(normalizeZoneName(f.properties?.zona)||'')}`)}).addTo(state.map);
  }
  const hotFeatures=state.hotspots.map(h=>({type:'Feature',properties:h,geometry:{type:'Point',coordinates:[h.lon,h.lat]}}));
  state.hotspotLayer=L.geoJSON({type:'FeatureCollection',features:hotFeatures},{pointToLayer:(f,latlng)=>L.circleMarker(latlng,{radius:5+Math.min(14,f.properties.probabilidad*70),color:getZoneColor(f.properties.zona),fillColor:getZoneColor(f.properties.zona),fillOpacity:0.55,weight:1}).bindPopup(`<b>${f.properties.nombre}</b><br>Zona ${displayZoneName(f.properties.zona)}<br>${f.properties.turno}<br>Eventos: ${f.properties.eventos}<br>Prob: ${f.properties.probabilidad.toFixed(3)}`)}).addTo(state.map);
  const routeFeatures=state.routes.filter(r=>Array.isArray(r.points)&&r.points.length>=2).map(r=>({type:'Feature',properties:r,geometry:{type:'LineString',coordinates:r.points.map(p=>[p.lon,p.lat])}}));
  state.routeLayer=L.geoJSON({type:'FeatureCollection',features:routeFeatures},{style:f=>({color:turnoColor(f.properties.turno),weight:4,opacity:0.85}),onEachFeature:(f,l)=>l.bindPopup(`<b>${f.properties.unidad}</b><br>Zona ${displayZoneName(f.properties.zona)}<br>${f.properties.turno}<br>Distancia: ${f.properties.distancia_km} km<br>Tiempo: ${f.properties.tiempo_total_min} min`) }).addTo(state.map);
  const markers=[]; state.routes.forEach(r=>{ if(!r.points.length) return; const ini=r.points[0], fin=r.points[r.points.length-1]; markers.push({type:'Feature',properties:{unidad:r.unidad,tipo:'INICIO'},geometry:{type:'Point',coordinates:[ini.lon,ini.lat]}}); markers.push({type:'Feature',properties:{unidad:r.unidad,tipo:'FIN'},geometry:{type:'Point',coordinates:[fin.lon,fin.lat]}}); });
  state.markerLayer=L.geoJSON({type:'FeatureCollection',features:markers},{pointToLayer:(f,latlng)=>L.circleMarker(latlng,{radius:7,color:f.properties.tipo==='INICIO'?'#0f9d58':'#b45309',fillColor:f.properties.tipo==='INICIO'?'#0f9d58':'#b45309',fillOpacity:.85,weight:2}).bindTooltip(`${f.properties.tipo} - ${f.properties.unidad}`)}).addTo(state.map);
  const layers=[state.sectorLayer,state.hotspotLayer,state.routeLayer,state.markerLayer]; if(state.vectorLayer) layers.push(state.vectorLayer);
  const all=L.featureGroup(layers); if(all.getLayers().length) state.map.fitBounds(all.getBounds().pad(0.05));
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
  const basePosts = Math.max(1, toSafeInt(document.getElementById('voronoiBasePosts')?.value || 1, 1));
  const maxPosts = Math.max(basePosts, toSafeInt(document.getElementById('voronoiMaxPosts')?.value || 3, 3));
  const unitsPerPost = Math.max(1, toSafeInt(document.getElementById('voronoiUnitsPerPost')?.value || 3, 3));
  const speed = Math.max(5, Number(document.getElementById('voronoiSpeed')?.value || 30) || 30);
  const vectors = state.vectors || [];

  (sectors || []).forEach((sector, idx)=>{
    const zona = normalizeZoneName(sector.properties?.zona || sector.properties?.ZONA || sector.properties?.Name) || `SECTOR ${idx+1}`;
    const incidentsZone = (incidents||[]).filter(i=> normalizeZoneName(i.zona) === zona);
    const vectorsZone = vectors.filter(v=> normalizeZoneName(v.properties?.zona || v.properties?.ZONA || v.properties?.Name) === zona);
    const units = toSafeInt(resources[zona]?.unidades, 0);
    let nPosts = Math.min(maxPosts, Math.max(basePosts, Math.ceil(units / unitsPerPost)));
    if(incidentsZone.length === 0 && units === 0) nPosts = 1;

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

    if(seedFeatures.length === 1){
      const p = seedFeatures[0];
      const coverageKm = featureVerticesKmDistance(p, sector);
      const eta = Number(((coverageKm / speed) * 60).toFixed(1));
      posts.push({zona, post_id:`${displayZoneName(zona)}-P1`, lon:p.geometry.coordinates[0], lat:p.geometry.coordinates[1], coverage_km:Number(coverageKm.toFixed(2)), eta_max_min:eta, unidades_sugeridas:Math.max(1, Math.ceil(units / nPosts))});
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
          posts.push({zona, post_id:postId, lon:pt.geometry.coordinates[0], lat:pt.geometry.coordinates[1], coverage_km:Number(coverageKm.toFixed(2)), eta_max_min:eta, unidades_sugeridas:Math.max(1, Math.ceil(units / Math.max(1, nPosts)))});
          cells.push({zona, post_id:postId, eta_max_min:eta, geometry: clipped.geometry});
        });
      }
    }catch(e){
      seedFeatures.forEach((seed, i)=>{
        const coverageKm = featureVerticesKmDistance(seed, sector);
        const eta = Number(((coverageKm / speed) * 60).toFixed(1));
        const postId = `${displayZoneName(zona)}-P${i+1}`;
        posts.push({zona, post_id:postId, lon:seed.geometry.coordinates[0], lat:seed.geometry.coordinates[1], coverage_km:Number(coverageKm.toFixed(2)), eta_max_min:eta, unidades_sugeridas:Math.max(1, Math.ceil(units / Math.max(1, nPosts)))});
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
    status.textContent = 'Aún no se ha ejecutado el cálculo Voronoi. Presiona \"Procesar\" para generar los puntos óptimos de patrulla estacionaria.';
    summary.innerHTML = '';
    table.innerHTML = '';
    return;
  }

  const byZone = {};
  state.staticPosts.forEach(p=>{
    if(!byZone[p.zona]) byZone[p.zona] = [];
    byZone[p.zona].push(p);
  });

  status.innerHTML = `<span class="station-badge">Voronoi activo</span> ${state.staticPosts.length} puestos calculados en ${Object.keys(byZone).length} zonas.`;
  summary.innerHTML = Object.entries(byZone).sort((a,b)=>zoneSortValue(a[0]) - zoneSortValue(b[0])).map(([zona, arr])=>{
    const maxEta = Math.max(...arr.map(x=>Number(x.eta_max_min||0)));
    return `<div class="voronoi-summary-row"><span class="zone">${displayZoneName(zona)}</span><span class="posts">Puestos sugeridos: ${arr.length}</span><span class="eta">Tiempo máximo estimado: ${maxEta.toFixed(1)} min</span></div>`;
  }).join('');

  const headers = ['Zona','Puesto','Cobertura km','Tiempo máx. min','Unidades sugeridas'];
  const rows = state.staticPosts.map(p=>`<tr><td>${displayZoneName(p.zona)}</td><td>${p.post_id}</td><td>${p.coverage_km}</td><td>${p.eta_max_min}</td><td>${p.unidades_sugeridas}</td></tr>`).join('');
  table.innerHTML = `<thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody>`;
}

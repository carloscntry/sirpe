(function(){
  function getVoronoiResources(){
    try{ return typeof getResourcesFromUI === 'function' ? getResourcesFromUI() : {}; }catch(e){ return {}; }
  }

  window.refreshVoronoiFromSidebar = function(){
    try{
      const sectors = (typeof getModelZoneFeatures === 'function') ? getModelZoneFeatures(true) : (state.sectors || []);
      const incidents = state.incidents || [];
      const resources = getVoronoiResources();
      if(typeof buildVoronoiPrepositioning === 'function'){
        buildVoronoiPrepositioning(sectors, incidents, resources);
      }
      if(typeof renderVoronoiPanel === 'function') renderVoronoiPanel();
      if(typeof updateKPIs === 'function') updateKPIs();
      if(typeof drawMap === 'function') drawMap();
    }catch(err){
      console.error('Voronoi refresh error', err);
    }
  };

  const refreshVoronoiBtn = document.getElementById('refreshVoronoiBtn');
  if(refreshVoronoiBtn){
    refreshVoronoiBtn.addEventListener('click', ()=>window.refreshVoronoiFromSidebar());
  }

  const originalRunBtn = document.getElementById('runBtn');
  if(originalRunBtn){
    originalRunBtn.addEventListener('click', ()=>{
      setTimeout(()=>{
        if(typeof renderVoronoiPanel === 'function') renderVoronoiPanel();
      }, 50);
    });
  }

  drawMap = function(){
    clearLayers();
    state.sectorLayer = L.geoJSON({type:'FeatureCollection',features:state.sectors},{
      style:f=>({color:getZoneColor(normalizeZoneName(f.properties?.zona)),fillColor:getZoneColor(normalizeZoneName(f.properties?.zona)),weight:2,fillOpacity:0.12,opacity:0.9}),
      onEachFeature:(f,l)=>l.bindPopup(`<b>${displayZoneName(normalizeZoneName(f.properties?.zona))}</b>`)
    }).addTo(state.map);

    if(state.vectors && state.vectors.length){
      state.vectorLayer = L.geoJSON({type:'FeatureCollection',features:state.vectors},{
        style:f=>({color:getZoneColor(normalizeZoneName(f.properties?.zona)),weight:1.5,fillColor:getZoneColor(normalizeZoneName(f.properties?.zona)),dashArray:'4 4',fillOpacity:0.04,opacity:0.7}),
        onEachFeature:(f,l)=>l.bindPopup(`<b>${f.properties?.vector_name || f.properties?.Name || 'Vector'}</b><br>${displayZoneName(normalizeZoneName(f.properties?.zona)||'')}`)
      }).addTo(state.map);
    }

    if(state.voronoiCells && state.voronoiCells.length){
      const vorFeatures = state.voronoiCells.filter(c=>c?.geometry).map(c=>({type:'Feature', properties:c, geometry:c.geometry}));
      state.voronoiLayer = L.geoJSON({type:'FeatureCollection',features:vorFeatures},{
        style:f=>({color:getZoneColor(normalizeZoneName(f.properties?.zona)),weight:1,dashArray:'5 4',fillColor:getZoneColor(normalizeZoneName(f.properties?.zona)),fillOpacity:0.06,opacity:0.55}),
        onEachFeature:(f,l)=>l.bindPopup(`<b>${f.properties?.post_id || 'Puesto Voronoi'}</b><br>Zona ${displayZoneName(normalizeZoneName(f.properties?.zona)||'')}<br>ETA máximo: ${Number(f.properties?.eta_max_min||0).toFixed(1)} min`)
      }).addTo(state.map);
    }

    const hotFeatures=(state.hotspots||[]).map(h=>({type:'Feature',properties:h,geometry:{type:'Point',coordinates:[h.lon,h.lat]}}));
    state.hotspotLayer=L.geoJSON({type:'FeatureCollection',features:hotFeatures},{
      pointToLayer:(f,latlng)=>L.circleMarker(latlng,{radius:5+Math.min(14,f.properties.probabilidad*70),color:getZoneColor(f.properties.zona),fillColor:getZoneColor(f.properties.zona),fillOpacity:0.55,weight:1})
        .bindPopup(`<b>${f.properties.nombre}</b><br>Zona ${displayZoneName(f.properties.zona)}<br>${f.properties.turno}<br>Eventos: ${f.properties.eventos}<br>Prob: ${f.properties.probabilidad.toFixed(3)}`)
    }).addTo(state.map);

    const routeFeatures=(state.routes||[]).filter(r=>Array.isArray(r.points)&&r.points.length>=2).map(r=>({type:'Feature',properties:r,geometry:{type:'LineString',coordinates:r.points.map(p=>[p.lon,p.lat])}}));
    state.routeLayer=L.geoJSON({type:'FeatureCollection',features:routeFeatures},{
      style:f=>({color:turnoColor(f.properties.turno),weight:4,opacity:0.85}),
      onEachFeature:(f,l)=>l.bindPopup(`<b>${f.properties.unidad}</b><br>Zona ${displayZoneName(f.properties.zona)}<br>${f.properties.turno}<br>Distancia: ${f.properties.distancia_km} km<br>Tiempo: ${f.properties.tiempo_total_min} min`)
    }).addTo(state.map);

    const markers=[];
    (state.routes||[]).forEach(r=>{
      if(!r.points?.length) return;
      if(r.points.length===1){
        const p=r.points[0];
        markers.push({type:'Feature',properties:{unidad:r.unidad,tipo:'FIJO'},geometry:{type:'Point',coordinates:[p.lon,p.lat]}});
        return;
      }
      const ini=r.points[0], fin=r.points[r.points.length-1];
      markers.push({type:'Feature',properties:{unidad:r.unidad,tipo:'INICIO'},geometry:{type:'Point',coordinates:[ini.lon,ini.lat]}});
      markers.push({type:'Feature',properties:{unidad:r.unidad,tipo:'FIN'},geometry:{type:'Point',coordinates:[fin.lon,fin.lat]}});
    });

    if(state.staticPosts && state.staticPosts.length){
      const postFeatures=state.staticPosts.map(p=>({type:'Feature',properties:p,geometry:{type:'Point',coordinates:[p.lon,p.lat]}}));
      state.staticPostLayer=L.geoJSON({type:'FeatureCollection',features:postFeatures},{
        pointToLayer:(f,latlng)=>L.circleMarker(latlng,{radius:8,color:'#103b66',fillColor:'#ffffff',fillOpacity:0.95,weight:3})
          .bindTooltip(`Vigilancia fija · ${f.properties.post_id}`, {direction:'top'})
          .bindPopup(`<b>${f.properties.post_id}</b><br>Zona ${displayZoneName(f.properties.zona)}<br>Cobertura: ${f.properties.coverage_km} km<br>ETA máximo: ${f.properties.eta_max_min} min<br>Unidades sugeridas: ${f.properties.unidades_sugeridas}`)
      }).addTo(state.map);
    }

    state.markerLayer=L.geoJSON({type:'FeatureCollection',features:markers},{
      pointToLayer:(f,latlng)=>{
        const config = f.properties.tipo==='INICIO'
          ? {color:'#0f9d58', fillColor:'#0f9d58'}
          : f.properties.tipo==='FIN'
            ? {color:'#b45309', fillColor:'#b45309'}
            : {color:'#103b66', fillColor:'#93c5fd'};
        return L.circleMarker(latlng,{radius:7,color:config.color,fillColor:config.fillColor,fillOpacity:.9,weight:2})
          .bindTooltip(`${f.properties.tipo} - ${f.properties.unidad}`);
      }
    }).addTo(state.map);

    const layers=[state.sectorLayer,state.hotspotLayer,state.routeLayer,state.markerLayer];
    if(state.vectorLayer) layers.push(state.vectorLayer);
    if(state.voronoiLayer) layers.push(state.voronoiLayer);
    if(state.staticPostLayer) layers.push(state.staticPostLayer);
    const all=L.featureGroup(layers.filter(Boolean));
    if(all.getLayers().length){
      try{ state.map.fitBounds(all.getBounds().pad(0.05)); }catch(e){}
    }
  };

  if(typeof renderVoronoiPanel === 'function') renderVoronoiPanel();
})();

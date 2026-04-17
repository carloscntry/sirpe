// ================= ANALYTICS =================
function sectorizeIncidents(incidents,sectors){
  const vectors=(state.vectors||[]).filter(v=>v?.geometry);
  return incidents.map(inc=>{
    const pt=turf.point([inc.lon, inc.lat]);
    let zona=null;
    for(const s of sectors||[]){
      if(pointInFeature(pt,s)){ zona=extractZoneNameFromFeature(s); break; }
    }
    if(!zona) return null;
    let vectorName=null;
    for(const v of vectors){
      const vZona=extractZoneNameFromFeature(v);
      if(pointInFeature(pt,v) && (!vZona || vZona===zona)){ vectorName=v.properties?.vector_name || v.properties?.Name || null; break; }
    }
    return {...inc, zona, zona_label:displayZoneName(zona), vector_name:vectorName};
  }).filter(Boolean);
}
function buildHotspots(incidents){
  if(!incidents?.length) return [];
  const maxDate=incidents.reduce((m,r)=> !m || (r.fecha && r.fecha>m) ? r.fecha : m, null) || new Date();
  const bins=new Map();
  incidents.forEach(r=>{
    const gx=Number(r.lon.toFixed(3)), gy=Number(r.lat.toFixed(3));
    const bucket=r.vector_name ? `V:${r.vector_name}` : `G:${gx}|${gy}`;
    const key=[r.zona,r.turno,bucket].join('|');
    const dias=r.fecha ? Math.max(0, Math.round((maxDate-r.fecha)/86400000)) : 0;
    const rec=1/(1 + dias/180);
    const risk=1*rec*turnoPeso(r.turno);
    if(!bins.has(key)) bins.set(key,{zona:r.zona, turno:r.turno, lon:r.lon, lat:r.lat, eventos:0, riesgo:0, colonia:r.colonia||'SIN_DATO', vector_name:r.vector_name||null, samples:[]});
    const obj=bins.get(key);
    obj.eventos += 1;
    obj.riesgo += risk;
    obj.samples.push([r.lon,r.lat]);
  });
  let arr=Array.from(bins.values()).map((x,i)=>{
    if(x.samples?.length){
      x.lon = x.samples.reduce((s,p)=>s+p[0],0)/x.samples.length;
      x.lat = x.samples.reduce((s,p)=>s+p[1],0)/x.samples.length;
    }
    return {...x, id:`H${i+1}`};
  });
  const byZT={};
  arr.forEach(x=>{ const k=`${x.zona}|${x.turno}`; byZT[k]=(byZT[k]||0)+x.riesgo; });
  arr.forEach(x=>{
    x.probabilidad = byZT[`${x.zona}|${x.turno}`] > 0 ? x.riesgo/byZT[`${x.zona}|${x.turno}`] : 0;
    x.nombre = `${x.colonia} | ${displayZoneName(x.zona)} | ${x.turno}${x.vector_name?` | ${x.vector_name}`:''}`;
  });
  const grouped={};
  arr.sort((a,b)=>b.riesgo-a.riesgo).forEach(x=>{
    const k=`${x.zona}|${x.turno}`;
    grouped[k]=grouped[k]||[];
    if(grouped[k].length<16) grouped[k].push(x);
  });
  return Object.values(grouped).flat();
}
function buildAlerts(summary, hotspots, resources, riskThreshold, timeThreshold){
  const alerts=[];
  const riskByZone={}; hotspots.forEach(h=> riskByZone[h.zona]=(riskByZone[h.zona]||0)+h.riesgo );
  const unitsByZone={}; summary.forEach(r=> unitsByZone[r.zona]=(unitsByZone[r.zona]||0)+1 );
  const catalog=(state.zoneCatalog?.length?state.zoneCatalog:[...new Set([...Object.keys(riskByZone), ...Object.keys(unitsByZone)])]).sort((a,b)=>zoneSortValue(a)-zoneSortValue(b));
  for(const zona of catalog){
    const risk=riskByZone[zona]||0; const units=unitsByZone[zona]||0;
    if(risk > riskThreshold && units <= 1) alerts.push({level:'danger', title:`${displayZoneName(zona)} crítica`, detail:`Riesgo ${risk.toFixed(2)} con cobertura insuficiente (${units} unidad/es).`});
    else if(risk > riskThreshold*0.75) alerts.push({level:'warn', title:`${displayZoneName(zona)} en vigilancia`, detail:`Riesgo alto (${risk.toFixed(2)}). Mantener saturación preventiva.`});
  }
  summary.forEach(r=>{ if(r.tiempo_total_min>timeThreshold) alerts.push({level:'warn', title:`Unidad ${r.unidad_a_emplear} excedida`, detail:`Tiempo estimado ${r.tiempo_total_min} min. Conviene redistribuir waypoints o reforzar ${displayZoneName(r.zona)}.`}); });
  if(!alerts.length) alerts.push({level:'ok', title:'Sistema estable', detail:'No se detectaron alertas críticas con los parámetros actuales.'});
  return alerts;
}
function buildAiRecommendations(summary, hotspots, resources){
  const recs=[];
  const riskByZone={}; hotspots.forEach(h=> riskByZone[h.zona]=(riskByZone[h.zona]||0)+h.riesgo );
  const currentUnits={}; summary.forEach(r=> currentUnits[r.zona]=(currentUnits[r.zona]||0)+1 );
  const totalCurrent=Object.values(currentUnits).reduce((a,b)=>a+b,0) || 1;
  const totalRisk=Object.values(riskByZone).reduce((a,b)=>a+b,0) || 1;
  const zoneCatalog=(state.zoneCatalog?.length?state.zoneCatalog:[...new Set([...Object.keys(riskByZone), ...Object.keys(currentUnits)])]).sort((a,b)=>zoneSortValue(a)-zoneSortValue(b));
  const desired=zoneCatalog.map(zona=>{ const current=currentUnits[zona]||0; const ideal=Math.round((riskByZone[zona]||0)/totalRisk*totalCurrent); return {zona,current,ideal,risk:riskByZone[zona]||0,diff:ideal-current}; });
  const donors=desired.filter(z=>z.diff<0).sort((a,b)=>a.diff-b.diff);
  const receivers=desired.filter(z=>z.diff>0).sort((a,b)=>b.diff-a.diff);
  receivers.forEach(r=>{ let need=r.diff; for(const d of donors){ if(need<=0) break; if(d.diff<0){ recs.push({type:'move', from:d.zona, to:r.zona, unidades:1, motivo:`Redistribuir una unidad de ${displayZoneName(d.zona)} a ${displayZoneName(r.zona)} por mayor concentración de riesgo (${r.risk.toFixed(2)}).`}); d.diff += 1; need -= 1; } } });
  summary.filter(r=>r.tiempo_total_min>60).forEach(r=> recs.push({type:'optimize', unidad:r.unidad_a_emplear, motivo:`Reducir waypoints o dividir ruta en ${displayZoneName(r.zona)}; tiempo actual ${r.tiempo_total_min} min.`}));
  if(!recs.length) recs.push({type:'ok', motivo:'La distribución actual es razonable según el riesgo relativo observado.'});
  return recs;
}
function selectVectorAwarePoints(hs, unitIndex, unitCount, maxWp){
  const maxPoints=Math.max(1, toSafeInt(maxWp, 4));
  if(!Array.isArray(hs) || !hs.length) return [];
  const orderedHs=hs.slice().sort((a,b)=>{
    const av=(Number(b.probabilidad)||0)-(Number(a.probabilidad)||0);
    if(av!==0) return av;
    return (Number(b.riesgo)||0)-(Number(a.riesgo)||0);
  });

  const seed=orderedHs[unitIndex % orderedHs.length];
  if(!seed) return [];

  const seedVector=seed.vector_name || null;
  const sameVector=seedVector ? orderedHs.filter(h=>h.vector_name===seedVector && h.id!==seed.id) : [];
  const others=orderedHs.filter(h=>h.id!==seed.id && (!seedVector || h.vector_name!==seedVector));

  sameVector.sort((a,b)=>haversineKm(seed.lat,seed.lon,a.lat,a.lon)-haversineKm(seed.lat,seed.lon,b.lat,b.lon));
  others.sort((a,b)=>haversineKm(seed.lat,seed.lon,a.lat,a.lon)-haversineKm(seed.lat,seed.lon,b.lat,b.lon));

  const selected=[seed];
  for(const p of [...sameVector, ...others]){
    if(selected.length>=maxPoints) break;
    if(!selected.some(s=>s.id===p.id)) selected.push(p);
  }

  if(selected.length===1 && orderedHs.length>1){
    const fallback=orderedHs.find(h=>h.id!==seed.id);
    if(fallback) selected.push(fallback);
  }

  return nearestNeighbor(selected.slice(0,maxPoints)).map((p,idx)=>({...p, orden:idx+1}));
}

(function(){

  window.updateActiveScopeBadge = function(){
    const badge = document.getElementById('scopeActiveBadge');
    if(!badge) return;
    const scope = document.getElementById('scopeSelector')?.value || state.currentScope || 'municipio';
    const label = scope === 'estado' ? 'Estado de Puebla' : 'Municipio de Puebla';
    const dotColor = scope === 'estado' ? '#60a5fa' : '#4ade80';
    const shadow = scope === 'estado' ? 'rgba(96,165,250,.15)' : 'rgba(74,222,128,.15)';
    badge.innerHTML = `<span class="dot" style="background:${dotColor}; box-shadow:0 0 0 4px ${shadow};"></span><span>Ámbito activo: ${label}</span>`;
  };



  window.applyScopeVisualMode = function(redrawOnly=false){
    state.currentScope = document.getElementById('scopeSelector')?.value || state.currentScope || 'municipio';
    if(!redrawOnly){
      state.summary = [];
      state.routes = [];
      state.hotspots = [];
      state.incidents = [];
      state.deployments = [];
      state.voronoiCells = [];
      state.staticPosts = [];
    }
    state.vectors = state.currentScope === 'estado' ? [] : (typeof defaultVectorFeatures==='function' ? defaultVectorFeatures() : []);
    state.sectors = (typeof getModelZoneFeatures==='function') ? getModelZoneFeatures(false) : (state.sectors || []);
    if(typeof renderFixedResourceModule==='function'){
      renderFixedResourceModule(typeof getStoredResourcesForScope==='function' ? getStoredResourcesForScope(getScopeKey()) : getDefaultResourceMap());
    }
    if(typeof getModelZoneCatalog==='function'){
      state.zoneCatalog = getModelZoneCatalog(typeof getResourcesFromUI==='function' ? getResourcesFromUI() : {});
    }
    if(typeof buildZoneColorMap==='function') buildZoneColorMap();
    if(state.map && typeof drawMap==='function' && Array.isArray(state.sectors) && state.sectors.length){
      drawMap();
    }
    setTimeout(()=>{ if(typeof window.renderCecoresOnStateMap==='function') window.renderCecoresOnStateMap(); }, 50);
  };


  function ensureLeafletHeat(cb){
    if(window.L && L.heatLayer){ cb(); return; }
    const existing=[...document.scripts].find(s=>String(s.src||'').includes('leaflet.heat'));
    if(existing){ existing.addEventListener('load', cb, {once:true}); return; }
    const s=document.createElement('script');
    s.src='https://unpkg.com/leaflet.heat/dist/leaflet-heat.js';
    s.onload=cb;
    document.head.appendChild(s);
  }

  function injectAnalyticsUI(){
    const kpiGrid=document.querySelector('.card-grid');
    if(kpiGrid && !document.getElementById('kRisk') && !document.getElementById('kPred')){
      kpiGrid.insertAdjacentHTML('beforeend', `
        <div class="card"><div class="k">Riesgo agregado</div><div class="v" id="kRisk">0</div></div>
        <div class="card"><div class="k">Predicción 7 días</div><div class="v" id="kPred">0</div></div>
      `);
    }
    const btn=document.getElementById('refreshAnalyticsBtn');
    if(btn){ btn.onclick=()=>refreshAnalyticsAndRender(); }
    const toggle=document.getElementById('forecastToggle');
    const content=document.getElementById('forecastCollapse');
    const panel=toggle?.closest('.collapsible-panel');
    if(toggle && content && panel){
      toggle.onclick=()=>{
        const isOpen = !content.hasAttribute('hidden');
        if(isOpen){
          content.setAttribute('hidden','');
          toggle.setAttribute('aria-expanded','false');
          panel.classList.remove('open');
        }else{
          content.removeAttribute('hidden');
          toggle.setAttribute('aria-expanded','true');
          panel.classList.add('open');
        }
      };
    }
  }


  window.toggleSidebarSection = function(btn){
    const section = btn?.closest('.sidebar-section');
    const bodyId = btn?.getAttribute('aria-controls');
    const body = bodyId ? document.getElementById(bodyId) : section?.querySelector('.sidebar-section-body');
    if(!section || !body || !btn) return;
    const isOpen = !body.hasAttribute('hidden');
    if(isOpen){
      body.setAttribute('hidden','');
      btn.setAttribute('aria-expanded','false');
      section.classList.remove('open');
    }else{
      body.removeAttribute('hidden');
      btn.setAttribute('aria-expanded','true');
      section.classList.add('open');
    }
  };

  function bindSidebarSectionToggles(){
    document.querySelectorAll('.sidebar-toggle-inline').forEach((btn)=>{
      btn.onclick = (ev)=>{
        ev.preventDefault();
        window.toggleSidebarSection(btn);
      };
    });
  }

  bindSidebarSectionToggles();
  setTimeout(()=>{ if(typeof window.updateActiveScopeBadge==='function') window.updateActiveScopeBadge(); if(typeof window.applyScopeVisualMode==='function') window.applyScopeVisualMode(true); }, 0);

  function getInputNumber(id, fallback){
    const el=document.getElementById(id); const n=Number(el?.value);
    return Number.isFinite(n) ? n : fallback;
  }
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function toDate(v){ const d=v instanceof Date ? v : new Date(v); return isNaN(d) ? null : d; }
  function norm(v,min,max){ if(!Number.isFinite(v)) return 0; if(!(max>min)) return v>0 ? 1 : 0; return clamp((v-min)/(max-min),0,1); }
  function sum(arr,fn){ return (arr||[]).reduce((a,x)=>a+(fn?fn(x):x||0),0); }
  function avg(arr,fn){ return arr?.length ? sum(arr,fn)/arr.length : 0; }
  function normalizeTurnoName(t){ const m={madrugada:'madrugada',mañana:'mañana',tarde:'tarde',noche:'noche'}; return m[t]||t||'sin turno'; }
  function getCrimeType(inc){
    return String(inc.Delito ?? inc.delito ?? inc.Tipo ?? inc.tipo ?? inc['Tipo de delito'] ?? inc['TIPO DE DELITO'] ?? inc['CLASIFICACION'] ?? 'INCIDENTE GENERAL').trim().toUpperCase();
  }
  function getCrimeSeverity(tipo){
    const t=String(tipo||'').toUpperCase();
    if(/HOMICID|FEMINICID|SECUESTRO|EXTORSI/.test(t)) return 5;
    if(/ROBO.*VIOL|NARCOMEN|ARMA|LESION|VIOLACI|PRIVACION/.test(t)) return 4;
    if(/ROBO|ASALTO|ALLANAMIENTO|DAÑO|FRAUDE/.test(t)) return 3;
    if(/AMENAZA|RIÑA|VIOLENCIA FAMILIAR|ALTERACION/.test(t)) return 2;
    return 1;
  }
  function classifyRisk(score){
    if(score>=17) return {label:'Crítico', cls:'danger'};
    if(score>=10) return {label:'Alto', cls:'danger'};
    if(score>=5) return {label:'Medio', cls:'warn'};
    return {label:'Bajo', cls:'ok'};
  }

  window.buildHotspots=function(incidents){
    if(!incidents?.length) return [];
    const windowDays=getInputNumber('analyticWindowDays',30);
    const sensitivity=getInputNumber('hotspotSensitivity',2.5);
    const dated=(incidents||[]).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon)).map(x=>({...x, fecha:toDate(x.fecha)||new Date()}));
    const latest=dated.reduce((m,r)=> !m || r.fecha>m ? r.fecha : m, null) || new Date();
    const byBucket=new Map();
    dated.forEach(r=>{
      const dias=Math.max(0,Math.round((latest-r.fecha)/86400000));
      if(dias>windowDays) return;
      const tipo=getCrimeType(r); const impacto=getCrimeSeverity(tipo);
      const rec=1/(1 + dias/Math.max(1, windowDays/2));
      const turnoFactor=turnoPeso(normalizeTurnoName(r.turno));
      const gx=Number(r.lon.toFixed(3)), gy=Number(r.lat.toFixed(3));
      const bucket=r.vector_name ? `V:${r.vector_name}` : `G:${gx}|${gy}`;
      const key=[r.zona,normalizeTurnoName(r.turno),bucket].join('|');
      if(!byBucket.has(key)) byBucket.set(key,{zona:r.zona,turno:normalizeTurnoName(r.turno),lon:r.lon,lat:r.lat,eventos:0,riesgo:0,impacto_sum:0,colonia:r.colonia||'SIN_DATO',vector_name:r.vector_name||null,samples:[],last_seen:r.fecha,first_seen:r.fecha,tipos:{}});
      const o=byBucket.get(key);
      o.eventos += 1;
      const riesgo=(clamp(impacto,1,5) * Math.max(1, sensitivity/2) * rec * turnoFactor);
      o.riesgo += riesgo;
      o.impacto_sum += impacto;
      o.samples.push([r.lon,r.lat]);
      o.last_seen = o.last_seen>r.fecha ? o.last_seen : r.fecha;
      o.first_seen = o.first_seen<r.fecha ? o.first_seen : r.fecha;
      o.tipos[tipo]=(o.tipos[tipo]||0)+1;
    });
    let arr=[...byBucket.values()].map((x,i)=>{
      if(x.samples.length){ x.lon=avg(x.samples,p=>p[0]); x.lat=avg(x.samples,p=>p[1]); }
      const impactoProm=x.impacto_sum/Math.max(1,x.eventos);
      const persistence=Math.min(1, ((x.last_seen-x.first_seen)/86400000 + 1)/Math.max(1,windowDays));
      const recency=Math.max(0.1, 1/(1+((latest-x.last_seen)/86400000)/7));
      const topTipo=Object.entries(x.tipos).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'INCIDENTE GENERAL';
      return {...x,id:`H${i+1}`,impacto_promedio:impactoProm,persistencia:persistence,recencia:recency,tipo_dominante:topTipo};
    });
    const maxEventos=Math.max(...arr.map(x=>x.eventos),1), maxRiesgo=Math.max(...arr.map(x=>x.riesgo),1), maxImpacto=Math.max(...arr.map(x=>x.impacto_promedio),1);
    const byZT={}; arr.forEach(x=>{ const k=`${x.zona}|${x.turno}`; byZT[k]=(byZT[k]||0)+x.riesgo; });
    arr=arr.map(x=>{
      const freqNorm=x.eventos/maxEventos, gravNorm=x.impacto_promedio/maxImpacto, riskNorm=x.riesgo/maxRiesgo;
      const hotspotScore=(0.45*freqNorm + 0.30*gravNorm + 0.15*x.recencia + 0.10*x.persistencia);
      const prob=byZT[`${x.zona}|${x.turno}`] > 0 ? x.riesgo/byZT[`${x.zona}|${x.turno}`] : 0;
      return {...x, hotspot_score:hotspotScore, probabilidad:prob, nombre:`${x.colonia} | ${displayZoneName(x.zona)} | ${x.turno}${x.vector_name?` | ${x.vector_name}`:''}`};
    }).sort((a,b)=>b.hotspot_score-a.hotspot_score || b.riesgo-a.riesgo);
    const grouped={};
    arr.forEach(x=>{ const k=`${x.zona}|${x.turno}`; grouped[k]=grouped[k]||[]; if(grouped[k].length<16) grouped[k].push(x); });
    return Object.values(grouped).flat();
  };

  function buildAnalytics(incidents, hotspots, resources){
    const dated=(incidents||[]).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon)).map(x=>({...x, fecha:toDate(x.fecha)||new Date(), zona:normalizeZoneName(x.zona)||x.zona, turno:normalizeTurnoName(x.turno), tipo:getCrimeType(x)}));
    if(!dated.length) return {zoneRisk:[], predictions:[], heatPoints:[], recommendations:[], topRisk:0, predTotal:0};
    const latest=dated.reduce((m,r)=> !m || r.fecha>m ? r.fecha : m, null) || new Date();
    const windowDays=getInputNumber('analyticWindowDays',30);
    const predDays=getInputNumber('predictionDays',7);
    const startWindow=new Date(latest.getTime()-windowDays*86400000);
    const recent=dated.filter(x=>x.fecha>=startWindow);
    const catalog=(state.zoneCatalog?.length?state.zoneCatalog:[...new Set(recent.map(r=>r.zona).filter(Boolean))]).sort((a,b)=>zoneSortValue(a)-zoneSortValue(b));
    const heatPoints=[];
    const hotspotsByZone={};
    (hotspots||[]).forEach(h=>{ (hotspotsByZone[h.zona]=hotspotsByZone[h.zona]||[]).push(h); });
    recent.forEach(r=>{
      const sev=getCrimeSeverity(r.tipo);
      const daysAgo=Math.max(0,(latest-r.fecha)/86400000);
      const recency=Math.max(0.2, 1/(1 + daysAgo/7));
      const turnoFactor=turnoPeso(r.turno);
      const w=sev*recency*turnoFactor;
      heatPoints.push([r.lat,r.lon,w]);
    });
    const counts=catalog.map(z=>recent.filter(r=>r.zona===z).length);
    const gravs=catalog.map(z=>avg(recent.filter(r=>r.zona===z),r=>getCrimeSeverity(r.tipo)));
    const maxCount=Math.max(...counts,1), minCount=Math.min(...counts,0), maxGrav=Math.max(...gravs,1), minGrav=Math.min(...gravs,0);
    const zoneRisk=catalog.map(zona=>{
      const zoneRecent=recent.filter(r=>r.zona===zona);
      const last7=zoneRecent.filter(r=>r.fecha >= new Date(latest.getTime()-7*86400000));
      const last30=zoneRecent.filter(r=>r.fecha >= new Date(latest.getTime()-30*86400000));
      const prev30=zoneRecent.filter(r=>r.fecha < new Date(latest.getTime()-30*86400000) && r.fecha >= new Date(latest.getTime()-60*86400000));
      const freq=zoneRecent.length;
      const grav=avg(zoneRecent,r=>getCrimeSeverity(r.tipo));
      const avgWeekly30=(last30.length/30)*7;
      const trend=Math.max(0, (last7.length-avgWeekly30)/Math.max(1,avgWeekly30||1));
      const routeRows=(state.summary||[]).filter(r=>r.zona===zona);
      const avgResponse=avg(routeRows,r=>Number(r.tiempo_total_min)||0);
      const units=Number(resources?.[zona]?.unidades||0);
      const hot=hotspotsByZone[zona]||[];
      const hotspotScore=hot.length?Math.max(...hot.map(h=>h.hotspot_score||0)):0;
      const deficit=Math.max(0, (hot.length?Math.ceil(sum(hot,h=>h.hotspot_score||0)):0) - units);
      const freqN=norm(freq,minCount,maxCount);
      const gravN=norm(grav,minGrav,maxGrav);
      const trendN=clamp(trend,0,1);
      const responseN=norm(avgResponse,0,120);
      const deficitN=norm(deficit,0,8);
      const idx=100*(0.35*freqN + 0.20*gravN + 0.15*trendN + 0.15*responseN + 0.15*deficitN);
      const P=clamp(Math.round(1 + 4*(0.55*freqN + 0.25*trendN + 0.20*hotspotScore)),1,5);
      const I=clamp(Math.round(1 + 4*(0.70*gravN + 0.30*Math.min(1,hotspotScore))),1,5);
      const matrix=P*I;
      const riskClass=classifyRisk(matrix);
      const prevDaily=prev30.length/30;
      const curDaily=last30.length/30;
      const trendDelta=(curDaily-prevDaily)/Math.max(0.1, prevDaily||0.1);
      const predictedRate=0.50*(last7.length/7) + 0.30*(last30.length/30) + 0.20*Math.max(0,curDaily*(1+trendDelta));
      const pred7=Math.max(0, Math.round(predictedRate*predDays));
      return {zona,freq,grav,trend,avgResponse,units,hotspotScore,deficit,indice:Number(idx.toFixed(1)),probabilidad:P,impacto:I,matriz:matrix,riskClass,prediccion:pred7,last7:last7.length,last30:last30.length};
    }).sort((a,b)=>b.indice-a.indice);
    const recommendations=zoneRisk.slice(0,8).map((z,idx)=>{
      const level=z.indice>=75?'Crítica':z.indice>=50?'Alta':z.indice>=25?'Media':'Baja';
      const unidadesSugeridas=Math.max(1, Math.ceil((z.indice/100)*3 + (z.hotspotScore||0)*2));
      const turno = ((hotspotsByZone[z.zona]||[]).sort((a,b)=>(b.hotspot_score||0)-(a.hotspot_score||0))[0]?.turno) || 'noche';
      const tipo = idx<3 ? 'saturación táctica' : z.indice>=50 ? 'ruta cíclica intensiva' : 'cobertura preventiva';
      return {zona:z.zona,nivel:level,unidades:unidadesSugeridas,turno,permanencia: z.indice>=75 ? '25-35 min' : z.indice>=50 ? '15-25 min' : '10-15 min',tipo,detalle:`Priorizar ${displayZoneName(z.zona)} por índice ${z.indice}, predicción ${z.prediccion} y matriz ${z.probabilidad}×${z.impacto}=${z.matriz}.`};
    });
    return {zoneRisk, predictions:zoneRisk.map(z=>({zona:z.zona,prediccion:z.prediccion,indice:z.indice})), heatPoints, recommendations, topRisk:zoneRisk[0]?.indice||0, predTotal:sum(zoneRisk,z=>z.prediccion)};
  }

  function renderRiskZoneTable(){
    const table=document.getElementById('riskZoneTable'); if(!table) return;
    const rows=(state.analytics?.zoneRisk||[]).map(z=>`<tr>
      <td>${displayZoneName(z.zona)}</td>
      <td><span class="pill ${z.riskClass.cls}">${z.riskClass.label}</span></td>
      <td>${z.probabilidad}</td>
      <td>${z.impacto}</td>
      <td>${z.matriz}</td>
      <td>${z.indice}</td>
      <td>${z.prediccion}</td>
      <td>${z.units}</td>
    </tr>`).join('');
    table.innerHTML=`<thead><tr><th>Zona</th><th>Nivel</th><th>Prob.</th><th>Impacto</th><th>Matriz</th><th>Índice</th><th>Pred. 7d</th><th>Unid.</th></tr></thead><tbody>${rows}</tbody>`;
  }

  function renderPredictionChart(){
    const el=document.getElementById('predictionChart'); if(!el || !window.Plotly) return;
    const data=(state.analytics?.predictions||[]).slice(0,10).reverse();
    Plotly.newPlot(el,[
      {type:'bar', x:data.map(x=>displayZoneName(x.zona)), y:data.map(x=>x.prediccion), name:'Predicción', text:data.map(x=>x.prediccion), textposition:'auto'},
      {type:'scatter', mode:'lines+markers', x:data.map(x=>displayZoneName(x.zona)), y:data.map(x=>x.indice), yaxis:'y2', name:'Índice riesgo'}
    ],{paper_bgcolor:'#fff',plot_bgcolor:'#fff',margin:{l:40,r:40,t:20,b:70},xaxis:{tickangle:-25},yaxis:{title:'Predicción'},yaxis2:{title:'Índice',overlaying:'y',side:'right',range:[0,100]}},{displayModeBar:false,responsive:true});
  }

  function renderPatrolRecommendations(){
    const box=document.getElementById('patrolRecList'); if(!box) return;
    const recs=state.analytics?.recommendations||[];
    box.innerHTML=recs.map(r=>`<div class="alert-item ${r.nivel==='Crítica'?'danger':r.nivel==='Alta'?'warn':'ok'}"><strong>${displayZoneName(r.zona)} · ${r.tipo}</strong><div class="small">Turno recomendado: ${r.turno} · Unidades sugeridas: ${r.unidades} · Permanencia: ${r.permanencia}</div><div class="small">${r.detalle}</div></div>`).join('') || '<div class="small">Sin datos analíticos.</div>';
  }

  const originalDrawMap=window.drawMap;
  window.drawMap=function(){
    if(typeof originalDrawMap==='function') originalDrawMap();
    if(!state.map) return;
    try{
      if(state.heatLayer){ state.map.removeLayer(state.heatLayer); state.heatLayer=null; }
      if(state.dynamicHotspotLayer){ state.map.removeLayer(state.dynamicHotspotLayer); state.dynamicHotspotLayer=null; }
    }catch(e){}
    ensureLeafletHeat(()=>{
      try{
        const heat=state.analytics?.heatPoints||[];
        if(heat.length && state.map){
          state.heatLayer=L.heatLayer(heat,{radius:28, blur:22, maxZoom:17, minOpacity:0.35}).addTo(state.map);
        }
      }catch(e){ console.warn('Heatmap no disponible',e); }
    });
    try{
      const features=(state.hotspots||[]).slice(0,20).map(h=>({type:'Feature',properties:h,geometry:{type:'Point',coordinates:[h.lon,h.lat]}}));
      state.dynamicHotspotLayer=L.geoJSON({type:'FeatureCollection',features},{pointToLayer:(f,latlng)=>L.circle(latlng,{radius:120 + ((f.properties.hotspot_score||0)*280), color:'#7f1d1d', weight:1.5, fillColor:'#ef4444', fillOpacity:0.08}).bindPopup(`<b>${f.properties.nombre}</b><br>Hotspot dinámico<br>Score: ${(f.properties.hotspot_score||0).toFixed(3)}<br>Riesgo: ${(f.properties.riesgo||0).toFixed(2)}<br>Tipo dominante: ${f.properties.tipo_dominante||'N/D'}`)}).addTo(state.map);
    }catch(e){ console.warn('Hotspots dinámicos no disponibles', e); }
  };

  const originalBuildAlerts=window.buildAlerts;
  window.buildAlerts=function(summary, hotspots, resources, riskThreshold, timeThreshold){
    const alerts=typeof originalBuildAlerts==='function' ? originalBuildAlerts(summary, hotspots, resources, riskThreshold, timeThreshold) : [];
    (state.analytics?.zoneRisk||[]).slice(0,5).forEach(z=>{
      if(z.indice>=75) alerts.unshift({level:'danger', title:`${displayZoneName(z.zona)} en nivel crítico`, detail:`Matriz ${z.probabilidad}×${z.impacto}=${z.matriz}. Predicción ${z.prediccion} incidentes próximos.`});
      else if(z.indice>=50) alerts.push({level:'warn', title:`${displayZoneName(z.zona)} prioritaria`, detail:`Índice ${z.indice} y tendencia delictiva al alza.`});
    });
    return alerts.slice(0,12);
  };

  window.buildAiRecommendations=function(summary, hotspots, resources){
    const out=[];
    (state.analytics?.recommendations||[]).forEach(r=>out.push({type:'deploy', from:null, to:r.zona, unidades:r.unidades, motivo:`${r.detalle} Patrullaje: ${r.tipo}, turno ${r.turno}.`}));
    if(!out.length) out.push({type:'ok', motivo:'No hay suficiente información para generar recomendación automática.'});
    return out;
  };

  window.renderAiRecommendations=function(){
    const box=document.getElementById('aiRecsList'); if(!box) return;
    const recs=state.aiRecs||[];
    box.innerHTML=recs.map(r=>`<div class="alert-item ${r.type==='ok'?'ok':r.type==='deploy'?'warn':'info'}"><strong>${r.to?displayZoneName(r.to):'Sistema'}</strong><div class="small">${r.motivo}</div></div>`).join('');
  };

  window.renderChart=function(){
    const chartEl=document.getElementById('turnoChart');
    if(!chartEl || !window.Plotly){
      renderPredictionChart();
      return;
    }
    const byTurno={};
    (state.summary||[]).forEach(r=>byTurno[r.turno]=(byTurno[r.turno]||0)+1);
    Plotly.newPlot('turnoChart',[{type:'bar',x:Object.keys(byTurno),y:Object.values(byTurno),text:Object.values(byTurno),textposition:'auto'}],{paper_bgcolor:'#fff',plot_bgcolor:'#fff',font:{color:'#1f2937'},margin:{l:40,r:10,t:20,b:40},yaxis:{title:'Unidades'},xaxis:{title:'Turno'}},{displayModeBar:false,responsive:true});
    renderPredictionChart();
  };



  function buildCommandActions(){
    const summary = Array.isArray(state.summary) ? state.summary : [];
    const alerts = Array.isArray(state.alerts) ? state.alerts : [];
    const voronoi = Array.isArray(state.voronoiPrepositioning) ? state.voronoiPrepositioning : [];
    const actions = [];

    const criticalZones = summary.filter(r => r && r.estado === 'Crítica');
    criticalZones.slice(0,3).forEach(r=>{
      actions.push({
        level:'critical',
        title:`Reforzar ${displayZoneName(r.zona)}`,
        desc:`Asignar refuerzo inmediato a ${displayZoneName(r.zona)}. La zona presenta estado crítico con ${r.eventos_cubiertos || 0} eventos y ${r.tiempo_total_min || 0} min estimados.`
      });
    });

    const warnZones = summary.filter(r => r && r.estado === 'Atención');
    if(warnZones.length){
      const z = warnZones[0];
      actions.push({
        level:'warn',
        title:`Revisar cobertura en ${displayZoneName(z.zona)}`,
        desc:`Validar si es necesario aumentar elementos o redistribuir waypoints para reducir tiempos y evitar que la zona escale a crítica.`
      });
    }

    if(alerts.length){
      actions.push({
        level:'critical',
        title:'Atender alertas activas',
        desc:`Existen ${alerts.length} alertas operativas activas. Prioriza las zonas con mayor severidad y confirma disponibilidad de unidades.`
      });
    }

    const weakVoronoi = voronoi.filter(v => v && ((v.etaMin ?? 0) > 10 || (v.postsRecommended ?? 0) > (v.currentPosts ?? 0)));
    if(weakVoronoi.length){
      const v = weakVoronoi[0];
      actions.push({
        level:'info',
        title:`Ajustar vigilancia fija en ${displayZoneName(v.zone || v.zona)}`,
        desc:`El análisis Voronoi sugiere mejorar la cobertura estacionaria. Evalúa incrementar puestos o reubicar uno existente para reducir la respuesta.`
      });
    }

    const optimalCount = summary.filter(r => r && r.estado === 'Óptima').length;
    if(summary.length && optimalCount === summary.length){
      actions.push({
        level:'info',
        title:'Mantener dispositivo actual',
        desc:'La cobertura actual se encuentra estable. Continúa monitoreo y conserva la distribución operativa vigente.'
      });
    }

    return actions.slice(0,4);
  }

  function renderCommandActions(){
    const el = document.getElementById('commandActions');
    if(!el) return;
    const actions = buildCommandActions();
    if(!actions.length){
      el.className = 'command-empty';
      el.innerHTML = 'No hay acciones sugeridas por el momento.';
      return;
    }
    el.className = 'command-actions';
    el.innerHTML = actions.map(a => `
      <div class="command-action ${a.level}">
        <div class="title">${a.title}</div>
        <div class="desc">${a.desc}</div>
      </div>
    `).join('');
  }


  function setExecutiveKpiColor(id, value){
    const el = document.getElementById(id);
    if(!el) return;
    if(value > 3){
      el.style.color = "#f87171";
    }else if(value > 0){
      el.style.color = "#fbbf24";
    }else{
      el.style.color = "#4ade80";
    }
  }

  function updateExecutiveKPIs(){
    const summary = Array.isArray(state.summary) ? state.summary : [];
    const alerts = Array.isArray(state.alerts) ? state.alerts : [];
    const routes = Array.isArray(state.routes) ? state.routes : [];
    const deployments = Array.isArray(state.deployments) ? state.deployments : [];
    const hotspots = Array.isArray(state.hotspots) ? state.hotspots : [];
    const incidents = Array.isArray(state.incidents) ? state.incidents : [];

    const criticalStates = new Set(['Crítica','Critica']);
    const warnStates = new Set(['Atención','Atencion']);
    const okStates = new Set(['Óptima','Optima','Cobertura','Punto fijo']);

    const critical = summary.filter(r => r && criticalStates.has(r.estado)).length
      || alerts.filter(a => a && /cr[ií]tic/i.test(`${a.title||''} ${a.message||''}`)).length
      || 0;

    const totalBase = summary.length || routes.length || deployments.length || hotspots.length || 0;
    const coveredBase = summary.filter(r => r && okStates.has(r.estado)).length
      || routes.length
      || deployments.length
      || 0;
    const coverage = totalBase > 0 ? Math.round((coveredBase / totalBase) * 100) : 0;

    const unitNames = new Set(
      summary
        .map(r => r && (r.unidad_a_emplear || r.unidad))
        .filter(Boolean)
    );
    const units = unitNames.size
      || summary.length
      || routes.length
      || deployments.length
      || 0;

    const derivedAlerts = summary.filter(r => r && (criticalStates.has(r.estado) || warnStates.has(r.estado))).length
      || hotspots.filter(h => h && Number(h.riesgo_total || h.riesgo || 0) > 0).length
      || incidents.length
      || 0;
    const alertCount = alerts.length || derivedAlerts;

    const kpiCritical = document.getElementById('kpiCritical');
    const kpiCoverage = document.getElementById('kpiCoverage');
    const kpiUnits = document.getElementById('kpiUnits');
    const kpiAlerts = document.getElementById('kpiAlerts');

    if(kpiCritical) kpiCritical.textContent = String(critical);
    if(kpiCoverage) kpiCoverage.textContent = `${coverage}%`;
    if(kpiUnits) kpiUnits.textContent = String(units);
    if(kpiAlerts) kpiAlerts.textContent = String(alertCount);

    setExecutiveKpiColor('kpiCritical', critical);
    setExecutiveKpiColor('kpiAlerts', alertCount);

    if(kpiCoverage){
      kpiCoverage.style.color = coverage < 60 ? "#f87171" : coverage < 85 ? "#fbbf24" : "#4ade80";
    }
    if(kpiUnits){
      kpiUnits.style.color = units === 0 ? "#f87171" : "#93c5fd";
    }
  }


  window.updateKPIs=function(){
    document.getElementById('kInc').textContent=state.incidents.length;
    document.getElementById('kHot').textContent=state.hotspots.length;
    document.getElementById('kRut').textContent=state.routes.length;
    document.getElementById('kQr').textContent=state.routes.length;
    document.getElementById('kAlert').textContent=state.alerts.length;
    const kVor=document.getElementById('kVor'); if(kVor) kVor.textContent=(state.staticPosts||[]).length;
    const kr=document.getElementById('kRisk'); if(kr) kr.textContent=(state.analytics?.topRisk||0).toFixed(1);
    const kp=document.getElementById('kPred'); if(kp) kp.textContent=String(state.analytics?.predTotal||0);
    if(typeof updateExecutiveKPIs==='function') updateExecutiveKPIs();
    if(typeof renderCommandActions==='function') renderCommandActions();
  };

  function refreshAnalyticsAndRender(){
    if(!state.incidents?.length) return;
    const resources=(typeof getResourcesFromUI==='function') ? getResourcesFromUI() : {};
    state.analytics=buildAnalytics(state.incidents,state.hotspots,resources);
    renderRiskZoneTable();
    renderPredictionChart();
    renderPatrolRecommendations();
    window.renderAiRecommendations();
    if(typeof updateKPIs==='function') updateKPIs();
    if(typeof renderAlerts==='function') renderAlerts();
    if(typeof drawMap==='function') drawMap();
  }
  window.refreshAnalyticsAndRender=refreshAnalyticsAndRender;

  const oldReadExcel=window.readExcel;
  window.readExcel=async function(file){
    const rows=await oldReadExcel(file);
    return rows.map(r=>({...r, tipo:getCrimeType(r), impacto_base:getCrimeSeverity(getCrimeType(r))}));
  };


  function assignElementsAllUnits(totalE,totalU,minE,maxE){
    const totalESafe=Math.max(0,toSafeInt(totalE,0));
    const totalUSafe=Math.max(0,toSafeInt(totalU,0));
    const maxESafe=Math.max(1,toSafeInt(maxE,4));
    if(totalUSafe<=0) return [];
    const arr=new Array(totalUSafe).fill(0);
    let rest=totalESafe;
    let idx=0;
    while(rest>0){
      if(arr[idx] < maxESafe){
        arr[idx] += 1;
        rest -= 1;
      }
      idx = (idx + 1) % totalUSafe;
      if(arr.every(v=>v>=maxESafe)) break;
    }
    return arr;
  }

  function dedupeMissionPoints(points){
    const seen=new Set();
    const out=[];
    (points||[]).forEach((p,idx)=>{
      if(!p || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lon))) return;
      const key=`${Number(p.lat).toFixed(6)}|${Number(p.lon).toFixed(6)}|${p.nombre||idx}`;
      if(seen.has(key)) return;
      seen.add(key);
      out.push({...p});
    });
    return out;
  }

  function getSectorForZoneOperational(zona){
    const features=(typeof getModelZoneFeatures==='function') ? getModelZoneFeatures(true) : (state.sectors||[]);
    return (features||[]).find(f=>normalizeZoneName(f.properties?.zona || f.properties?.ZONA || f.properties?.Name)===normalizeZoneName(zona)) || null;
  }

  function getPostsForZoneOperational(zona){
    return (state.staticPosts||[]).filter(p=>normalizeZoneName(p.zona)===normalizeZoneName(zona));
  }

  function pointFromStaticPost(post, zona, turno, tag='Punto fijo'){
    if(!post) return null;
    return {
      id:`POST-${normalizeZoneName(zona)}-${post.post_id}`,
      nombre:`${tag} ${post.post_id}`,
      zona:normalizeZoneName(zona),
      turno,
      lat:Number(post.lat),
      lon:Number(post.lon),
      riesgo:0.2,
      eventos:0,
      probabilidad:0.05,
      vector_name:post.post_id,
      patrol_kind:'post'
    };
  }

  function pointFromFeatureCenter(feature, zona, turno, label='Centro sector'){
    try{
      const pt=turf.pointOnFeature(feature);
      return {
        id:`CENTER-${normalizeZoneName(zona)}-${label}`,
        nombre:label,
        zona:normalizeZoneName(zona),
        turno,
        lat:Number(pt.geometry.coordinates[1]),
        lon:Number(pt.geometry.coordinates[0]),
        riesgo:0.15,
        eventos:0,
        probabilidad:0.04,
        vector_name:label,
        patrol_kind:'center'
      };
    }catch(e){
      return null;
    }
  }

  function vectorPointsForZoneOperational(zona, turno){
    const zoneVectors=(state.vectors||[]).filter(v=>normalizeZoneName(v.properties?.zona || v.properties?.ZONA || v.properties?.Name)===normalizeZoneName(zona));
    return zoneVectors.map((v,idx)=>{
      try{
        const pt=turf.pointOnFeature(v);
        const name=v.properties?.vector_name || v.properties?.Name || `Vector ${idx+1}`;
        return {
          id:`VECTOR-${normalizeZoneName(zona)}-${idx}`,
          nombre:`Patrullaje ${name}`,
          zona:normalizeZoneName(zona),
          turno,
          lat:Number(pt.geometry.coordinates[1]),
          lon:Number(pt.geometry.coordinates[0]),
          riesgo:0.18,
          eventos:0,
          probabilidad:0.05,
          vector_name:name,
          patrol_kind:'vector'
        };
      }catch(e){
        return null;
      }
    }).filter(Boolean);
  }

  function buildPreventivePointsOperational(zona, turno, unitIndex, maxWp, anchorPoint=null){
    const out=[];
    const posts=getPostsForZoneOperational(zona);
    const post=posts.length ? posts[unitIndex % posts.length] : null;
    const sector=getSectorForZoneOperational(zona);
    const vectors=vectorPointsForZoneOperational(zona, turno);

    if(anchorPoint) out.push({...anchorPoint});
    const postPoint=pointFromStaticPost(post, zona, turno, 'Punto fijo');
    if(postPoint) out.push(postPoint);

    vectors.forEach(v=> out.push(v));

    const centerPoint=sector ? pointFromFeatureCenter(sector, zona, turno, 'Centro preventivo') : null;
    if(centerPoint) out.push(centerPoint);

    if(sector){
      try{
        const randoms=turf.randomPoint(Math.max(4, maxWp*2), {bbox:turf.bbox(sector)}).features
          .filter(p=>pointInFeature(p, sector))
          .slice(0, Math.max(2, maxWp));
        randoms.forEach((p,idx)=>{
          out.push({
            id:`RAND-${normalizeZoneName(zona)}-${unitIndex}-${idx}`,
            nombre:`Recorrido preventivo ${idx+1}`,
            zona:normalizeZoneName(zona),
            turno,
            lat:Number(p.geometry.coordinates[1]),
            lon:Number(p.geometry.coordinates[0]),
            riesgo:0.1,
            eventos:0,
            probabilidad:0.03,
            vector_name:'Preventivo',
            patrol_kind:'random'
          });
        });
      }catch(e){}
    }

    const unique=dedupeMissionPoints(out);
    if(anchorPoint){
      unique.sort((a,b)=>haversineKm(anchorPoint.lat, anchorPoint.lon, a.lat, a.lon)-haversineKm(anchorPoint.lat, anchorPoint.lon, b.lat, b.lon));
      return unique.slice(0, Math.max(1, maxWp));
    }
    return unique.slice(0, Math.max(1, maxWp));
  }

  function buildMissionPointsOperational(zona, turno, hs, unitIndex, totalUnits, maxWp){
    const maxPoints=Math.max(1, toSafeInt(maxWp,4));
    const orderedHs=(hs||[]).slice().sort((a,b)=>{
      const scoreA=(Number(a.probabilidad)||0)*0.45 + (Number(a.riesgo)||0)*0.35 + (Number(a.eventos)||0)*0.20;
      const scoreB=(Number(b.probabilidad)||0)*0.45 + (Number(b.riesgo)||0)*0.35 + (Number(b.eventos)||0)*0.20;
      return scoreB-scoreA;
    });

    if(!orderedHs.length){
      const preventive=buildPreventivePointsOperational(zona, turno, unitIndex, maxPoints, null);
      const route=nearestNeighbor(preventive.slice(0,maxPoints));
      return {points:route, mission:route.length<=1?'punto_fijo':'patrullaje_preventivo'};
    }

    const seed=orderedHs[unitIndex % orderedHs.length];
    const sameVector=seed?.vector_name ? orderedHs.filter(h=>h.id!==seed.id && h.vector_name===seed.vector_name) : [];
    const others=orderedHs.filter(h=>h.id!==seed.id && (!seed.vector_name || h.vector_name!==seed.vector_name));

    const byDistance=(base,list)=>list.slice().sort((a,b)=>haversineKm(base.lat,base.lon,a.lat,a.lon)-haversineKm(base.lat,base.lon,b.lat,b.lon));
    let selected=[seed];
    byDistance(seed, sameVector).forEach(p=>{ if(selected.length<maxPoints && !selected.some(s=>s.id===p.id)) selected.push(p); });
    byDistance(seed, others).forEach(p=>{ if(selected.length<Math.max(2, maxPoints-1) && !selected.some(s=>s.id===p.id)) selected.push(p); });

    if(selected.length < Math.min(2, maxPoints)){
      const support=buildPreventivePointsOperational(zona, turno, unitIndex, maxPoints, seed);
      support.forEach(p=>{
        if(selected.length>=maxPoints) return;
        if(!selected.some(s=>(s.id && p.id && s.id===p.id) || (Math.abs(s.lat-p.lat)<1e-6 && Math.abs(s.lon-p.lon)<1e-6))) selected.push(p);
      });
    }

    selected=dedupeMissionPoints(selected).slice(0,maxPoints);
    const route=nearestNeighbor(selected);
    return {points:route, mission:route.length<=1?'punto_fijo':'ruta_hotspot'};
  }

  function buildRoutesOperational(hotspots, deployments, resources, maxWp, minElem, velKmh, minParada){
    const routes=[], summary=[];
    for(const d of (deployments||[])){
      const zona=normalizeZoneName(d.zona);
      const turno=d.turno;
      const totalUnits=Math.max(0,toSafeInt(d.unidades_asignadas,0));
      if(totalUnits<=0) continue;
      const hs=(hotspots||[]).filter(h=>normalizeZoneName(h.zona)===zona && h.turno===turno);
      const elems=assignElementsAllUnits(d.elementos_asignados, totalUnits, minElem, 4);
      const posts=getPostsForZoneOperational(zona).slice().sort((a,b)=>String(a.post_id||'').localeCompare(String(b.post_id||'')));
      const fixedSlots=[];
      if(posts.length){
        posts.forEach(post=>{
          if(fixedSlots.length < totalUnits) fixedSlots.push(post);
        });
      }

      for(let i=0;i<totalUnits;i++){
        const unit=`${zoneCode(zona)}-${String(turno).slice(0,2).toUpperCase()}-U${String(i+1).padStart(2,'0')}`;
        const elementosUnidad=elems[i]||0;
        let mission='patrullaje_preventivo';
        let ordered=[];

        const fixedPost=fixedSlots[i] || null;
        if(fixedPost){
          mission='punto_fijo_voronoi';
          ordered=dedupeMissionPoints([pointFromStaticPost(fixedPost, zona, turno, `Punto fijo ${fixedPost.post_id}`)]).slice(0,1);
        }else{
          const mobileIndex=Math.max(0, i - fixedSlots.length);
          const mobileUnits=Math.max(1, totalUnits - fixedSlots.length);
          const missionData=buildMissionPointsOperational(zona, turno, hs, mobileIndex, mobileUnits, maxWp);
          ordered=Array.isArray(missionData.points)?missionData.points:[];
          mission=missionData.mission || 'patrullaje_preventivo';
        }

        const cecoreRoute = applyCecoreToRoutePoints(zona, ordered);
        const routePoints = cecoreRoute.routePoints;
        const dist = calcDistanceKm(routePoints);
        const tiempoConduccion=routePoints.length>1 ? (dist/Math.max(5, Number(velKmh)||30))*60 : 0;
        const tiempoParadas=ordered.length*Math.max(1, Number(minParada)||5);
        const tiempoTotal=tiempoConduccion+tiempoParadas;
        const riskCovered=ordered.reduce((s,x)=>s+(Number(x.riesgo)||0),0);
        const eventsCovered=ordered.reduce((s,x)=>s+(Number(x.eventos)||0),0);
        const probCovered=ordered.reduce((s,x)=>s+(Number(x.probabilidad)||0),0);
        const routeMode=ordered.length<=1 ? 'punto_fijo' : (mission==='patrullaje_preventivo' ? 'patrullaje_preventivo' : 'ruta_movil');
        const url=routePoints.length>=2 ? makeGoogleMapsUrl(routePoints) : '';

        let estado='Patrullaje preventivo', estadoClase='ok';
        if(mission==='punto_fijo_voronoi'){
          estado='Punto fijo Voronoi';
          estadoClase='info';
        }else if(routeMode==='punto_fijo'){
          estado='Punto fijo';
          estadoClase='info';
        }else if(mission==='ruta_hotspot'){
          estado='Ruta por hotspot';
          estadoClase=tiempoTotal>90?'danger':(tiempoTotal>60?'warn':'ok');
        }else{
          estado='Patrullaje preventivo';
          estadoClase=tiempoTotal>90?'warn':'ok';
        }

        routes.push({
          zona, turno, unidad:unit, elementos_unidad:elementosUnidad,
          n_waypoints:ordered.length, eventos_cubiertos:eventsCovered,
          riesgo_cubierto:riskCovered, prob_cubierta:probCovered,
          distancia_km:Number(dist.toFixed(3)), tiempo_total_min:Number(tiempoTotal.toFixed(1)),
          google_maps_url:url,
          inicio_nombre:routePoints[0]?.nombre || 'Sin punto',
          inicio_lat:routePoints[0]?.lat ?? null,
          inicio_lon:routePoints[0]?.lon ?? null,
          fin_nombre:routePoints[routePoints.length-1]?.nombre || 'Sin punto',
          fin_lat:routePoints[routePoints.length-1]?.lat ?? null,
          fin_lon:routePoints[routePoints.length-1]?.lon ?? null,
          estado, estadoClase, route_mode:routeMode, mission_type:mission, points:routePoints,
          cecore_nombre:cecoreRoute.cecore?.nombre || '',
          cecore_lat:cecoreRoute.cecore?.lat ?? null,
          cecore_lon:cecoreRoute.cecore?.lon ?? null,
          operational_points:ordered,
          voronoi_post_id: fixedPost?.post_id || null
        });

        summary.push({
          unidad_a_emplear:unit, zona, turno, elementos_unidad:elementosUnidad,
          n_waypoints:ordered.length, eventos_cubiertos:eventsCovered,
          riesgo_cubierto:Number(riskCovered.toFixed(3)),
          prob_cubierta:Number(probCovered.toFixed(4)),
          distancia_km:Number(dist.toFixed(3)),
          tiempo_conduccion_min:Number(tiempoConduccion.toFixed(1)),
          tiempo_paradas_min:Number(tiempoParadas.toFixed(1)),
          tiempo_total_min:Number(tiempoTotal.toFixed(1)),
          tiempo_total_horas:Number((tiempoTotal/60).toFixed(2)),
          estado, route_mode:routeMode, mission_type:mission, google_maps_url:url,
          cecore_nombre:cecoreRoute.cecore?.nombre || '',
          voronoi_post_id: fixedPost?.post_id || null
        });
      }
    }
    return {routes, summary};
  }

  window.renderRoutesTable=function(){
    const table=document.getElementById('routesTable'); if(!table) return;
    const headers=['Unidad / Puesto','Zona','Turno / Tipo','Inicio / Posición','Fin / Referencia','Estado','QR','Google Maps'];

    const routeRows=(state.routes||[]).map((r,idx)=>{
      const estadoTxt=r.voronoi_post_id ? `${r.estado||'Sin estado'} · ${r.voronoi_post_id}` : (r.estado||'Sin estado');
      return `<tr>
        <td>${r.unidad}</td>
        <td>${displayZoneName(r.zona)}</td>
        <td><span class="pill">${r.turno}</span></td>
        <td>${r.inicio_nombre}</td>
        <td>${r.fin_nombre}</td>
        <td><span class="pill ${r.estadoClase||'info'}">${estadoTxt}</span></td>
        <td><button class="ghost" onclick="showQr(${idx})">Ver QR</button></td>
        <td>${r.google_maps_url?`<a href="${r.google_maps_url}" target="_blank" rel="noopener noreferrer">Abrir ruta</a>`:'<span class="muted">No aplica</span>'}</td>
      </tr>`;
    });

    const postRows=(state.staticPosts||[]).map((p,idx)=>{
      const mapsUrl=`https://www.google.com/maps?q=${Number(p.lat).toFixed(6)},${Number(p.lon).toFixed(6)}`;
      return `<tr>
        <td>${p.post_id}</td>
        <td>${displayZoneName(p.zona)}</td>
        <td><span class="pill info">Puesto fijo Voronoi</span></td>
        <td>${Number(p.lat).toFixed(6)}, ${Number(p.lon).toFixed(6)}</td>
        <td>Cobertura ${p.coverage_km} km</td>
        <td><span class="pill info">ETA ${p.eta_max_min} min · ${p.unidades_sugeridas} unidad(es)</span></td>
        <td><button class="ghost" onclick="showStaticPostQr(${idx})">Ver QR</button></td>
        <td><a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">Abrir ubicación</a></td>
      </tr>`;
    });

    const rows=routeRows.concat(postRows).join('');
    table.innerHTML=`<thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody>`;
  };

  assignElements = assignElementsAllUnits;
buildRoutes = buildRoutesOperational;

state.currentScope = document.getElementById('scopeSelector')?.value || state.currentScope || 'municipio';
if(typeof window.forceRenderResources==='function'){
  window.forceRenderResources(getDefaultResourceMap());
}else if(typeof renderFixedResourceModule==='function'){
  renderFixedResourceModule(getDefaultResourceMap());
}

const loadTestResourcesBtn=document.getElementById('loadTestResourcesBtn');
if(loadTestResourcesBtn){
  loadTestResourcesBtn.addEventListener('click', ()=>{
    const scopeSelector=document.getElementById('scopeSelector');
    state.currentScope = scopeSelector?.value || state.currentScope || 'municipio';
    const preset = (typeof getScopeTestResourcePresets==='function')
      ? getScopeTestResourcePresets()
      : (state.currentScope==='estado' ? getZeroResourcePresets() : (typeof TEST_RESOURCE_PRESETS!=='undefined' ? TEST_RESOURCE_PRESETS : getZeroResourcePresets()));
    if(typeof applyResourcePreset==='function'){
      applyResourcePreset(preset);
    }
    if(typeof renderFixedResourceModule==='function'){
      renderFixedResourceModule(preset);
    }
    if(typeof syncResourceTextarea==='function'){
      syncResourceTextarea();
    }
  });
}

const clearTestResourcesBtn=document.getElementById('clearTestResourcesBtn');
if(clearTestResourcesBtn){
  clearTestResourcesBtn.addEventListener('click', clearResourcePreset);
}

const scopeSelector=document.getElementById('scopeSelector');
if(scopeSelector){
  scopeSelector.value = state.currentScope || 'municipio';
  scopeSelector.addEventListener('change', ()=>{
    if(typeof window.applyScopeVisualMode==='function'){
      window.applyScopeVisualMode();
    }
  });
}

injectAnalyticsUI();
  const oldRunAi=document.getElementById('runAiBtn');
  if(oldRunAi){ oldRunAi.onclick=()=>{ refreshAnalyticsAndRender(); state.aiRecs=buildAiRecommendations(state.summary,state.hotspots,getResourcesFromUI()); renderAiRecommendations(); }; }

  const startSimBtn=document.getElementById('startSimBtn');
  if(startSimBtn){ startSimBtn.addEventListener('click', ()=>{ if(typeof startSimulation==='function') startSimulation(); }); }
  const pauseSimBtn=document.getElementById('pauseSimBtn');
  if(pauseSimBtn){ pauseSimBtn.addEventListener('click', ()=>{ if(typeof stopSimulation==='function') stopSimulation(false); const simStatus=document.getElementById('simStatus'); if(simStatus) simStatus.textContent='Simulación pausada.'; }); }
  const resetSimBtn=document.getElementById('resetSimBtn');
  if(resetSimBtn){ resetSimBtn.addEventListener('click', ()=>{ if(typeof resetSimulation==='function') resetSimulation(); }); }
})();


  document.addEventListener('DOMContentLoaded', ()=>{
    if(typeof updateExecutiveKPIs==='function') updateExecutiveKPIs();
    if(typeof renderCommandActions==='function') renderCommandActions();
  });


// force CECORE markers on selector change
setTimeout(()=>{
  const scopeSelector = document.getElementById('scopeSelector');
  if(scopeSelector && !scopeSelector.dataset.cecoreBound){
    scopeSelector.dataset.cecoreBound = '1';
    scopeSelector.addEventListener('change', ()=>{
      setTimeout(()=>{ if(typeof window.renderCecoresOnStateMap==='function') window.renderCecoresOnStateMap(); }, 100);
    });
  }
  if(typeof window.renderCecoresOnStateMap==='function') window.renderCecoresOnStateMap();
}, 300);


// CECORE visible redraw hook final
setTimeout(function(){
  const scopeSelector=document.getElementById('scopeSelector');
  if(scopeSelector && !scopeSelector.dataset.cecoreVisibleHookFinal){
    scopeSelector.dataset.cecoreVisibleHookFinal='1';
    scopeSelector.addEventListener('change',function(){
      setTimeout(function(){ if(typeof window.renderCecoresOnStateMap==='function') window.renderCecoresOnStateMap(); },250);
      setTimeout(function(){ if(typeof window.renderCecoresOnStateMap==='function') window.renderCecoresOnStateMap(); },1000);
    });
  }
  if(typeof window.renderCecoresOnStateMap==='function') window.renderCecoresOnStateMap();
},1000);

// ================= INGESTA =================
async function readExcel(file){
  const buf=await file.arrayBuffer(); const wb=XLSX.read(buf,{type:'array'}); const ws=wb.Sheets[wb.SheetNames[0]]; const rows=XLSX.utils.sheet_to_json(ws,{defval:null});
  return rows.map(r=>{ const lat=Number(r.Latitud ?? r.lat ?? r.LATITUD); const lon=Number(r.Longitud ?? r.lon ?? r.LONGITUD); const hora=parseHoraToHour(r.HORA ?? r.Hora ?? r.hora); const fecha=r.Fecha?new Date(r.Fecha):null; return {...r,lat,lon,hora,turno:getTurno(hora),fecha,colonia:r.Colonia??r.colonia??'SIN_DATO',municipio:r.Municipio??r.municipio??''}; }).filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lon)&&r.lat>18.8&&r.lat<19.3&&r.lon<-98.0&&r.lon>-98.4);
}

const ZONE_CANONICAL_ORDER = ['ZONA 1','ZONA 2','ZONA 3','ZONA 4','ZONA 5','ZONA 6','ZONA 7','ZONA 8','ZONA 9','ZONA 10','ZONA CH'];

function buildZoneAliasMap(){
  const aliases = new Map();
  ZONE_CANONICAL_ORDER.forEach(z=>{
    const upper = z.toUpperCase();
    aliases.set(upper, z);
    if(/^ZONA\s+\d+$/.test(upper)){
      const num = upper.match(/(\d+)/)[1];
      aliases.set(num, z);
      aliases.set(`ZONA${num}`, z);
      aliases.set(`ZONA ${num}`, z);
      aliases.set(`SECTOR ${num}`, z);
      aliases.set(`SECTOR${num}`, z);
      aliases.set(`REGION ${num}`, z);
      aliases.set(`REGION${num}`, z);
    }
  });
  ['CENTRO HISTORICO','CENTRO HISTÓRICO','ZONA CH','CH','CENTRO','CENTRO HIST','CENTRO HISTORICO PUEBLA','CENTRO HISTÓRICO PUEBLA'].forEach(a=>aliases.set(a,'ZONA CH'));
  return aliases;
}
const ZONE_ALIAS_MAP = buildZoneAliasMap();

function sanitizeZoneToken(value){
  return (value ?? '')
    .toString()
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[_\-]+/g,' ')
    .replace(/\s+/g,' ');
}
function normalizeZoneName(name){
  const raw = sanitizeZoneToken(name);
  if(!raw) return null;
  if(ZONE_ALIAS_MAP.has(raw)) return ZONE_ALIAS_MAP.get(raw);
  const mZona = raw.match(/(?:^|\s)ZONA\s*(\d+)(?:\s|$)/) || raw.match(/^(\d+)$/);
  if(mZona){
    const num = parseInt(mZona[1],10);
    if(num >= 1 && num <= 10) return `ZONA ${num}`;
  }
  const mVector = raw.match(/^VP\s*(\d{3})$/) || raw.match(/^VP\-(\d{3})$/) || raw.match(/^VP\s*(\d)/) || raw.match(/^VP\-(\d)/);
  if(mVector){
    const num = parseInt(String(mVector[1])[0],10);
    if(num >= 1 && num <= 10) return `ZONA ${num}`;
  }
  if(/^CH(?:\s|\-|$)/.test(raw) || /CENTRO HIST/.test(raw)) return 'ZONA CH';
  return raw;
}
function extractZoneNameFromFeature(ft, fallback=''){
  const props = ft?.properties || {};
  const sourceLayer = sanitizeZoneToken(props.source_layer || props.sourceLayer || '');
  const candidates = [props.zona, props.zona_label, props.ZONA, props.REGION, props.Name, props.name, fallback];
  for(const candidate of candidates){
    const normalized = normalizeZoneName(candidate);
    if(normalized) return normalized;
  }
  const rawName = sanitizeZoneToken(props.Name || props.name || fallback || '');
  if(sourceLayer.includes('VECTORES DE PROXIMIDAD')){
    const m = rawName.match(/^VP\s*(\d{3})$/) || rawName.match(/^VP\-(\d{3})$/) || rawName.match(/^VP\s*(\d)/) || rawName.match(/^VP\-(\d)/);
    if(m){
      const num = parseInt(String(m[1])[0],10);
      if(num >= 1 && num <= 10) return `ZONA ${num}`;
    }
    if(/^CH(?:\s|\-|$)/.test(rawName)) return 'ZONA CH';
  }
  return normalizeZoneName(rawName || fallback);
}
function buildZoneCatalog(...collections){
  const set = new Set();
  collections.flat().forEach(item=>{
    if(!item) return;
    let zone = null;
    if(typeof item === 'string') zone = normalizeZoneName(item);
    else if(item.properties) zone = extractZoneNameFromFeature(item);
    else if(item.nombre || item.name) zone = normalizeZoneName(item.nombre || item.name);
    else if(item.zona) zone = normalizeZoneName(item.zona);
    if(zone) set.add(zone);
  });
  const catalog = Array.from(set);
  const ordered = [];
  ZONE_CANONICAL_ORDER.forEach(z=>{ if(catalog.includes(z)) ordered.push(z); });
  catalog.filter(z=>!ordered.includes(z)).sort((a,b)=>zoneSortValue(a)-zoneSortValue(b)).forEach(z=>ordered.push(z));
  return ordered;
}
function getBackendZoneFeatures(){
  return (state.backendZones||[])
    .filter(z=>z && z.geometry_geojson && (z.geometry_geojson.type==='Polygon' || z.geometry_geojson.type==='MultiPolygon'))
    .map(z=>({
      type:'Feature',
      properties:{
        ...(z.properties||{}),
        id: z.id ?? z.id_zona ?? null,
        nombre: normalizeZoneName(z.nombre || z.name) || z.nombre || z.name,
        name: normalizeZoneName(z.nombre || z.name) || z.nombre || z.name,
        zona: normalizeZoneName(z.nombre || z.name) || z.nombre || z.name,
        zona_label: normalizeZoneName(z.nombre || z.name) || z.nombre || z.name,
        tipo: z.tipo || 'Zona API',
        nivel_riesgo: z.nivel_riesgo || 'Medio',
        source_layer: 'FASTAPI_ZONAS'
      },
      geometry: z.geometry_geojson
    }));
}
function getModelZoneFeatures(preferBackend=true){
  const backend = getBackendZoneFeatures();
  if(preferBackend && backend.length) return backend;
  return (state.sectors||[]).filter(f=>f?.geometry);
}
function getModelZoneCatalog(resourcesObj){
  const backendNames = (state.backendZones||[])
    .map(z=>normalizeZoneName(z.nombre || z.name || z.zona))
    .filter(Boolean);
  if(backendNames.length){
    return buildZoneCatalog(backendNames, Object.keys(resourcesObj||{}));
  }
  return buildZoneCatalog(state.sectors||[], state.vectors||[], Object.keys(resourcesObj||{}), state.backendZones||[]);
}

async function readGeoJsonFiles(fileList, fallbackFeatures=[]){
  if(!fileList || !fileList.length) return JSON.parse(JSON.stringify(fallbackFeatures));
  const out=[];
  for(const f of fileList){
    const txt=await f.text();
    const gj=JSON.parse(txt);
    const features=gj.type==='FeatureCollection'?gj.features:[gj];
    features.forEach((ft,idx)=>{
      const props={...(ft.properties||{})};
      const rawName = extractZoneNameFromFeature({properties:props}, f.name.replace(/\.(geojson|json)$/i,'')) || props.zona || props.ZONA || props.Name || props.REGION || f.name.replace(/\.(geojson|json)$/i,'');
      const derived = normalizeZoneName(rawName) || (idx < 10 ? `ZONA ${idx+1}` : 'ZONA CH');
      props.zona = derived;
      props.zona_label = derived;
      out.push({type:'Feature',properties:props,geometry:ft.geometry});
    });
  }
  return out;
}

function syncResourceTextarea(resources){
  const ordered = {};
  FIXED_RESOURCE_ZONES.forEach(z=>{
    const nz = normalizeZoneName(z);
    ordered[nz] = resources[nz] || {"unidades":0,"elementos":0};
  });
  const box = document.getElementById('resourceJson');
  if(box) box.value = JSON.stringify(ordered, null, 2);

  const rows = document.querySelectorAll('#resourceRows .resource-input');
  rows.forEach(inp=>{
    const zone = normalizeZoneName(inp.dataset.zone);
    const field = inp.dataset.field;
    const val = Number(ordered[zone]?.[field] || 0);
    if(String(inp.value) != String(val)) inp.value = val;
  });
}
function ensureResourceCoverage(resources, hotspots, minElem){
  const out = JSON.parse(JSON.stringify(resources||{}));
  const activeZones = [...new Set((hotspots||[]).map(h=>normalizeZoneName(h.zona)).filter(Boolean))];
  activeZones.forEach(z=>{
    const u = toSafeInt(out[z]?.unidades, 0);
    const e = toSafeInt(out[z]?.elementos, 0);
    if(u <= 0 || e < minElem){
      out[z] = {
        unidades: Math.max(2, u || 0),
        elementos: Math.max(minElem * 2, e || 0)
      };
    }
  });
  return out;
}

function buildDeployments(hotspots, resources, minElem){
  const rows=[];
  const minElemSafe=Math.max(1,toSafeInt(minElem,2));
  const zoneCatalog = (state && Array.isArray(state.zoneCatalog) && state.zoneCatalog.length)
    ? state.zoneCatalog
    : [...new Set((hotspots||[]).map(h=>h.zona).filter(Boolean))];

  for(const zona of zoneCatalog){
    const totalU=toSafeInt(resources?.[String(zona)]?.unidades,0);
    const totalE=toSafeInt(resources?.[String(zona)]?.elementos,0);
    const operables=Math.max(0, Math.min(totalU, Math.floor(totalE/minElemSafe)));

    const riskByTurn=['madrugada','mañana','tarde','noche'].map(turno=>({
      turno,
      riesgo:(hotspots||[])
        .filter(h=>h.zona===zona && h.turno===turno)
        .reduce((s,x)=>s+(Number(x.riesgo)||0),0)
    }));

    let unitsAssigned = riskByTurn.map(x=>({...x, unidades:0}));

    if(operables > 0){
      // Cobertura mínima: al menos 1 unidad base en la zona, aunque el riesgo sea bajo.
      const strongest = [...riskByTurn].sort((a,b)=>(b.riesgo||0)-(a.riesgo||0))[0];
      const baseTurn = (strongest && strongest.riesgo > 0) ? strongest.turno : 'mañana';
      const baseIdx = unitsAssigned.findIndex(x=>x.turno===baseTurn);
      if(baseIdx >= 0) unitsAssigned[baseIdx].unidades = 1;

      let remaining = Math.max(0, operables - 1);
      if(remaining > 0){
        let totalRisk = riskByTurn.reduce((s,x)=>s+x.riesgo,0);
        if(!(totalRisk > 0)) totalRisk = riskByTurn.length;

        let extra = riskByTurn.map(x=>({
          ...x,
          unidades: Math.floor((((x.riesgo>0?x.riesgo:1))/totalRisk) * remaining)
        }));

        let assigned = extra.reduce((s,x)=>s+x.unidades,0);
        while(assigned < remaining && extra.length){
          extra.sort((a,b)=>(b.riesgo||0)-(a.riesgo||0));
          extra[0].unidades += 1;
          assigned++;
        }
        while(assigned > remaining && extra.length){
          extra.sort((a,b)=>(b.unidades||0)-(a.unidades||0));
          const idx = extra.findIndex(x=>x.unidades>0);
          if(idx === -1) break;
          extra[idx].unidades -= 1;
          assigned--;
        }

        unitsAssigned = unitsAssigned.map(u=>{
          const add = extra.find(e=>e.turno===u.turno)?.unidades || 0;
          return {...u, unidades:u.unidades + add};
        });
      }
    }

    const assignedTotal = unitsAssigned.reduce((s,x)=>s+x.unidades,0);
    for(const row of unitsAssigned){
      const elementos = assignedTotal>0
        ? Math.max(0, Math.round(totalE*(row.unidades/assignedTotal)))
        : 0;

      rows.push({
        zona,
        turno:row.turno,
        unidades_asignadas:toSafeInt(row.unidades,0),
        elementos_asignados:toSafeInt(elementos,0),
        riesgo_turno:Number(row.riesgo)||0
      });
    }
  }
  return rows;
}
function assignElements(totalE,totalU,minE,maxE){
  const totalESafe=Math.max(0,toSafeInt(totalE,0));
  const totalUSafe=Math.max(0,toSafeInt(totalU,0));
  const minESafe=Math.max(1,toSafeInt(minE,2));
  const maxESafe=Math.max(minESafe,toSafeInt(maxE,4));
  if(!Number.isFinite(totalUSafe)||totalUSafe<=0) return [];
  const arr=new Array(totalUSafe).fill(0);
  let rest=totalESafe;
  let i=0;
  while(rest>0&&totalUSafe>0){
    if(arr[i]<maxESafe){ arr[i]++; rest--; }
    i=(i+1)%totalUSafe;
    if(arr.every(v=>v>=maxESafe)) break;
  }
  return arr;
}
function nearestNeighbor(points){ if(points.length<=1) return points.slice(); const pool=points.slice().sort((a,b)=>b.probabilidad-a.probabilidad); const route=[pool.shift()]; while(pool.length){ const last=route[route.length-1]; let bestIdx=0,bestD=Infinity; pool.forEach((p,idx)=>{ const d=haversineKm(last.lat,last.lon,p.lat,p.lon); if(d<bestD){bestD=d;bestIdx=idx;} }); route.push(pool.splice(bestIdx,1)[0]); } return route; }
function makeGoogleMapsUrl(points){ if(!points.length) return ''; const origin=`${points[0].lat},${points[0].lon}`; const dest=`${points[points.length-1].lat},${points[points.length-1].lon}`; const inner=points.slice(1,-1).map(p=>`${p.lat},${p.lon}`).join('|'); let url=`https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}`; if(inner) url+=`&waypoints=${encodeURIComponent(inner)}`; return url; }
function routeStatus(tMin, risk, nWp){ if((Number(nWp)||0)<=1) return {label:'Punto fijo', cls:'info'}; if(tMin>90) return {label:'Crítica', cls:'danger'}; if(tMin>60 || risk<1.2) return {label:'Atención', cls:'warn'}; return {label:'Óptima', cls:'ok'}; }
function clearLayers(){ [state.sectorLayer,state.vectorLayer,state.hotspotLayer,state.routeLayer,state.markerLayer,state.simLayer,state.voronoiLayer,state.staticPostLayer].forEach(l=>{ if(l) state.map.removeLayer(l); }); }
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

function renderChart(){ const chartEl=document.getElementById('turnoChart'); if(!chartEl || !window.Plotly) return; const byTurno={}; state.summary.forEach(r=>byTurno[r.turno]=(byTurno[r.turno]||0)+1); Plotly.newPlot('turnoChart',[{type:'bar',x:Object.keys(byTurno),y:Object.values(byTurno),text:Object.values(byTurno),textposition:'auto',marker:{color:'#113a6b'}}],{paper_bgcolor:'#fff',plot_bgcolor:'#fff',font:{color:'#1f2937'},margin:{l:40,r:10,t:20,b:40},yaxis:{title:'Unidades'},xaxis:{title:'Turno'}},{displayModeBar:false,responsive:true}); }
function renderAlerts(){ const box=document.getElementById('alertsList'); if(!box) return; box.innerHTML=state.alerts.map(a=>`<div class="alert-item ${a.level}"><strong>${a.title}</strong><div class="small">${a.detail}</div></div>`).join(''); }
function renderAiRecommendations(){ const box=document.getElementById('aiRecommendations'); if(!box) return; box.innerHTML=state.aiRecs.map(r=>`<div class="route-chip"><strong>${r.type==='move'?'Redistribución':r.type==='optimize'?'Optimización':'Estado'}</strong><div class="small">${r.motivo}</div></div>`).join(''); }
function updateKPIs(){ document.getElementById('kInc').textContent=state.incidents.length; document.getElementById('kHot').textContent=state.hotspots.length; document.getElementById('kRut').textContent=state.routes.length; document.getElementById('kQr').textContent=state.routes.length; document.getElementById('kAlert').textContent=state.alerts.length; const kVor=document.getElementById('kVor'); if(kVor) kVor.textContent=(state.staticPosts||[]).length; }
function download(filename,text,mime='text/plain;charset=utf-8'){ const blob=new Blob([text],{type:mime}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href); }

// ================= EVENTS =================
document.getElementById('runBtn').onclick=async()=>{
  try{
    const excelFile=document.getElementById('excelFile').files[0]; const vectorFiles=Array.from(document.getElementById('vectorFiles')?.files||[]);
    if(!excelFile) throw new Error('Carga el Excel de homicidios.');
    state.currentScope = document.getElementById('scopeSelector')?.value || state.currentScope || 'municipio';
    if(state.currentScope==='estado' && state.map && state.apiZoneLayer){ try{ state.map.removeLayer(state.apiZoneLayer); }catch(e){} state.apiZoneLayer=null; }
    const resources=getResourcesFromUI();
    const maxWp=Math.max(3,Math.min(12,toSafeInt(document.getElementById('maxWp').value||6,6)));
    const minElem=Math.max(1,Math.min(6,toSafeInt(document.getElementById('minElem').value||2,2)));
    const velKmh=Math.max(5,Math.min(80,Number(document.getElementById('velocidad').value||24)||24));
    const minParada=Math.max(1,Math.min(20,Number(document.getElementById('minParada').value||4)||4));
    const riskThreshold=Math.max(1, Number(document.getElementById('riskThreshold').value||8)||8);
    const timeThreshold=Math.max(10, Number(document.getElementById('timeThreshold').value||60)||60);

    document.getElementById('runBtn').textContent='Procesando...'; document.getElementById('runBtn').disabled=true;
    state.incidents=await readExcel(excelFile);
    const backendOrDefaultSectors=getModelZoneFeatures(true);
    state.vectors=await readGeoJsonFiles(vectorFiles, state.currentScope==='estado' ? [] : defaultVectorFeatures());
    state.sectors=backendOrDefaultSectors.length ? backendOrDefaultSectors : defaultSectorFeatures();
    state.zoneCatalog=getModelZoneCatalog(resources||{});
    buildZoneColorMap();
    if(typeof window.applyScopeVisualMode==='function') window.applyScopeVisualMode(true);
    state.incidents=sectorizeIncidents(state.incidents,state.sectors);
    state.hotspots=buildHotspots(state.incidents);
    if(!state.hotspots.length) throw new Error('No se generaron hotspots. Revisa si los incidentes caen dentro de los sectores.');
    let effectiveResources = ensureResourceCoverage(resources, state.hotspots, minElem);
    syncResourceTextarea(effectiveResources);
    state.deployments=buildDeployments(state.hotspots, effectiveResources, minElem);
    let result=buildRoutes(state.hotspots,state.deployments,effectiveResources,maxWp,minElem,velKmh,minParada);
    state.routes=result.routes||[]; state.summary=result.summary||[];
    if(!state.routes.length){
      effectiveResources = ensureResourceCoverage(effectiveResources, state.hotspots, 1);
      syncResourceTextarea(effectiveResources);
      state.deployments=buildDeployments(state.hotspots, effectiveResources, 1);
      result=buildRoutes(state.hotspots,state.deployments,effectiveResources,maxWp,1,velKmh,minParada);
      state.routes=result.routes||[]; state.summary=result.summary||[];
    }
    if(!state.routes.length) throw new Error('No se generaron rutas aun con recursos sugeridos. Revisa los datos de zonas o la captura del Excel.');
    state.alerts=buildAlerts(state.summary,state.hotspots,resources,riskThreshold,timeThreshold);
    state.aiRecs=buildAiRecommendations(state.summary,state.hotspots,resources);
    buildVoronoiPrepositioning(getModelZoneFeatures(true), state.incidents, effectiveResources);
    state.processDate=nowStamp(); if(!state.folio) state.folio=generarFolio(); updateMetaPanel();
    updateKPIs(); drawMap(); renderSummaryTable(); renderRoutesTable(); renderChart(); renderAlerts(); renderAiRecommendations(); renderVoronoiPanel();
    setTimeout(() => {
      if(typeof updateKPIs==='function') updateKPIs();
      if(typeof updateExecutiveKPIs==='function') updateExecutiveKPIs();
      if(typeof renderCommandActions==='function') renderCommandActions();
    }, 0);
    ['exportRoutesBtn','exportSummaryBtn','exportPdfBtn','startSimBtn','pauseSimBtn','resetSimBtn','runAiBtn'].forEach(id=>{ const el=document.getElementById(id); if(el) el.disabled=false; });
  }catch(err){ console.error(err); alert('Error: '+err.message); }
  finally{ document.getElementById('runBtn').textContent='Procesar'; document.getElementById('runBtn').disabled=false; }
};



function displayZoneName(z){
  return normalizeZoneName(z) || (z || '');
}
function zoneSortValue(z){
  const nz = normalizeZoneName(z);
  if(!nz) return 9999;
  const activeOrder = (typeof getActiveZoneCanonicalOrder==='function') ? getActiveZoneCanonicalOrder() : ZONE_CANONICAL_ORDER;
  const idx = activeOrder.indexOf(nz);
  if(idx >= 0) return idx + 1;
  const m = String(nz).match(/ZONA\s*(\d+)|REGION\s*(\d+)/);
  return m ? parseInt(m[1] || m[2],10) : 998;
}
function zoneCode(z){
  const nz = normalizeZoneName(z);
  if(nz === 'ZONA CH') return 'CH';
  const m = String(nz || '').match(/ZONA\s*(\d+)|REGION\s*(\d+)/);
  if(m) return `Z${String(parseInt(m[1] || m[2],10)).padStart(2,'0')}`;
  const clean = String(nz||'ZN').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  return clean.slice(0,4) || 'ZN';
}

const TEST_RESOURCE_PRESETS = normalizeResourceMap({
  "ZONA 1": {unidades: 14, elementos: 80},
  "ZONA 2": {unidades: 17, elementos: 86},
  "ZONA 3": {unidades: 16, elementos: 97},
  "ZONA 4": {unidades: 29, elementos: 135},
  "ZONA 5": {unidades: 33, elementos: 181},
  "ZONA 6": {unidades: 22, elementos: 68},
  "ZONA 7": {unidades: 22, elementos: 81},
  "ZONA 8": {unidades: 21, elementos: 85},
  "ZONA 9": {unidades: 41, elementos: 64},
  "ZONA 10": {unidades: 12, elementos: 48},
  "CENTRO HISTÓRICO": {unidades: 10, elementos: 40}
});


function getScopeKey(){
  return (state?.currentScope || document.getElementById('scopeSelector')?.value || 'municipio') === 'estado' ? 'estado' : 'municipio';
}
function getMunicipioTestResourcePresets(){
  return (typeof TEST_RESOURCE_PRESETS!=='undefined' && TEST_RESOURCE_PRESETS)
    ? normalizeResourceMap(TEST_RESOURCE_PRESETS)
    : getZeroResourcePresets();
}
function getEstadoTestResourcePresets(){
  const zones = (typeof getFixedResourceZones==='function' ? getFixedResourceZones() : []).filter(Boolean);
  const preset = {};
  zones.forEach((z, idx)=>{
    preset[z] = {
      unidades: (idx % 4) + 1,
      elementos: ((idx % 4) + 1) * 6
    };
  });
  return normalizeResourceMap(preset);
}
function getScopeTestResourcePresets(){
  const scope = document.getElementById('scopeSelector')?.value || state?.currentScope || 'municipio';
  return scope === 'estado' ? getEstadoTestResourcePresets() : getMunicipioTestResourcePresets();
}
function storeResourcesForCurrentScope(resourceMap){
  if(!state.resourceStoreByScope) state.resourceStoreByScope = { municipio:null, estado:null };
  state.resourceStoreByScope[getScopeKey()] = normalizeResourceMap(resourceMap || {});
}
function getStoredResourcesForScope(scopeKey){
  const zero = getZeroResourcePresets();
  const saved = state?.resourceStoreByScope?.[scopeKey];
  if(saved && Object.keys(saved).length){
    return {...zero, ...normalizeResourceMap(saved)};
  }
  return {...zero};
}

function getActiveZones(){
  if(typeof getActiveZoneCanonicalOrder==='function'){
    return getActiveZoneCanonicalOrder();
  }
  return Array.isArray(ZONE_CANONICAL_ORDER) ? ZONE_CANONICAL_ORDER.slice() : [];
}

function getFixedResourceZones(){
  const active = getActiveZones();
  if(Array.isArray(active) && active.length) return active.slice();
  return (typeof getActiveZoneCanonicalOrder==='function') ? getActiveZoneCanonicalOrder() : (Array.isArray(ZONE_CANONICAL_ORDER) ? ZONE_CANONICAL_ORDER.slice() : []);
}
function getZeroResourcePresets(){
  return normalizeResourceMap(getFixedResourceZones().reduce((acc, z)=>{ acc[z] = {unidades:0, elementos:0}; return acc; }, {}));
}

function getDefaultResourceMap(){
  const scopeKey = getScopeKey();
  const box = document.getElementById('resourceJson');
  const stored = getStoredResourcesForScope(scopeKey);
  try{
    const parsed = normalizeResourceMap(JSON.parse(box?.value || '{}'));
    if(Object.keys(parsed).length){
      const merged = {...stored, ...parsed};
      storeResourcesForCurrentScope(merged);
      return merged;
    }
    return stored;
  }catch(e){
    return stored;
  }
}

function renderFixedResourceModule(resources){
  const rows = document.getElementById('resourceRows');
  if(!rows) return;
  const data = normalizeResourceMap(resources || getDefaultResourceMap());
  rows.innerHTML = getFixedResourceZones().map(z=>{
    const item = data[z] || {unidades:0, elementos:0};
    const unidades = Number(item.unidades || 0);
    const elementos = Number(item.elementos || 0);
    return `<div class="resource-row">
      <div class="resource-zone-name">${z}</div>
      <div><input type="number" min="0" step="1" class="resource-input" data-zone="${z}" data-field="unidades" value="${unidades}"></div>
      <div><input type="number" min="0" step="1" class="resource-input" data-zone="${z}" data-field="elementos" value="${elementos}"></div>
    </div>`;
  }).join('');
  rows.querySelectorAll('.resource-input').forEach(inp=>{
    const sync = ()=> syncResourceTextareaFromInputs();
    inp.addEventListener('input', sync);
    inp.addEventListener('change', sync);
  });
  syncResourceTextareaFromInputs();
}

function getResourcesFromUI(){
  const out = {};
  const inputs = document.querySelectorAll('#resourceRows .resource-input');
  inputs.forEach(inp=>{
    const zone = normalizeZoneName(inp.dataset.zone);
    const field = inp.dataset.field;
    if(!out[zone]) out[zone] = {unidades:0, elementos:0};
    out[zone][field] = toSafeInt(inp.value, 0);
  });
  return normalizeResourceMap(out);
}

function syncResourceTextareaFromInputs(){
  const box = document.getElementById('resourceJson');
  if(box) box.value = JSON.stringify(getResourcesFromUI(), null, 2);
}

function applyResourcePreset(preset){
  const base = getZeroResourcePresets();
  const normalized = normalizeResourceMap(preset || {});
  const merged = {...base, ...normalized};
  const box = document.getElementById('resourceJson');
  if(box) box.value = JSON.stringify(merged, null, 2);
  storeResourcesForCurrentScope(merged);
  renderFixedResourceModule(merged);
}

function clearResourcePreset(){
  const zero = getZeroResourcePresets();
  storeResourcesForCurrentScope(zero);
  applyResourcePreset(zero);
}

function normalizeResourceMap(obj){
  const out={};
  Object.entries(obj||{}).forEach(([k,v])=>{ const nk=normalizeZoneName(k); if(nk) out[nk]=v; });
  return out;
}
function defaultSectorFeatures(){
  if(typeof getActiveScope==='function' && getActiveScope()==='estado' && typeof ESTADO_SECTOR_FEATURES!=='undefined' && ESTADO_SECTOR_FEATURES?.length){
    return JSON.parse(JSON.stringify(ESTADO_SECTOR_FEATURES));
  }
  try{
    if(typeof MUNICIPIO_SECTOR_FEATURES!=='undefined' && MUNICIPIO_SECTOR_FEATURES?.length){
      return JSON.parse(JSON.stringify(MUNICIPIO_SECTOR_FEATURES));
    }
    if(typeof DEFAULT_SECTOR_FEATURES!=='undefined' && DEFAULT_SECTOR_FEATURES?.length){
      return JSON.parse(JSON.stringify(DEFAULT_SECTOR_FEATURES));
    }
    if(typeof DEFAULT_VECTOR_FEATURES!=='undefined' && DEFAULT_VECTOR_FEATURES?.length){
      return JSON.parse(JSON.stringify(DEFAULT_VECTOR_FEATURES.filter(f => (f.properties?.source_layer||'')==='10_ZONAS').map(f=>({type:'Feature',properties:{...(f.properties||{}), zona: extractZoneNameFromFeature(f)}, geometry:f.geometry}))));
    }
  }catch(e){}
  return [];
}
function defaultVectorFeatures(){
  if(typeof getActiveScope==='function' && getActiveScope()==='estado') return [];
  try{
    if(typeof MUNICIPIO_VECTOR_FEATURES!=='undefined' && MUNICIPIO_VECTOR_FEATURES?.length){
      return JSON.parse(JSON.stringify(MUNICIPIO_VECTOR_FEATURES));
    }
    if(typeof DEFAULT_VECTOR_FEATURES!=='undefined' && DEFAULT_VECTOR_FEATURES?.length){
      return JSON.parse(JSON.stringify(DEFAULT_VECTOR_FEATURES.filter(f => (f.properties?.source_layer||'').includes('vectores_de_proximidad')).map(f=>({type:'Feature',properties:{...(f.properties||{}), zona: extractZoneNameFromFeature(f), vector_name: f.properties?.vector_name || f.properties?.Name}, geometry:f.geometry}))));
    }
  }catch(e){}
  return [];
}
function buildZoneColorMap(){
  const palette=['#1d4ed8','#0f766e','#b45309','#7c3aed','#dc2626','#0284c7','#65a30d','#be185d','#334155','#14b8a6','#a16207'];
  const catalog=(state.zoneCatalog||[]).slice().sort((a,b)=>zoneSortValue(a)-zoneSortValue(b));
  const map={};
  catalog.forEach((z,idx)=> map[z]=palette[idx % palette.length]);
  state.zoneColors=map;
  const legend=document.getElementById('zoneLegend');
  if(legend){
    legend.innerHTML=catalog.map(z=>`<div class="zone-legend-item"><span class="zone-swatch" style="background:${map[z]}"></span>${displayZoneName(z)}</div>`).join('');
  }
  return map;
}
function getZoneColor(z){
  if(!state.zoneColors || !Object.keys(state.zoneColors).length) buildZoneColorMap();
  return state.zoneColors?.[z] || '#64748b';
}
function pointInFeature(pt, ft){
  try{ return turf.booleanPointInPolygon(pt, ft); }catch(e){ return false; }
}

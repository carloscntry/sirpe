// ================= EVENTS =================
document.getElementById('runBtn').onclick=async()=>{
  try{
    const excelFile=document.getElementById('excelFile').files[0]; const vectorFiles=Array.from(document.getElementById('vectorFiles')?.files||[]);
    if(!excelFile) throw new Error('Carga el Excel de homicidios.');
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
    state.vectors=await readGeoJsonFiles(vectorFiles, defaultVectorFeatures());
    state.sectors=backendOrDefaultSectors.length ? backendOrDefaultSectors : defaultSectorFeatures();
    state.zoneCatalog=getModelZoneCatalog(resources||{});
    buildZoneColorMap();
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
  if(nz === 'ZONA CH') return 10;
  const idx = ZONE_CANONICAL_ORDER.indexOf(nz);
  if(idx >= 0) return idx + 1;
  const m = nz.match(/ZONA\s*(\d+)/);
  return m ? parseInt(m[1],10) : 998;
}
function zoneCode(z){
  const nz = normalizeZoneName(z);
  if(nz === 'ZONA CH') return 'CH';
  const m = (nz || '').match(/ZONA\s*(\d+)/);
  if(m) return `Z${String(parseInt(m[1],10)).padStart(2,'0')}`;
  return (nz || 'ZN').replace(/[^A-Z0-9]/g,'').slice(0,3) || 'ZN';
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

const FIXED_RESOURCE_ZONES = ZONE_CANONICAL_ORDER.slice();
const ZERO_RESOURCE_PRESETS = normalizeResourceMap(
  FIXED_RESOURCE_ZONES.reduce((acc, z)=>{ acc[z] = {unidades:0, elementos:0}; return acc; }, {})
);

function getDefaultResourceMap(){
  const box = document.getElementById('resourceJson');
  try{
    const parsed = normalizeResourceMap(JSON.parse(box?.value || '{}'));
    return Object.keys(parsed).length ? parsed : JSON.parse(JSON.stringify(ZERO_RESOURCE_PRESETS));
  }catch(e){
    return JSON.parse(JSON.stringify(ZERO_RESOURCE_PRESETS));
  }
}

function renderFixedResourceModule(resources){
  const rows = document.getElementById('resourceRows');
  if(!rows) return;
  const data = normalizeResourceMap(resources || getDefaultResourceMap());
  rows.innerHTML = FIXED_RESOURCE_ZONES.map(z=>{
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
  renderFixedResourceModule(normalizeResourceMap(preset || {}));
  syncResourceTextareaFromInputs();
}

function clearResourcePreset(){
  const empty = {};
  FIXED_RESOURCE_ZONES.forEach(z=>{ empty[z] = {unidades:0, elementos:0}; });
  applyResourcePreset(empty);
}

function normalizeResourceMap(obj){
  const out={};
  Object.entries(obj||{}).forEach(([k,v])=>{ const nk=normalizeZoneName(k); if(nk) out[nk]=v; });
  return out;
}
function defaultSectorFeatures(){
  try{
    if(typeof DEFAULT_SECTOR_FEATURES!=='undefined' && DEFAULT_SECTOR_FEATURES?.length) return JSON.parse(JSON.stringify(DEFAULT_SECTOR_FEATURES));
    if(typeof DEFAULT_VECTOR_FEATURES!=='undefined' && DEFAULT_VECTOR_FEATURES?.length){
      return JSON.parse(JSON.stringify(DEFAULT_VECTOR_FEATURES.filter(f => (f.properties?.source_layer||'')==='10_ZONAS').map(f=>({type:'Feature',properties:{...(f.properties||{}), zona: extractZoneNameFromFeature(f)}, geometry:f.geometry}))));
    }
  }catch(e){}
  return [];
}
function defaultVectorFeatures(){
  try{
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

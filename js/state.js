// ================= STATE =================
const state = {
  incidents: [], sectors: [], hotspots: [], deployments: [], routes: [], summary: [], alerts: [], aiRecs: [],
  staticPosts: [], voronoiCells: [], backendZones: [],
  map:null, sectorLayer:null, hotspotLayer:null, routeLayer:null, markerLayer:null, simLayer:null, voronoiLayer:null, staticPostLayer:null, apiZoneLayer:null, scopePreviewLayer:null, cecoreLayer:null, cecoreLabelLayer:null, zoneStatusLegend:null, cecoreLegend:null,
  simIndex:0, simTimer:null, simRunning:false, simRoutes:[], simMarkers:{},
  currentQr:null, currentQrUrl:null, currentQrName:null,
  apiBaseUrl:'https://sirpe-backend.onrender.com',
  authToken:'', currentUser:null, authProfile:null,
  folio:'', operator:'', operatorRole:'', accessLevel:'', processDate:'',
  currentScope:'municipio',
  resourceStoreByScope:{ municipio:null, estado:null }
};

function nowStamp(){ const d=new Date(); const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; }
function generarFolio(){ const d=new Date(); const p=n=>String(n).padStart(2,'0'); return `SIRPE-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; }
function toSafeInt(v,fallback=0){ const n=Number(v); return Number.isFinite(n)?Math.max(0,Math.floor(n)):fallback; }
function updateMetaPanel(){
  const ids={folioValue:state.folio||'Pendiente',operatorValue:state.operator||'No capturado',operatorRoleValue:state.operatorRole||'No capturado',accessLevelValue:state.accessLevel||'No capturado',processDateValue:state.processDate||'Pendiente'};
  Object.entries(ids).forEach(([id,val])=>{const el=document.getElementById(id); if(el) el.textContent=val;});
}
function setStatusMessage(id,msg,type='info'){
  const el=document.getElementById(id); if(!el) return;
  el.className=`status-banner ${type}`;
  el.textContent=msg||'';
}
function setZonesApiStatus(msg,cls='warn'){
  const el=document.getElementById('zonesApiStatus');
  if(el){ el.className=`pill ${cls==='ok'?'ok':cls==='danger'?'danger':'warn'}`; el.textContent=msg; }
}
function decodeJwtPayload(token){
  try{
    const part=String(token||'').split('.')[1]; if(!part) return null;
    const base64=part.replace(/-/g,'+').replace(/_/g,'/');
    const padded=base64 + '='.repeat((4 - base64.length % 4) % 4);
    return JSON.parse(atob(padded));
  }catch(e){ return null; }
}
function getRoleFromObject(obj){
  if(!obj || typeof obj!=='object') return '';
  if(typeof obj.rol==='string') return obj.rol;
  if(typeof obj.role==='string') return obj.role;
  if(typeof obj.rol_id==='number') return obj.rol_id===1 ? 'Administrador' : obj.rol_id===2 ? 'Operador' : `Rol ${obj.rol_id}`;
  if(Array.isArray(obj.roles) && obj.roles.length) return String(obj.roles[0]);
  if(obj.usuario && typeof obj.usuario==='object') return getRoleFromObject(obj.usuario);
  if(obj.user && typeof obj.user==='object') return getRoleFromObject(obj.user);
  return '';
}
function getUsernameFromObject(obj, fallback=''){
  if(!obj || typeof obj!=='object') return fallback;
  return obj.username || obj.usuario || obj.user_name || obj.email || obj.correo || fallback;
}
function getDisplayNameFromObject(obj, fallback=''){
  if(!obj || typeof obj!=='object') return fallback;
  return obj.nombre || obj.name || obj.full_name || obj.nombre_completo || fallback;
}
function authHeaders(extra={}){
  const headers={...extra};
  if(state.authToken) headers.Authorization=`Bearer ${state.authToken}`;
  return headers;
}
async function tryLoginRequest(url, correo, pass){
  const response=await fetch(`${state.apiBaseUrl}${url}`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify({correo, password:pass})
  });
  const contentType=response.headers.get('content-type')||'';
  const data=contentType.includes('application/json') ? await response.json() : {raw: await response.text()};
  if(!response.ok){
    const detail=(data && (data.detail || data.message || data.raw)) || `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return {response,data,url};
}
async function fetchProfile(){
  const candidates=['/usuarios/me','/users/me','/me','/auth/me'];
  for(const url of candidates){
    try{
      const response=await fetch(`${state.apiBaseUrl}${url}`,{headers:authHeaders({'Accept':'application/json'})});
      if(response.ok) return await response.json();
    }catch(e){}
  }
  return null;
}
function applySession(session={}){
  state.authToken=session.token||'';
  state.currentUser=session.user||session.username||'';
  state.operator=session.operator || session.name || session.user || session.username || 'Operador';
  state.operatorRole=session.role || 'Sin rol';
  state.accessLevel=session.accessLevel || session.user || session.username || 'Sin nivel';
  state.authProfile=session.profile || null;
  state.folio=session.folio || state.folio || generarFolio();
  state.processDate=nowStamp();
  updateMetaPanel();
  renderSessionUI();
}
function persistSession(){
  localStorage.setItem('sirpeSession', JSON.stringify({
    token: state.authToken || '',
    user: state.currentUser || state.accessLevel || '',
    operator: state.operator || '',
    role: state.operatorRole || '',
    accessLevel: state.accessLevel || '',
    profile: state.authProfile || null,
    folio: state.folio || ''
  }));
}
function renderSessionUI(){
  const strip=document.getElementById('sessionStrip');
  if(strip){
    const pieces=[];
    if(state.operator) pieces.push(`<span class="session-pill">Usuario: ${state.operator}</span>`);
    if(state.operatorRole) pieces.push(`<span class="session-pill">Rol: ${state.operatorRole}</span>`);
    if(state.accessLevel) pieces.push(`<span class="session-pill">Acceso: ${state.accessLevel}</span>`);
    strip.innerHTML=pieces.join('');
  }
  const badges=document.getElementById('heroBadges');
  if(badges){
    badges.innerHTML=`<span class="hero-badge">API ${state.apiBaseUrl}</span>${state.operatorRole?`<span class="hero-badge">${state.operatorRole}</span>`:''}`;
  }
}
function hideAccessOverlay(){
  const overlay=document.getElementById('accessOverlay');
  if(overlay) overlay.style.display='none';
  document.body.style.overflow='auto';
  setTimeout(()=>{ try{ if(state.map) state.map.invalidateSize(); }catch(e){} },250);
}
function showAccessOverlay(){
  const overlay=document.getElementById('accessOverlay');
  if(overlay) overlay.style.display='block';
  document.body.style.overflow='hidden';
}

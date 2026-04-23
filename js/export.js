// ================= EXPORT =================
function exportRoutesGeoJSON(){ const features=state.routes.map(r=>({type:'Feature',properties:{...r,points:undefined},geometry:{type:'LineString',coordinates:r.points.map(p=>[p.lon,p.lat])}})); download('rutas_patruya_turnos.geojson',JSON.stringify({type:'FeatureCollection',features},null,2),'application/geo+json'); }
function exportSummaryCSV(){ const cols=Object.keys(state.summary[0]||{}); const csv=[cols.join(',')].concat(state.summary.map(r=>cols.map(c=>JSON.stringify(r[c]??'')).join(','))).join('\n'); download('resumen_unidades_tiempo.csv',csv,'text/csv;charset=utf-8'); }
window.openQrModal=function({url,title,meta,name,buttonLabel='Abrir en Maps'}){ state.currentQrUrl=url; state.currentQrName=name||'qr_maps'; document.getElementById('qrModal').style.display='flex'; document.getElementById('qrTitle').textContent=title; document.getElementById('qrMeta').innerHTML=meta; const openBtn=document.getElementById('openRouteBtn'); if(openBtn) openBtn.textContent=buttonLabel; const box=document.getElementById('qrCanvas'); box.innerHTML=''; state.currentQr=new QRCode(box,{text:url,width:220,height:220}); };
window.showQr=function(idx){ const r=state.routes[idx]; if(!r || !r.google_maps_url) return; window.openQrModal({url:r.google_maps_url,title:`QR de ruta - ${r.unidad}`,meta:`Zona ${r.zona} · ${r.turno}<br>Inicio: ${r.inicio_nombre}<br>Fin: ${r.fin_nombre}<br>Tiempo: ${r.tiempo_total_min} min`,name:`${r.unidad}_${r.turno}`,buttonLabel:'Abrir ruta'}); };
window.showStaticPostQr=function(idx){ const p=(state.staticPosts||[])[idx]; if(!p) return; const url=`https://www.google.com/maps?q=${Number(p.lat).toFixed(6)},${Number(p.lon).toFixed(6)}`; window.openQrModal({url,title:`QR de puesto fijo - ${p.post_id}`,meta:`Zona ${displayZoneName ? displayZoneName(p.zona) : p.zona}<br>Lat: ${Number(p.lat).toFixed(6)}<br>Lon: ${Number(p.lon).toFixed(6)}<br>Cobertura: ${p.coverage_km} km<br>ETA máximo: ${p.eta_max_min} min`,name:`${p.post_id}_maps`,buttonLabel:'Abrir ubicación'}); };
function buildSimulationFrames(routes){ return routes.map(r=>({unidad:r.unidad, turno:r.turno, zona:r.zona, points:r.points.length>1?interpolatePoints(r.points,24):r.points})); }
function interpolatePoints(points,stepsPerSeg=24){ const out=[]; for(let i=0;i<points.length-1;i++){ const a=points[i], b=points[i+1]; for(let s=0;s<stepsPerSeg;s++){ const t=s/stepsPerSeg; out.push({lat:a.lat+(b.lat-a.lat)*t, lon:a.lon+(b.lon-a.lon)*t, nombre:a.nombre}); } } if(points.length) out.push(points[points.length-1]); return out; }
function startSimulation(){ if(!state.routes.length) return; stopSimulation(false); state.simRoutes=buildSimulationFrames(state.routes); state.simIndex=0; state.simRunning=true; document.getElementById('simStatus').textContent='Simulación en ejecución.'; state.simLayer=L.layerGroup().addTo(state.map); state.simTimer=setInterval(stepSimulation, 700); }
function stopSimulation(fin=true){ if(state.simTimer) clearInterval(state.simTimer); state.simTimer=null; state.simRunning=false; if(fin) document.getElementById('simStatus').textContent='Simulación finalizada.'; }
function resetSimulation(){ stopSimulation(false); state.simIndex=0; if(state.simLayer){ state.map.removeLayer(state.simLayer); state.simLayer=null; } document.getElementById('simStatus').textContent='Simulación reiniciada.'; }

document.getElementById('closeQrBtn').onclick=()=>document.getElementById('qrModal').style.display='none';
document.getElementById('openRouteBtn').onclick=()=>state.currentQrUrl&&window.open(state.currentQrUrl,'_blank');
document.getElementById('downloadQrBtn').onclick=()=>{ const img=document.querySelector('#qrCanvas img')||document.querySelector('#qrCanvas canvas'); if(!img) return; const a=document.createElement('a'); a.download=`${state.currentQrName||'qr_ruta'}.png`; a.href=img.src||img.toDataURL('image/png'); a.click(); };
document.getElementById('exportRoutesBtn').onclick=exportRoutesGeoJSON;
document.getElementById('exportSummaryBtn').onclick=exportSummaryCSV;
document.getElementById('exportPdfBtn').onclick=exportarPDF;
document.getElementById('enterSystemBtn').onclick=iniciarSesion;
const _rzb=document.getElementById('refreshZonesBtn'); if(_rzb) _rzb.onclick=()=>{};
document.getElementById('logoutBtn').onclick=cerrarSesion;

['accessUser','accessPass'].forEach(id=>{ const el=document.getElementById(id); if(el) el.addEventListener('keydown',e=>{ if(e.key==='Enter') iniciarSesion(); }); });

// ================= UI RENDER =================
function renderSummaryTable(){ const table=document.getElementById('summaryTable'); if(!table) return; const headers=['Unidad','Zona','Turno','Elem.','WP','Eventos','Km','Tiempo','Estado']; const rows=state.summary.map(r=>`<tr><td>${r.unidad_a_emplear}</td><td>${displayZoneName(r.zona)}</td><td><span class="pill">${r.turno}</span></td><td>${r.elementos_unidad}</td><td>${r.n_waypoints}</td><td>${r.eventos_cubiertos}</td><td>${r.distancia_km}</td><td>${r.route_mode==='punto_fijo' ? `${r.tiempo_total_min} min (fijo)` : `${r.tiempo_total_min} min`}</td><td><span class="pill ${r.estado==='Crítica'?'danger':r.estado==='Atención'?'warn':r.estado==='Punto fijo'?'info':'ok'}">${r.estado}</span></td></tr>`).join(''); table.innerHTML=`<thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody>`; }
function renderRoutesTable(){ const table=document.getElementById('routesTable'); if(!table) return; const headers=['Unidad','Zona','Turno','Inicio','Fin','Estado','QR','Google Maps']; const rows=state.routes.map((r,idx)=>`<tr><td>${r.unidad}</td><td>${displayZoneName(r.zona)}</td><td><span class="pill">${r.turno}</span></td><td>${r.inicio_nombre}</td><td>${r.fin_nombre}</td><td><span class="pill ${r.estadoClase}">${r.estado}</span></td><td><button class="ghost" onclick="showQr(${idx})">Ver QR</button></td><td>${r.route_mode==='punto_fijo'||!r.google_maps_url?'<span class="muted">No aplica</span>':`<a href="${r.google_maps_url}" target="_blank" rel="noopener noreferrer">Abrir ruta</a>`}</td></tr>`).join(''); table.innerHTML=`<thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody>`; }
window.openQrModal=function({url,title,meta,name,buttonLabel='Abrir en Maps'}){ 
  state.currentQrUrl=url; 
  state.currentQrName=name||'qr_maps'; 
  const modal=document.getElementById('qrModal');
  const titleEl=document.getElementById('qrTitle');
  const metaEl=document.getElementById('qrMeta');
  const box=document.getElementById('qrCanvas');
  const openBtn=document.getElementById('openRouteBtn');
  if(modal) modal.style.display='flex';
  if(titleEl) titleEl.textContent=title;
  if(metaEl) metaEl.innerHTML=meta;
  if(openBtn) openBtn.textContent=buttonLabel;
  if(box){ 
    box.innerHTML=''; 
    state.currentQr=new QRCode(box,{text:url,width:220,height:220}); 
  }
};
window.showQr=function(idx){ 
  const r=state.routes[idx]; 
  if(!r || !r.google_maps_url) return; 
  window.openQrModal({
    url:r.google_maps_url,
    title:`QR de ruta - ${r.unidad}`,
    meta:`Zona ${displayZoneName(r.zona)} · ${r.turno}<br>Inicio: ${r.inicio_nombre}<br>Fin: ${r.fin_nombre}<br>Tiempo: ${r.tiempo_total_min} min`,
    name:`${r.unidad}_${r.turno}`,
    buttonLabel:'Abrir ruta'
  });
};
window.showStaticPostQr=function(idx){
  const p=(state.staticPosts||[])[idx];
  if(!p) return;
  const url=`https://www.google.com/maps?q=${Number(p.lat).toFixed(6)},${Number(p.lon).toFixed(6)}`;
  window.openQrModal({
    url,
    title:`QR de puesto fijo - ${p.post_id}`,
    meta:`Zona ${displayZoneName(p.zona)}<br>Lat: ${Number(p.lat).toFixed(6)}<br>Lon: ${Number(p.lon).toFixed(6)}<br>Cobertura: ${p.coverage_km} km<br>ETA máximo: ${p.eta_max_min} min`,
    name:`${p.post_id}_maps`,
    buttonLabel:'Abrir ubicación'
  });
};
function stepSimulation(){ if(!state.simRunning) return; state.simLayer.clearLayers(); let active=0; state.simRoutes.forEach(r=>{ const idx=Math.min(state.simIndex, r.points.length-1); if(idx>=0 && r.points[idx]){ const p=r.points[idx]; L.circleMarker([p.lat,p.lon],{radius:7,color:turnoColor(r.turno),fillColor:turnoColor(r.turno),fillOpacity:0.9,weight:2}).bindTooltip(`${r.unidad} · ${displayZoneName(r.zona)}`).addTo(state.simLayer); active++; } }); state.simIndex++; const maxLen=Math.max(...state.simRoutes.map(r=>r.points.length)); document.getElementById('simStatus').textContent=`Simulación en ejecución · paso ${state.simIndex}/${maxLen} · unidades visibles ${active}`; if(state.simIndex>=maxLen) stopSimulation(true); }

initMap(); updateMetaPanel(); renderBackendZonesTable(); const restored=restaurarSesion(); cargarZonasDesdeAPI({fit:restored, silent:!restored});
const analyticsDateLabel=document.getElementById('analyticsDateLabel'); if(analyticsDateLabel){ analyticsDateLabel.textContent=new Date().toLocaleDateString('es-MX',{year:'numeric',month:'long',day:'numeric'}); }

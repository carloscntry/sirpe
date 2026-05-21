// ================= ROUTING =================
// ================= CECORE ESTATAL =================
const ESTADO_CECORES = {
  'REGION 1': { nombre:'CECORE REGION 1', lat:20.168071, lon:-98.078960 },
  'REGION 2': { nombre:'CECORE REGION 2', lat:19.8616700, lon:-98.0169652 },
  'REGION 3': { nombre:'CECORE REGION 3', lat:19.826258, lon:-97.349342 },
  'REGION 4': { nombre:'CECORE REGION 4', lat:19.278831, lon:-98.446680 },
  'REGION 5': { nombre:'CECORE REGION 5', lat:19.03634600, lon:-98.19059700 },
  'REGION 6': { nombre:'CECORE REGION 6', lat:18.989700, lon:-97.905805 },
  'REGION 7': { nombre:'CECORE REGION 7', lat:19.009628, lon:-97.462171 },
  'REGION 8': { nombre:'CECORE REGION 8', lat:18.885057, lon:-98.499458 },
  'REGION 9': { nombre:'CECORE REGION 9', lat:18.233243, lon:-98.000000 },
  'REGION 10': { nombre:'CECORE REGION 10', lat:18.479156, lon:-97.443413 },
  'REGION 11': { nombre:'CECORE REGION 11', lat:18.378164, lon:-97.273977 }
};
window.ESTADO_CECORES = ESTADO_CECORES;

function getActiveScopeSafe(){
  return document.getElementById('scopeSelector')?.value || state?.currentScope || 'municipio';
}
function getRegionKeyFromZone(zona){
  const nz = (typeof normalizeZoneName==='function' ? normalizeZoneName(zona) : String(zona||'')).toString().toUpperCase();
  const m = nz.match(/REGION\s*(\d+)/);
  return m ? `REGION ${parseInt(m[1],10)}` : null;
}
function getCecoreForZone(zona){
  if(getActiveScopeSafe() !== 'estado') return null;
  const key = getRegionKeyFromZone(zona);
  if(!key) return null;
  const c = ESTADO_CECORES[key];
  if(!c || !Number.isFinite(Number(c.lat)) || !Number.isFinite(Number(c.lon))) return null;
  return { key, ...c };
}
function makeCecorePoint(cecore){
  return {
    nombre: cecore.nombre || `CECORE ${cecore.key}`,
    lat: Number(cecore.lat),
    lon: Number(cecore.lon),
    tipo: 'CECORE',
    cecore: true,
    riesgo: 0,
    eventos: 0,
    probabilidad: 0
  };
}
function applyCecoreToRoutePoints(zona, operationalPoints){
  const pts = Array.isArray(operationalPoints) ? operationalPoints.filter(p=>Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon))) : [];
  const cecore = getCecoreForZone(zona);
  if(!cecore || !pts.length) return { cecore:null, routePoints:pts };
  const cPoint = makeCecorePoint(cecore);
  return { cecore, routePoints:[cPoint, ...pts, {...cPoint}] };
}
function calcDistanceKm(points){
  let dist = 0;
  const pts = Array.isArray(points) ? points : [];
  for(let j=0;j<pts.length-1;j++){
    dist += haversineKm(Number(pts[j].lat), Number(pts[j].lon), Number(pts[j+1].lat), Number(pts[j+1].lon));
  }
  return dist;
}

function buildRoutes(hotspots, deployments, resources, maxWp, minElem, velKmh, minParada){
  const routes=[], summary=[];
  for(const d of deployments){
    const hs=hotspots.filter(h=>h.zona===d.zona&&h.turno===d.turno).sort((a,b)=>b.probabilidad-a.probabilidad);
    const totalUnits=Math.max(0,toSafeInt(d.unidades_asignadas,0));
    if(totalUnits<=0) continue;
    const elems=assignElements(d.elementos_asignados, totalUnits, minElem, 4);
    for(let i=0;i<totalUnits;i++){
      const unit=`${zoneCode(d.zona)}-${d.turno.slice(0,2).toUpperCase()}-U${String(i+1).padStart(2,'0')}`;
      const ordered=hs.length ? selectVectorAwarePoints(hs, i, totalUnits, maxWp) : [];
      const elementosUnidad=elems[i]||0;
      if(!ordered.length){
        routes.push({zona:d.zona,turno:d.turno,unidad:unit,elementos_unidad:elementosUnidad,n_waypoints:0,eventos_cubiertos:0,riesgo_cubierto:0,prob_cubierta:0,distancia_km:0,tiempo_total_min:0,google_maps_url:'',inicio_nombre:'Sin ruta asignada',inicio_lat:null,inicio_lon:null,fin_nombre:'Sin ruta asignada',fin_lat:null,fin_lon:null,estado:'Cobertura',estadoClase:'info',route_mode:'cobertura',points:[]});
        summary.push({unidad_a_emplear:unit,zona:d.zona,turno:d.turno,elementos_unidad:elementosUnidad,n_waypoints:0,eventos_cubiertos:0,riesgo_cubierto:0,prob_cubierta:0,distancia_km:0,tiempo_conduccion_min:0,tiempo_paradas_min:0,tiempo_total_min:0,tiempo_total_horas:0,estado:'Cobertura',route_mode:'cobertura',google_maps_url:''});
        continue;
      }
      const cecoreRoute = applyCecoreToRoutePoints(d.zona, ordered);
      const routePoints = cecoreRoute.routePoints;
      const dist=calcDistanceKm(routePoints);
      const tiempoConduccion=dist/velKmh*60, tiempoParadas=ordered.length*minParada, tiempoTotal=tiempoConduccion+tiempoParadas;
      const riskCovered=ordered.reduce((s,x)=>s+x.riesgo,0);
      const eventsCovered=ordered.reduce((s,x)=>s+x.eventos,0);
      const probCovered=ordered.reduce((s,x)=>s+x.probabilidad,0);
      const mode=ordered.length<=1 ? 'punto_fijo' : 'ruta_movil';
      const status=routeStatus(tiempoTotal, riskCovered, ordered.length);
      const url=routePoints.length>=2 ? makeGoogleMapsUrl(routePoints) : '';
      const inicio=routePoints[0], fin=routePoints[routePoints.length-1];
      routes.push({zona:d.zona,turno:d.turno,unidad:unit,elementos_unidad:elementosUnidad,n_waypoints:ordered.length,eventos_cubiertos:eventsCovered,riesgo_cubierto:riskCovered,prob_cubierta:probCovered,distancia_km:Number(dist.toFixed(3)),tiempo_total_min:Number(tiempoTotal.toFixed(1)),google_maps_url:url,inicio_nombre:inicio.nombre,inicio_lat:inicio.lat,inicio_lon:inicio.lon,fin_nombre:fin.nombre,fin_lat:fin.lat,fin_lon:fin.lon,estado:status.label,estadoClase:status.cls,route_mode:mode,points:routePoints,cecore_nombre:cecoreRoute.cecore?.nombre||'',cecore_lat:cecoreRoute.cecore?.lat??null,cecore_lon:cecoreRoute.cecore?.lon??null});
      summary.push({unidad_a_emplear:unit,zona:d.zona,turno:d.turno,elementos_unidad:elementosUnidad,n_waypoints:ordered.length,eventos_cubiertos:eventsCovered,riesgo_cubierto:Number(riskCovered.toFixed(3)),prob_cubierta:Number(probCovered.toFixed(4)),distancia_km:Number(dist.toFixed(3)),tiempo_conduccion_min:Number(tiempoConduccion.toFixed(1)),tiempo_paradas_min:Number(tiempoParadas.toFixed(1)),tiempo_total_min:Number(tiempoTotal.toFixed(1)),tiempo_total_horas:Number((tiempoTotal/60).toFixed(2)),estado:status.label,route_mode:mode,google_maps_url:url,cecore_nombre:cecoreRoute.cecore?.nombre||''});
    }
  }
  return {routes, summary};
}

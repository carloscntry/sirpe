// ================= ROUTING =================
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
      let dist=0; for(let j=0;j<ordered.length-1;j++) dist += haversineKm(ordered[j].lat,ordered[j].lon,ordered[j+1].lat,ordered[j+1].lon);
      const tiempoConduccion=dist/velKmh*60, tiempoParadas=ordered.length*minParada, tiempoTotal=tiempoConduccion+tiempoParadas;
      const riskCovered=ordered.reduce((s,x)=>s+x.riesgo,0);
      const eventsCovered=ordered.reduce((s,x)=>s+x.eventos,0);
      const probCovered=ordered.reduce((s,x)=>s+x.probabilidad,0);
      const mode=ordered.length<=1 ? 'punto_fijo' : 'ruta_movil';
      const status=routeStatus(tiempoTotal, riskCovered, ordered.length);
      const url=mode==='ruta_movil' ? makeGoogleMapsUrl(ordered) : '';
      routes.push({zona:d.zona,turno:d.turno,unidad:unit,elementos_unidad:elementosUnidad,n_waypoints:ordered.length,eventos_cubiertos:eventsCovered,riesgo_cubierto:riskCovered,prob_cubierta:probCovered,distancia_km:Number(dist.toFixed(3)),tiempo_total_min:Number(tiempoTotal.toFixed(1)),google_maps_url:url,inicio_nombre:ordered[0].nombre,inicio_lat:ordered[0].lat,inicio_lon:ordered[0].lon,fin_nombre:ordered[ordered.length-1].nombre,fin_lat:ordered[ordered.length-1].lat,fin_lon:ordered[ordered.length-1].lon,estado:status.label,estadoClase:status.cls,route_mode:mode,points:ordered});
      summary.push({unidad_a_emplear:unit,zona:d.zona,turno:d.turno,elementos_unidad:elementosUnidad,n_waypoints:ordered.length,eventos_cubiertos:eventsCovered,riesgo_cubierto:Number(riskCovered.toFixed(3)),prob_cubierta:Number(probCovered.toFixed(4)),distancia_km:Number(dist.toFixed(3)),tiempo_conduccion_min:Number(tiempoConduccion.toFixed(1)),tiempo_paradas_min:Number(tiempoParadas.toFixed(1)),tiempo_total_min:Number(tiempoTotal.toFixed(1)),tiempo_total_horas:Number((tiempoTotal/60).toFixed(2)),estado:status.label,route_mode:mode,google_maps_url:url});
    }
  }
  return {routes, summary};
}

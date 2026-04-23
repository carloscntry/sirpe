// ================= AUTH / API =================
const API_BASE = "https://sirpe-backend.onrender.com";

function buildApiUrl(path){
  if(!path) return API_BASE;
  if(/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

// ================= LOGIN =================
async function tryLoginRequest(path, correo, pass){
  const response = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, password: pass })
  });

  let data = null;
  try{
    data = await response.json();
  }catch(e){
    data = null;
  }

  if(!response.ok){
    throw new Error(data?.detail || data?.message || 'No se pudo iniciar sesión.');
  }

  return { response, data };
}

async function iniciarSesion(){
  const correo = (document.getElementById('accessUser')?.value || '').trim();
  const pass = (document.getElementById('accessPass')?.value || '').trim();

  if(!correo || !pass){
    setStatusMessage('accessMessage','Ingrese correo y contraseña.','warn');
    return;
  }

  try{
    const result = await tryLoginRequest('/usuarios/login', correo, pass);
    const loginData = result.data || {};

    const token = loginData.access_token || '';
    const user = loginData.usuario || correo;

    applySession({ token, user });
    persistSession();

    hideAccessOverlay();
    setStatusMessage('accessMessage','Sesión iniciada correctamente.','ok');

  }catch(err){
    console.error(err);
    setStatusMessage('accessMessage','Error de login','danger');
  }
}

// ================= ZONAS =================
async function cargarZonasDesdeAPI(){
  try{
    const response = await fetch(buildApiUrl('/zonas/'));

    const data = await response.json();

    if(!response.ok){
      throw new Error("Error al cargar zonas");
    }

    state.backendZones = data;
    renderBackendZonesTable();

  }catch(err){
    console.error("Error cargando zonas:", err);
  }
}
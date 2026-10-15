const $ = (id) => document.getElementById(id);
const CLAVE_TOKEN = 'adminToken';
let token = sessionStorage.getItem(CLAVE_TOKEN);
let resultado = { filas: [] };

// ---------- Utilidades ----------
const hoyBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const horaLegible = (iso) => new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'medium',
}).format(new Date(iso));
const duracion = (min) => (min == null ? '' : `${Math.floor(min / 60)} h ${min % 60} min`);

async function pedir(url, opciones = {}) {
  let resp;
  try {
    resp = await fetch(url, {
      ...opciones,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    });
  } catch {
    throw new Error('Sin conexión, intente de nuevo');
  }
  const datos = await resp.json().catch(() => ({}));
  if (resp.status === 401 && token) salir();
  if (!resp.ok) throw new Error(datos.error || 'Error del servidor');
  return datos;
}

// ---------- Sesión ----------
function mostrarPanel(visible) {
  $('vista-login').hidden = visible;
  $('vista-panel').hidden = !visible;
}

async function ingresar(e) {
  e.preventDefault();
  $('login-error').textContent = '';
  const boton = e.submitter;
  boton.disabled = true;
  try {
    const r = await pedir('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: $('password').value }) });
    token = r.token;
    sessionStorage.setItem(CLAVE_TOKEN, token);
    $('password').value = '';
    mostrarPanel(true);
    buscar();
  } catch (err) {
    $('login-error').textContent = err.message;
  } finally {
    boton.disabled = false;
  }
}

function salir() {
  token = null;
  sessionStorage.removeItem(CLAVE_TOKEN);
  resultado = { filas: [] };
  $('tabla-cuerpo').replaceChildren();
  $('resumen').replaceChildren();
  mostrarPanel(false);
}

// ---------- Consulta ----------
async function buscar(e) {
  e?.preventDefault();
  $('panel-error').textContent = '';
  $('btn-buscar').disabled = true;
  const params = new URLSearchParams({ desde: $('desde').value, hasta: $('hasta').value });
  if ($('f-parqueadero').value.trim()) params.set('parqueadero', $('f-parqueadero').value.trim());
  if ($('f-cedula').value.trim()) params.set('cedula', $('f-cedula').value.trim());
  try {
    resultado = await pedir(`/api/admin/registros?${params}`);
    pintarResumen();
    pintarTabla();
  } catch (err) {
    $('panel-error').textContent = err.message;
  } finally {
    $('btn-buscar').disabled = false;
    $('btn-exportar').disabled = !resultado.filas.length;
  }
}

function pintarResumen() {
  const f = resultado.filas;
  const contar = (cond) => f.filter(cond).length;
  const datos = [
    `Total: ${f.length}`,
    `Entradas: ${contar((x) => x.tipo === 'LOGIN')}`,
    `Salidas: ${contar((x) => x.tipo === 'LOGOUT')}`,
    `Turnos abiertos: ${contar((x) => x.estadoSesion === 'ABIERTA')}`,
    `No cerrados: ${contar((x) => x.estadoSesion === 'NO_CERRADA')}`,
  ];
  $('resumen').replaceChildren(...datos.map((t) => Object.assign(document.createElement('span'), { textContent: t })));
}

function celda(texto, clase) {
  const td = document.createElement('td');
  td.textContent = texto ?? '';
  if (clase) td.className = clase;
  return td;
}

function pintarTabla() {
  const filasHtml = resultado.filas.map((f) => {
    const tr = document.createElement('tr');
    const tdTipo = document.createElement('td');
    tdTipo.append(Object.assign(document.createElement('span'), { className: `etiqueta ${f.tipo}`, textContent: f.tipo }));
    const tdFoto = document.createElement('td');
    const btn = Object.assign(document.createElement('button'), { className: 'btn-mini', textContent: 'Ver' });
    btn.addEventListener('click', () => verFoto(f));
    tdFoto.append(btn);
    tr.append(
      celda(horaLegible(f.hora)), celda(f.cedula), tdTipo,
      celda(`${f.parqueaderoCodigo} · ${f.parqueaderoNombre}`), celda(f.puntoServicio),
      celda(f.estadoSesion, `estado-${f.estadoSesion}`), celda(duracion(f.duracionMin)), tdFoto,
    );
    return tr;
  });
  if (!filasHtml.length) {
    const tr = document.createElement('tr');
    const td = celda('Sin registros para los filtros seleccionados');
    td.colSpan = 8;
    tr.append(td);
    filasHtml.push(tr);
  }
  $('tabla-cuerpo').replaceChildren(...filasHtml);
}

// ---------- Foto ----------
async function verFoto(fila) {
  $('foto-grande').removeAttribute('src');
  $('foto-info').textContent = 'Cargando…';
  $('modal-foto').showModal();
  try {
    const { url } = await pedir(`/api/admin/foto?key=${encodeURIComponent(fila.fotoKey)}`);
    $('foto-grande').src = url;
    $('foto-info').textContent = `${fila.cedula} · ${fila.tipo} · ${horaLegible(fila.hora)}`;
  } catch (err) {
    $('foto-info').textContent = err.message;
  }
}

// ---------- Excel ----------
function exportar() {
  const datos = resultado.filas.map((f) => ({
    'Fecha y hora': horaLegible(f.hora),
    Fecha: f.fecha,
    Cédula: f.cedula,
    Tipo: f.tipo,
    'Código parqueadero': f.parqueaderoCodigo,
    Parqueadero: f.parqueaderoNombre,
    'Punto de servicio': f.puntoServicio,
    Ciudad: f.ciudad,
    'Estado sesión': f.estadoSesion,
    'Duración (min)': f.duracionMin ?? '',
  }));
  const hoja = XLSX.utils.json_to_sheet(datos);
  hoja['!cols'] = [20, 12, 13, 9, 12, 25, 20, 12, 14, 14].map((wch) => ({ wch }));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Registros');
  XLSX.writeFile(libro, `registros_${resultado.desde}_a_${resultado.hasta}.xlsx`);
}

// ---------- Inicio ----------
$('desde').value = hoyBogota();
$('hasta').value = hoyBogota();
$('form-login').addEventListener('submit', ingresar);
$('form-filtros').addEventListener('submit', buscar);
$('btn-exportar').addEventListener('click', exportar);
$('btn-salir').addEventListener('click', salir);
$('btn-cerrar-foto').addEventListener('click', () => $('modal-foto').close());

if (token) { mostrarPanel(true); buscar(); }
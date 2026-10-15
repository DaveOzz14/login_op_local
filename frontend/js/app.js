import { api } from './api.js';
import { validarCedula } from './validaciones.js';
import { encenderCamara, apagarCamara, capturarFoto } from './camara.js';

const $ = (id) => document.getElementById(id);
const VISTAS = ['vista-error', 'vista-cedula', 'vista-foto', 'vista-resultado'];
const estado = { parqueadero: null, cedula: null, accion: null, info: null, foto: null, fotoUrl: null, fotoKey: null };
function mostrar(vista) {
  VISTAS.forEach((v) => { $(v).hidden = v !== vista; });
}

function mostrarError(mensaje) {
  $('pq-nombre').textContent = 'Registro de turno';
  $('pq-detalle').textContent = '';
  $('error-texto').textContent = mensaje;
  mostrar('vista-error');
}

function iniciarReloj() {
  const formato = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', dateStyle: 'full', timeStyle: 'medium',
  });
  const tic = () => { $('reloj').textContent = formato.format(new Date()); };
  tic();
  setInterval(tic, 1000);
}

async function cargarParqueadero() {
  const codigo = new URLSearchParams(location.search).get('p');
  if (!codigo) return mostrarError('La dirección no tiene el código del punto. Use el enlace o QR asignado a su parqueadero.');
  try {
    const pq = await api.parqueadero(codigo);
    estado.parqueadero = pq;
    $('pq-nombre').textContent = pq.nombre;
    $('pq-detalle').textContent = `${pq.puntoServicio} · ${pq.ciudad}`;
    volverAInicio();
  } catch (e) {
    mostrarError(e.message);
  }
}

// ---------- Cédula ----------
function alEscribirCedula(e) {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
  $('cedula-error').textContent = '';
}

async function alEnviarCedula(e) {
    e.preventDefault();
    const r = validarCedula($('cedula').value);
    if (!r.ok) { $('cedula-error').textContent = r.mensaje; return; }
    if (!$('acepto').checked) { $('cedula-error').textContent = 'Debe autorizar el tratamiento de datos para continuar'; return; }
    const boton = $('form-cedula').querySelector('button');
    boton.disabled = true;
    try {
      const info = await api.estado(r.cedula);
      estado.cedula = r.cedula;
      estado.accion = info.siguiente;
      estado.info = info;
      irAFoto();
    } catch (err) {
      $('cedula-error').textContent = err.message;
    } finally {
      boton.disabled = false;
    }
  }

// ---------- Foto ----------
function modoCamara(enVivo) {
  $('video').hidden = !enVivo;
  $('foto-previa').hidden = enVivo;
  $('btn-tomar').hidden = !enVivo;
  $('btn-repetir').hidden = enVivo;
  $('btn-confirmar').hidden = enVivo;
}

function limpiarFoto() {
  if (estado.fotoUrl) URL.revokeObjectURL(estado.fotoUrl);
  estado.foto = null;
  estado.fotoUrl = null;
  $('foto-previa').removeAttribute('src');
}


const horaCorta = (iso) => new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short',
  }).format(new Date(iso));
  
  function detalleAccion(info) {
    const s = info.sesionAbierta;
    if (s) return `Turno abierto en ${s.parqueaderoNombre} desde ${horaCorta(s.horaLogin)}`;
    if (info.sesionVencida) return 'Su turno anterior no se cerró. Se registrará una nueva entrada.';
    return `Cédula ${info.cedula}`;
  }
async function irAFoto() {
    const esLogin = estado.accion === 'LOGIN';
    $('accion-texto').textContent = esLogin ? '🟢 ENTRADA (Login)' : '🟠 SALIDA (Logout)';
    $('accion-texto').className = `accion ${esLogin ? 'login' : 'logout'}`;
    $('accion-detalle').textContent = detalleAccion(estado.info);
  $('foto-error').textContent = '';
  limpiarFoto();
  modoCamara(true);
  mostrar('vista-foto');
  try {
    await encenderCamara($('video'));
  } catch (e) {
    $('foto-error').textContent = e.message;
    $('btn-tomar').hidden = true;
  }
}

async function tomarFoto() {
  try {
    estado.foto = await capturarFoto($('video'));
    estado.fotoUrl = URL.createObjectURL(estado.foto);
    $('foto-previa').src = estado.fotoUrl;
    modoCamara(false);
  } catch (e) {
    $('foto-error').textContent = e.message;
  }
}

function repetirFoto() {
  limpiarFoto();
  $('foto-error').textContent = '';
  modoCamara(true);
}

let temporizadorReinicio = null;

const formatoDuracion = (min) => `${Math.floor(min / 60)} h ${min % 60} min`;

function mostrarResultado(r) {
  const esLogin = r.tipo === 'LOGIN';
  $('resultado-titulo').textContent = esLogin ? '✅ Entrada registrada' : '✅ Salida registrada';
  $('resultado-detalle').textContent =
    `${r.parqueadero} · ${horaCorta(r.hora)}` + (esLogin ? '' : ` · Duración del turno: ${formatoDuracion(r.duracionMin)}`);
  mostrar('vista-resultado');
  temporizadorReinicio = setTimeout(volverAInicio, 10_000); // vuelve sola al inicio a los 10 s
}

function bloquearBotones(bloquear) {
    ['btn-repetir', 'btn-confirmar', 'btn-cancelar'].forEach((id) => { $(id).disabled = bloquear; });
    $('btn-confirmar').textContent = bloquear ? 'Enviando…' : 'Confirmar';
  }
  
  async function confirmar() {
    bloquearBotones(true);
    $('foto-error').textContent = '';
    try {
      const permiso = await api.urlFoto(estado.cedula);
      await api.subirFoto(permiso, estado.foto);
      estado.fotoKey = permiso.fotoKey;
      const resultado = await api.registrar({
        cedula: estado.cedula,
        parqueaderoCodigo: estado.parqueadero.codigo,
        fotoKey: estado.fotoKey,
      });
      apagarCamara($('video'));
      mostrarResultado(resultado);
    } catch (e) {
      $('foto-error').textContent = e.message;
    } finally {
      bloquearBotones(false);
    }
  }

// ---------- Navegación ----------
clearTimeout(temporizadorReinicio);

function volverAInicio() {
  apagarCamara($('video'));
  limpiarFoto();
  estado.cedula = null;
  $('cedula').value = '';
  $('acepto').checked = false;
  $('cedula-error').textContent = '';
  mostrar('vista-cedula');
  $('cedula').focus();
}

// Si el operador sale de la pestaña con la cámara abierta, se cancela el registro
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !$('vista-foto').hidden) volverAInicio();
});

// ---------- Eventos ----------
$('cedula').addEventListener('input', alEscribirCedula);
$('form-cedula').addEventListener('submit', alEnviarCedula);
$('btn-tomar').addEventListener('click', tomarFoto);
$('btn-repetir').addEventListener('click', repetirFoto);
$('btn-confirmar').addEventListener('click', confirmar);
$('btn-cancelar').addEventListener('click', volverAInicio);
$('btn-nuevo').addEventListener('click', volverAInicio);

iniciarReloj();
cargarParqueadero();
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { HttpError } from '../utils/respuestas.js';

const DURACION_MS = 8 * 60 * 60 * 1000; // 8 horas
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const firmar = (datos) => createHmac('sha256', config.adminSecret).update(datos).digest('base64url');

// Comparación en tiempo constante: no revela cuántos caracteres coinciden
function iguales(a, b) {
  const ha = createHash('sha256').update(String(a ?? '')).digest();
  const hb = createHash('sha256').update(String(b ?? '')).digest();
  return timingSafeEqual(ha, hb);
}

function verificarConfiguracion() {
  if (!config.adminPassword || config.adminSecret.length < 32) {
    throw new HttpError(500, 'Administración no configurada');
  }
}

export async function loginAdmin(password) {
  verificarConfiguracion();
  if (!iguales(password, config.adminPassword)) {
    await esperar(1000);
    throw new HttpError(401, 'Contraseña incorrecta');
  }
  const expira = Date.now() + DURACION_MS;
  const datos = Buffer.from(JSON.stringify({ rol: 'admin', expira })).toString('base64url');
  return { token: `${datos}.${firmar(datos)}`, expira };
}

export function exigirAdmin(evento) {
  verificarConfiguracion();
  const token = (evento.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  const [datos, firma] = token.split('.');
  if (!datos || !firma || !iguales(firma, firmar(datos))) {
    throw new HttpError(401, 'Sesión inválida, ingrese de nuevo');
  }
  const { expira } = JSON.parse(Buffer.from(datos, 'base64url').toString());
  if (Date.now() > expira) throw new HttpError(401, 'Sesión vencida, ingrese de nuevo');
}
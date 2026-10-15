import { ok, error, HttpError } from './utils/respuestas.js';
import { obtenerParqueaderoActivo } from './services/parqueaderos.js';
import { consultarEstado, registrar } from './services/registros.js';
import { crearUrlSubida } from './services/fotos.js';
import { loginAdmin, exigirAdmin } from './services/auth.js';
import { consultarRegistros, urlFoto } from './services/admin.js';

const rutas = [
  { metodo: 'GET', patron: /^\/api\/health$/, accion: async () => ok({ estado: 'ok', hora: new Date().toISOString() }) },

  // Operador
  { metodo: 'GET', patron: /^\/api\/parqueaderos\/(?<codigo>[^/]+)$/,
    accion: async ({ params }) => ok(await obtenerParqueaderoActivo(decodeURIComponent(params.codigo))) },
  { metodo: 'GET', patron: /^\/api\/estado\/(?<cedula>[^/]+)$/,
    accion: async ({ params }) => ok(await consultarEstado(decodeURIComponent(params.cedula))) },
  { metodo: 'POST', patron: /^\/api\/fotos\/url$/,
    accion: async ({ body }) => ok(await crearUrlSubida(body.cedula)) },
  { metodo: 'POST', patron: /^\/api\/registros$/,
    accion: async ({ body, evento }) => ok(await registrar(body, evento)) },

  // Administración
  { metodo: 'POST', patron: /^\/api\/admin\/login$/,
    accion: async ({ body }) => ok(await loginAdmin(body.password)) },
  { metodo: 'GET', patron: /^\/api\/admin\/verificar$/,
    accion: async ({ evento }) => { exigirAdmin(evento); return ok({ valido: true }); } },
  { metodo: 'GET', patron: /^\/api\/admin\/registros$/,
    accion: async ({ evento, query }) => { exigirAdmin(evento); return ok(await consultarRegistros(query)); } },
  { metodo: 'GET', patron: /^\/api\/admin\/foto$/,
    accion: async ({ evento, query }) => { exigirAdmin(evento); return ok(await urlFoto(query.key)); } },
];

function leerBody(evento) {
  if (!evento.body) return {};
  const texto = evento.isBase64Encoded ? Buffer.from(evento.body, 'base64').toString() : evento.body;
  try { return JSON.parse(texto); } catch { throw new HttpError(400, 'JSON inválido'); }
}

export async function enrutar(evento) {
  const metodo = evento.requestContext?.http?.method || 'GET';
  const ruta = evento.rawPath || '/';
  for (const r of rutas) {
    const m = ruta.match(r.patron);
    if (m && r.metodo === metodo) {
      return r.accion({ evento, params: m.groups || {}, query: evento.queryStringParameters || {}, body: leerBody(evento) });
    }
  }
  return error(404, 'Ruta no encontrada');
}
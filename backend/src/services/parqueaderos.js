import * as XLSX from 'xlsx';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from '../utils/clients.js';
import { config } from '../config.js';
import { HttpError } from '../utils/respuestas.js';

const TTL_MS = 5 * 60 * 1000; // la caché se renueva cada 5 minutos
let cache = { mapa: null, expira: 0 };

const texto = (v) => String(v ?? '').trim();

function normalizar(filas) {
  const mapa = new Map();
  for (const f of filas) {
    const codigo = texto(f.Codigo).toUpperCase();
    if (!codigo) continue;
    if (mapa.has(codigo)) console.warn(`Código duplicado en Excel: ${codigo}`);
    mapa.set(codigo, {
      codigo,
      nombre: texto(f.Nombre),
      puntoServicio: texto(f.PuntoServicio),
      ciudad: texto(f.Ciudad),
      activo: ['SI', 'SÍ'].includes(texto(f.Activo).toUpperCase()),
    });
  }
  return mapa;
}

async function cargarDesdeS3() {
  const resp = await s3.send(new GetObjectCommand({ Bucket: config.bucketFotos, Key: config.excelKey }));
  const libro = XLSX.read(await resp.Body.transformToByteArray(), { type: 'array' });
  const hoja = libro.Sheets['Parqueaderos'];
  if (!hoja) throw new Error('El Excel no tiene la hoja "Parqueaderos"');
  return normalizar(XLSX.utils.sheet_to_json(hoja));
}

async function obtenerMapa() {
  if (cache.mapa && Date.now() < cache.expira) return cache.mapa;
  try {
    cache = { mapa: await cargarDesdeS3(), expira: Date.now() + TTL_MS };
  } catch (e) {
    if (!cache.mapa) throw e; // sin caché previa no hay con qué responder
    console.error('Fallo leyendo Excel, se usa la caché anterior:', e.message);
  }
  return cache.mapa;
}

export async function obtenerParqueaderoActivo(codigoEntrada) {
  const codigo = texto(codigoEntrada).toUpperCase();
  if (!/^[A-Z0-9-]{2,20}$/.test(codigo)) throw new HttpError(400, 'Código de parqueadero inválido');
  const pq = (await obtenerMapa()).get(codigo);
  if (!pq) throw new HttpError(404, 'Punto no válido, contacte al supervisor');
  if (!pq.activo) throw new HttpError(403, 'Punto inactivo, contacte al supervisor');
  const { activo, ...datos } = pq;
  return datos;
}
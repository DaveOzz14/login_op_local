import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { db, s3 } from '../utils/clients.js';
import { config } from '../config.js';
import { HttpError } from '../utils/respuestas.js';
import { validarCedula } from '../utils/validaciones.js';
import { ahoraBogota, horasDesde } from '../utils/fechas.js';

const MAX_FILAS = 15_000;

// ---------- Fechas ----------
const fechaValida = (f) => /^\d{4}-\d{2}-\d{2}$/.test(f ?? '')
  && new Date(`${f}T00:00:00Z`).toISOString().startsWith(f);

function diasEntre(desde, hasta) {
  const dias = [];
  for (let d = new Date(`${desde}T00:00:00Z`); d <= new Date(`${hasta}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    dias.push(d.toISOString().slice(0, 10));
  }
  return dias;
}

// ---------- DynamoDB ----------
async function consultarTodo(params, acumulado = []) {
  let ExclusiveStartKey;
  do {
    const r = await db.send(new QueryCommand({ TableName: config.tableName, ...params, ExclusiveStartKey }));
    acumulado.push(...(r.Items || []));
    if (acumulado.length > MAX_FILAS) throw new HttpError(400, 'Demasiados resultados, reduzca el rango de fechas');
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return acumulado;
}

function aFila(i) {
  const vencida = i.tipo === 'LOGIN' && i.estadoSesion === 'ABIERTA' && horasDesde(i.sk) > config.sesionMaxHoras;
  return {
    cedula: i.cedula, tipo: i.tipo, hora: i.sk, fecha: i.fecha,
    parqueaderoCodigo: i.parqueaderoCodigo, parqueaderoNombre: i.parqueaderoNombre,
    puntoServicio: i.puntoServicio, ciudad: i.ciudad,
    estadoSesion: vencida ? 'NO_CERRADA' : (i.estadoSesion ?? ''),
    duracionMin: i.duracionMin ?? null,
    fotoKey: i.fotoKey,
  };
}

// ---------- Consulta principal ----------
export async function consultarRegistros(q) {
  const hoy = ahoraBogota().fecha;
  const desde = q.desde || hoy;
  const hasta = q.hasta || desde;
  if (!fechaValida(desde) || !fechaValida(hasta)) throw new HttpError(400, 'Fechas inválidas (formato AAAA-MM-DD)');
  if (desde > hasta) throw new HttpError(400, 'La fecha inicial es mayor que la final');

  const parqueadero = (q.parqueadero || '').trim().toUpperCase();
  let cedula = null;
  if (q.cedula) {
    const v = validarCedula(q.cedula);
    if (!v.ok) throw new HttpError(400, v.mensaje);
    cedula = v.cedula;
  }

  const dias = diasEntre(desde, hasta);
  const maxDias = cedula || parqueadero ? 31 : 7;
  if (dias.length > maxDias) throw new HttpError(400, `El rango máximo es de ${maxDias} días para este filtro`);

  const rango = { ':ini': `${desde}T00`, ':fin': `${hasta}T24` };
  let items;

  if (cedula) {
    items = await consultarTodo({
      KeyConditionExpression: 'pk = :pk AND sk BETWEEN :ini AND :fin',
      ...(parqueadero && { FilterExpression: 'parqueaderoCodigo = :pq' }),
      ExpressionAttributeValues: { ':pk': `CED#${cedula}`, ...rango, ...(parqueadero && { ':pq': parqueadero }) },
    });
  } else if (parqueadero) {
    items = await consultarTodo({
      IndexName: 'PorParqueadero',
      KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk BETWEEN :ini AND :fin',
      ExpressionAttributeValues: { ':pk': `PQ#${parqueadero}`, ...rango },
    });
  } else {
    items = [];
    for (const dia of dias) {
      await consultarTodo({
        IndexName: 'PorFecha',
        KeyConditionExpression: 'gsi2pk = :pk',
        ExpressionAttributeValues: { ':pk': `FECHA#${dia}` },
      }, items);
    }
  }

  const filas = items.map(aFila).sort((a, b) => b.hora.localeCompare(a.hora));
  return { desde, hasta, total: filas.length, filas };
}

// ---------- Fotos ----------
export async function urlFoto(fotoKey) {
  if (!/^fotos\/[\w/-]+\.jpg$/.test(fotoKey ?? '')) throw new HttpError(400, 'Foto inválida');
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: config.bucketFotos, Key: fotoKey }), { expiresIn: 300 });
  return { url };
}
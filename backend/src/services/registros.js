import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db } from '../utils/clients.js';
import { config } from '../config.js';
import { HttpError } from '../utils/respuestas.js';
import { validarCedula } from '../utils/validaciones.js';
import { horasDesde } from '../utils/fechas.js';
import { randomUUID } from 'node:crypto';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ahoraBogota } from '../utils/fechas.js';
import { obtenerParqueaderoActivo } from './parqueaderos.js';
import { keyPerteneceA, fotoExiste } from './fotos.js';

export function exigirCedula(valor) {
  const r = validarCedula(valor);
  if (!r.ok) throw new HttpError(400, r.mensaje);
  return r.cedula;
}

async function ultimoRegistro(cedula) {
  const r = await db.send(new QueryCommand({
    TableName: config.tableName,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `CED#${cedula}` },
    ScanIndexForward: false, // del más reciente al más antiguo
    Limit: 1,
  }));
  return r.Items?.[0] || null;
}

// Uso interno: también lo usará el guardado del registro en el paso 3
export async function analizarEstado(cedula) {
  const ultimo = await ultimoRegistro(cedula);
  const respuesta = { cedula, siguiente: 'LOGIN', sesionAbierta: null, sesionVencida: false };

  if (!ultimo || ultimo.tipo !== 'LOGIN') return { respuesta, loginAbierto: null, loginVencido: null };

  const horas = horasDesde(ultimo.sk);
  if (horas > config.sesionMaxHoras) {
    return { respuesta: { ...respuesta, sesionVencida: true }, loginAbierto: null, loginVencido: ultimo };
  }

  respuesta.siguiente = 'LOGOUT';
  respuesta.sesionAbierta = {
    parqueaderoCodigo: ultimo.parqueaderoCodigo,
    parqueaderoNombre: ultimo.parqueaderoNombre,
    horaLogin: ultimo.sk,
    horasTranscurridas: Math.round(horas * 10) / 10,
  };
  return { respuesta, loginAbierto: ultimo, loginVencido: null };
}

export async function consultarEstado(cedulaEntrada) {
  const cedula = exigirCedula(cedulaEntrada);
  return (await analizarEstado(cedula)).respuesta;
}


const cerrarLogin = (login, campos) => {
    const nombres = Object.keys(campos);
    return {
      Update: {
        TableName: config.tableName,
        Key: { pk: login.pk, sk: login.sk },
        UpdateExpression: 'SET ' + nombres.map((n) => `${n} = :${n}`).join(', '),
        ConditionExpression: 'estadoSesion = :abierta',
        ExpressionAttributeValues: {
          ...Object.fromEntries(nombres.map((n) => [`:${n}`, campos[n]])),
          ':abierta': 'ABIERTA',
        },
      },
    };
  };
  
  export async function registrar({ cedula: cedulaEntrada, parqueaderoCodigo, fotoKey }, evento) {
    const cedula = exigirCedula(cedulaEntrada);
    const pq = await obtenerParqueaderoActivo(parqueaderoCodigo);
    if (!keyPerteneceA(fotoKey, cedula)) throw new HttpError(400, 'Foto inválida');
    if (!(await fotoExiste(fotoKey))) throw new HttpError(400, 'La foto no se recibió, tome la foto de nuevo');
  
    const { respuesta, loginAbierto, loginVencido } = await analizarEstado(cedula);
    const tipo = respuesta.siguiente;
    const ahora = ahoraBogota();
  
    const item = {
      pk: `CED#${cedula}`, sk: ahora.iso, tipo, cedula,
      parqueaderoCodigo: pq.codigo, parqueaderoNombre: pq.nombre,
      puntoServicio: pq.puntoServicio, ciudad: pq.ciudad,
      fecha: ahora.fecha, fotoKey,
      sesionId: tipo === 'LOGIN' ? randomUUID() : loginAbierto.sesionId,
      gsi1pk: `PQ#${pq.codigo}`, gsi1sk: ahora.iso,
      gsi2pk: `FECHA#${ahora.fecha}`, gsi2sk: ahora.iso,
      ip: evento?.requestContext?.http?.sourceIp,
      userAgent: evento?.requestContext?.http?.userAgent?.slice(0, 200),
    };
  
    const operaciones = [];
    if (tipo === 'LOGIN') {
      item.estadoSesion = 'ABIERTA';
      if (loginVencido) operaciones.push(cerrarLogin(loginVencido, { estadoSesion: 'NO_CERRADA' }));
    } else {
      item.duracionMin = Math.round((ahora.epoch - Date.parse(loginAbierto.sk)) / 60_000);
      item.loginSk = loginAbierto.sk;
      item.loginParqueaderoCodigo = loginAbierto.parqueaderoCodigo;
      operaciones.push(cerrarLogin(loginAbierto, {
        estadoSesion: 'CERRADA', logoutSk: ahora.iso, duracionMin: item.duracionMin,
      }));
    }
    operaciones.unshift({
      Put: { TableName: config.tableName, Item: item, ConditionExpression: 'attribute_not_exists(pk)' },
    });
  
    try {
      await db.send(new TransactWriteCommand({ TransactItems: operaciones }));
    } catch (e) {
      if (e.name === 'TransactionCanceledException') throw new HttpError(409, 'El registro ya fue procesado, verifique e intente de nuevo');
      throw e;
    }
  
    return {
      tipo, hora: ahora.iso, cedula,
      parqueadero: pq.nombre,
      duracionMin: item.duracionMin ?? null,
    };
  }
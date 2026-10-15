import { randomUUID } from 'node:crypto';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from '../utils/clients.js';
import { config } from '../config.js';
import { HttpError } from '../utils/respuestas.js';
import { validarCedula } from '../utils/validaciones.js';
import { ahoraBogota } from '../utils/fechas.js';

const PATRON_KEY = /^fotos\/\d{4}\/\d{2}\/\d{2}\/(\d{6,10})_\d+_[a-f0-9]{8}\.jpg$/;

export async function crearUrlSubida(cedulaEntrada) {
  const v = validarCedula(cedulaEntrada);
  if (!v.ok) throw new HttpError(400, v.mensaje);

  const { fecha, epoch } = ahoraBogota();
  const [anio, mes, dia] = fecha.split('-');
  const fotoKey = `fotos/${anio}/${mes}/${dia}/${v.cedula}_${epoch}_${randomUUID().slice(0, 8)}.jpg`;

  const { url, fields } = await createPresignedPost(s3, {
    Bucket: config.bucketFotos,
    Key: fotoKey,
    Conditions: [
      ['content-length-range', 5_000, 1_000_000], // entre 5 KB y 1 MB
      ['eq', '$Content-Type', 'image/jpeg'],
    ],
    Fields: { 'Content-Type': 'image/jpeg' },
    Expires: 120, // segundos
  });
  return { fotoKey, url, fields };
}

// Se usarán en el paso 3, antes de guardar el registro
export const keyPerteneceA = (fotoKey, cedula) => PATRON_KEY.exec(fotoKey ?? '')?.[1] === cedula;

export async function fotoExiste(fotoKey) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: config.bucketFotos, Key: fotoKey }));
    return true;
  } catch {
    return false;
  }
}
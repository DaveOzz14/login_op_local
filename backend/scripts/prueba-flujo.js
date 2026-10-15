import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PQ = 'PQ-001';
const cedula = '9' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');

async function llamar(metodo, ruta, body) {
  const r = await fetch(BASE + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  return { status: r.status, datos: await r.json().catch(() => ({})) };
}

async function subirFoto(ced, bytes = 8_000) {
  const { datos } = await llamar('POST', '/api/fotos/url', { cedula: ced });
  const form = new FormData();
  Object.entries(datos.fields).forEach(([k, v]) => form.append(k, v));
  form.append('file', new Blob([randomBytes(bytes)], { type: 'image/jpeg' }), 'foto.jpg');
  const r = await fetch(datos.url, { method: 'POST', body: form });
  return { ok: r.ok, fotoKey: datos.fotoKey };
}

async function paso(nombre, fn) {
  await fn();
  console.log(`✔ ${nombre}`);
}

console.log(`Probando contra ${BASE} con la cédula ${cedula}\n`);

await paso('Cédula nueva → le toca LOGIN', async () => {
  const { datos } = await llamar('GET', `/api/estado/${cedula}`);
  assert.equal(datos.siguiente, 'LOGIN');
});

await paso('Registra LOGIN', async () => {
  const { fotoKey } = await subirFoto(cedula);
  const { status, datos } = await llamar('POST', '/api/registros', { cedula, parqueaderoCodigo: PQ, fotoKey });
  assert.equal(status, 200);
  assert.equal(datos.tipo, 'LOGIN');
});

await paso('Ahora le toca LOGOUT', async () => {
  const { datos } = await llamar('GET', `/api/estado/${cedula}`);
  assert.equal(datos.siguiente, 'LOGOUT');
  assert.equal(datos.sesionAbierta.parqueaderoCodigo, PQ);
});

await paso('Rechaza la foto de otra cédula', async () => {
  const { fotoKey } = await subirFoto('79123456');
  const { status } = await llamar('POST', '/api/registros', { cedula, parqueaderoCodigo: PQ, fotoKey });
  assert.equal(status, 400);
});

await paso('Rechaza una foto que no se subió', async () => {
  const fotoKey = `fotos/2026/01/01/${cedula}_1_abcdef12.jpg`;
  const { status } = await llamar('POST', '/api/registros', { cedula, parqueaderoCodigo: PQ, fotoKey });
  assert.equal(status, 400);
});

await paso('Rechaza un parqueadero inactivo', async () => {
  const { fotoKey } = await subirFoto(cedula);
  const { status } = await llamar('POST', '/api/registros', { cedula, parqueaderoCodigo: 'PQ-004', fotoKey });
  assert.equal(status, 403);
});

await paso('S3 rechaza fotos de más de 1 MB', async () => {
  const { ok } = await subirFoto(cedula, 2_000_000);
  assert.equal(ok, false);
});

await paso('Registra LOGOUT con duración', async () => {
  const { fotoKey } = await subirFoto(cedula);
  const { status, datos } = await llamar('POST', '/api/registros', { cedula, parqueaderoCodigo: PQ, fotoKey });
  assert.equal(status, 200);
  assert.equal(datos.tipo, 'LOGOUT');
  assert.equal(typeof datos.duracionMin, 'number');
});

await paso('Tras el LOGOUT vuelve a tocar LOGIN', async () => {
  const { datos } = await llamar('GET', `/api/estado/${cedula}`);
  assert.equal(datos.siguiente, 'LOGIN');
});

console.log('\n✅ Flujo completo OK');
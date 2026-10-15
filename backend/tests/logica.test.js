import { test } from 'node:test';
import assert from 'node:assert/strict';

// Variables antes de importar: config.js las lee al cargarse
process.env.ADMIN_PASSWORD = 'clave-de-prueba';
process.env.ADMIN_SECRET = 'x'.repeat(40);
const { ahoraBogota } = await import('../src/utils/fechas.js');
const { keyPerteneceA } = await import('../src/services/fotos.js');
const { loginAdmin, exigirAdmin } = await import('../src/services/auth.js');

test('hora de Bogotá (UTC-5), incluso al cambiar de día', () => {
  const a = ahoraBogota(new Date('2026-10-15T05:30:00.000Z'));
  assert.equal(a.iso, '2026-10-15T00:30:00.000-05:00');
  const b = ahoraBogota(new Date('2026-10-16T03:00:00.000Z')); // 10 pm del día 15 en Bogotá
  assert.equal(b.fecha, '2026-10-15');
  assert.equal(b.iso, '2026-10-15T22:00:00.000-05:00');
});

test('la foto debe pertenecer a la cédula', () => {
  const key = 'fotos/2026/10/15/1023456789_1760500000000_abcd1234.jpg';
  assert.equal(keyPerteneceA(key, '1023456789'), true);
  assert.equal(keyPerteneceA(key, '79123456'), false);
  assert.equal(keyPerteneceA('fotos/../config/parqueaderos.xlsx', '1023456789'), false);
  assert.equal(keyPerteneceA(undefined, '1023456789'), false);
});

test('autenticación del administrador', async () => {
  await assert.rejects(loginAdmin('incorrecta'), { status: 401 });
  const { token } = await loginAdmin('clave-de-prueba');
  const evento = (t) => ({ headers: { authorization: `Bearer ${t}` } });
  assert.doesNotThrow(() => exigirAdmin(evento(token)));
  assert.throws(() => exigirAdmin(evento(token.slice(0, -2) + 'xx')), { status: 401 }); // token alterado
  assert.throws(() => exigirAdmin({ headers: {} }), { status: 401 }); // sin token
});
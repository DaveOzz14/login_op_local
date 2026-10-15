import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarCedula } from '../src/utils/validaciones.js';

test('cédulas válidas', () => {
  assert.equal(validarCedula('1023456789').cedula, '1023456789');
  assert.equal(validarCedula('1.023.456.789').cedula, '1023456789');
  assert.equal(validarCedula(' 79 123 456 ').cedula, '79123456');
  assert.equal(validarCedula('123456').ok, true);
});

test('cédulas inválidas', () => {
  for (const c of ['', '   ', 'abc123', '0123456', '12345', '12345678901', '12a456', null]) {
    assert.equal(validarCedula(c).ok, false, `debería rechazar: ${c}`);
  }
});
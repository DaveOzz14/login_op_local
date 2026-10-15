// Mantener igual a frontend/js/validaciones.js
export const limpiarCedula = (valor) => String(valor ?? '').replace(/[\s.\-]/g, '');

export function validarCedula(valor) {
  const c = limpiarCedula(valor);
  if (!c) return { ok: false, mensaje: 'Ingrese su número de cédula' };
  if (!/^\d+$/.test(c)) return { ok: false, mensaje: 'La cédula solo debe contener números' };
  if (c.startsWith('0')) return { ok: false, mensaje: 'La cédula no puede iniciar en 0' };
  if (c.length < 6 || c.length > 10) return { ok: false, mensaje: 'La cédula debe tener entre 6 y 10 dígitos' };
  return { ok: true, cedula: c };
}
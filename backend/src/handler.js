import { enrutar } from './router.js';
import { error } from './utils/respuestas.js';

export const handler = async (evento) => {
  try {
    return await enrutar(evento);
  } catch (e) {
    if (e.status) return error(e.status, e.message);
    console.error(e);
    return error(500, 'Error interno, intente de nuevo');
  }
};
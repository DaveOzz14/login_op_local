async function pedir(url, opciones = {}) {
    let resp;
    try {
      resp = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opciones });
    } catch {
      throw new Error('Sin conexión a internet, intente de nuevo');
    }
    const datos = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(datos.error || 'Error del servidor, intente de nuevo');
    return datos;
  }
  
  export const api = {
    parqueadero: (codigo) => pedir(`/api/parqueaderos/${encodeURIComponent(codigo)}`),
    estado: (cedula) => pedir(`/api/estado/${encodeURIComponent(cedula)}`),
    urlFoto: (cedula) => pedir('/api/fotos/url', { method: 'POST', body: JSON.stringify({ cedula }) }),

    async subirFoto({ url, fields }, blob) {
      const form = new FormData();
      Object.entries(fields).forEach(([k, v]) => form.append(k, v));
      form.append('file', blob, 'foto.jpg'); // el archivo siempre va de último
      let resp;
      try {
        resp = await fetch(url, { method: 'POST', body: form });
      } catch {
        throw new Error('No se pudo subir la foto, revise la conexión');
      }
      if (!resp.ok) throw new Error('No se pudo subir la foto, intente de nuevo');
    },
    registrar: (datos) => pedir('/api/registros', { method: 'POST', body: JSON.stringify(datos) }),
  };
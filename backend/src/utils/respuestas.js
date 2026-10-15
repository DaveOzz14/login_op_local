export class HttpError extends Error {
    constructor(status, mensaje) { super(mensaje); this.status = status; }
  }
  
  export const json = (statusCode, body) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  
  export const ok = (body) => json(200, body);
  export const error = (status, mensaje) => json(status, { error: mensaje });
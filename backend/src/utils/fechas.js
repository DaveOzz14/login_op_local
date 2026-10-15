const formato = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  
  export function ahoraBogota(fecha = new Date()) {
    const p = Object.fromEntries(formato.formatToParts(fecha).map((x) => [x.type, x.value]));
    const ms = String(fecha.getMilliseconds()).padStart(3, '0');
    return {
      iso: `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.${ms}-05:00`,
      fecha: `${p.year}-${p.month}-${p.day}`,
      epoch: fecha.getTime(),
    };
  }
  
  export const horasDesde = (iso) => (Date.now() - Date.parse(iso)) / 3_600_000;
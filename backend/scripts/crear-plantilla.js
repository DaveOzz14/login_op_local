import * as XLSX from 'xlsx';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

XLSX.set_fs(fs);
const destino = fileURLToPath(new URL('../../data/parqueaderos.xlsx', import.meta.url));

const filas = [
  { Codigo: 'PQ-001', Nombre: 'Parqueadero Centro', PuntoServicio: 'Entrada principal', Ciudad: 'Bogotá', Activo: 'SI' },
  { Codigo: 'PQ-002', Nombre: 'Parqueadero Norte', PuntoServicio: 'Sótano 1', Ciudad: 'Bogotá', Activo: 'SI' },
  { Codigo: 'PQ-003', Nombre: 'Parqueadero Poblado', PuntoServicio: 'Taquilla', Ciudad: 'Medellín', Activo: 'SI' },
  { Codigo: 'PQ-004', Nombre: 'Parqueadero Antiguo', PuntoServicio: 'Portería', Ciudad: 'Cali', Activo: 'NO' },
];

const hoja = XLSX.utils.json_to_sheet(filas);
hoja['!cols'] = [{ wch: 10 }, { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 8 }];
const libro = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(libro, hoja, 'Parqueaderos');
XLSX.writeFile(libro, destino);
console.log(`✔ Plantilla creada en ${destino}`);
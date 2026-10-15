import 'dotenv/config';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { db } from '../src/utils/clients.js';
import { config } from '../src/config.js';

const { Items = [] } = await db.send(new ScanCommand({ TableName: config.tableName }));
Items.sort((a, b) => b.sk.localeCompare(a.sk));
console.table(Items.slice(0, 20).map((i) => ({
  cedula: i.cedula, tipo: i.tipo, hora: i.sk, parqueadero: i.parqueaderoCodigo,
  estadoSesion: i.estadoSesion ?? '', duracionMin: i.duracionMin ?? '',
})));
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from '../src/utils/clients.js';
import { config } from '../src/config.js';

const origen = process.argv[2]
  || fileURLToPath(new URL('../../data/parqueaderos.xlsx', import.meta.url));

await s3.send(new PutObjectCommand({
  Bucket: config.bucketFotos,
  Key: config.excelKey,
  Body: readFileSync(origen),
  ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}));
console.log(`✔ Excel subido a ${config.bucketFotos}/${config.excelKey}`);
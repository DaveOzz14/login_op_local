import 'dotenv/config';
import { CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { ddb, s3 } from '../src/utils/clients.js';
import { config } from '../src/config.js';

const gsi = (nombre, pk, sk) => ({
  IndexName: nombre,
  KeySchema: [{ AttributeName: pk, KeyType: 'HASH' }, { AttributeName: sk, KeyType: 'RANGE' }],
  Projection: { ProjectionType: 'ALL' },
});

async function crearTabla() {
  try {
    await ddb.send(new DescribeTableCommand({ TableName: config.tableName }));
    console.log(`✔ Tabla ${config.tableName} ya existe`);
  } catch (e) {
    if (e.name !== 'ResourceNotFoundException') throw e;
    await ddb.send(new CreateTableCommand({
      TableName: config.tableName,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: ['pk', 'sk', 'gsi1pk', 'gsi1sk', 'gsi2pk', 'gsi2sk']
        .map((n) => ({ AttributeName: n, AttributeType: 'S' })),
      KeySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }, { AttributeName: 'sk', KeyType: 'RANGE' }],
      GlobalSecondaryIndexes: [
        gsi('PorParqueadero', 'gsi1pk', 'gsi1sk'),
        gsi('PorFecha', 'gsi2pk', 'gsi2sk'),
      ],
    }));
    console.log(`✔ Tabla ${config.tableName} creada`);
  }
}

async function crearBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: config.bucketFotos }));
    console.log(`✔ Bucket ${config.bucketFotos} ya existe`);
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: config.bucketFotos }));
    console.log(`✔ Bucket ${config.bucketFotos} creado`);
  }
}

await crearTabla();
await crearBucket();
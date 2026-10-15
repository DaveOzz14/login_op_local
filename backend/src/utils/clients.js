import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { config } from '../config.js';

export const ddb = new DynamoDBClient({
  region: config.region,
  ...(config.dynamoEndpoint && { endpoint: config.dynamoEndpoint }),
});

export const db = DynamoDBDocumentClient.from(ddb, {
  marshallOptions: { removeUndefinedValues: true },
});

export const s3 = new S3Client({
  region: config.region,
  ...(config.s3Endpoint && { endpoint: config.s3Endpoint, forcePathStyle: true }),
});
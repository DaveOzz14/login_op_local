export const config = {
    isLocal: process.env.APP_ENV === 'local',
    region: process.env.AWS_REGION || 'us-east-1',
    tableName: process.env.TABLE_NAME || 'Registros',
    bucketFotos: process.env.BUCKET_FOTOS || 'parking-fotos',
    excelKey: process.env.EXCEL_KEY || 'config/parqueaderos.xlsx',
    dynamoEndpoint: process.env.DYNAMO_ENDPOINT || undefined,
    s3Endpoint: process.env.S3_ENDPOINT || undefined,
    zonaHoraria: 'America/Bogota',
    sesionMaxHoras: Number(process.env.SESION_MAX_HORAS || 16),
    adminPassword: process.env.ADMIN_PASSWORD || '',
    adminSecret: process.env.ADMIN_SECRET || '',
  };
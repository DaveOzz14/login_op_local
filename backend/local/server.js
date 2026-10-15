import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handler } from '../src/handler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', true);
app.use(express.text({ type: '*/*', limit: '1mb' }));

app.use('/api', async (req, res) => {
  const evento = {
    rawPath: req.originalUrl.split('?')[0],
    queryStringParameters: Object.keys(req.query).length ? req.query : undefined,
    headers: req.headers,
    body: typeof req.body === 'string' && req.body.length ? req.body : undefined,
    isBase64Encoded: false,
    requestContext: { http: { method: req.method, sourceIp: req.ip, userAgent: req.get('user-agent') } },
  };
  const r = await handler(evento);
  res.status(r.statusCode).set(r.headers || {}).send(r.body);
});

app.use(express.static(path.join(__dirname, '../../frontend')));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor local en http://localhost:${port}`));
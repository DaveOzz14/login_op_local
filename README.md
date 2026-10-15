# Registro de turnos – Operadores de parqueadero

## Desarrollo local
```powershell
docker compose up -d          # DynamoDB Local + MinIO
cd backend
npm install
copy .env.example .env        # completar ADMIN_PASSWORD y ADMIN_SECRET
npm run init:local            # tabla + bucket
npm run subir:excel           # carga data/parqueaderos.xlsx
npm run dev                   # http://localhost:3000/?p=PQ-001  |  /admin.html
```

## Scripts
| Script | Uso |
|---|---|
| `npm test` | Pruebas unitarias |
| `npm run prueba:flujo` | Prueba de punta a punta (servidor encendido) |
| `npm run ver` | Últimos 20 registros |
| `npm run plantilla` | Regenera la plantilla Excel de ejemplo |
| `npm run subir:excel` | Sube el Excel de parqueaderos |

## URL por punto
`<dominio>/?p=<Codigo del Excel>`
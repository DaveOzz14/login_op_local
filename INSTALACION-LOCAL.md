# Instalación local en un equipo nuevo

Guía paso a paso para dejar funcionando **parking-turnos** en otro equipo con Windows (PowerShell), a partir del repositorio en GitHub.

Tiempo estimado: 20–30 minutos (la mayor parte es instalar Docker).

---

## 1. Requisitos

Instalar, si no están, y **reiniciar la terminal** al terminar:

| Herramienta | Versión | Descarga |
|---|---|---|
| Git | cualquiera reciente | https://git-scm.com |
| Node.js | 22 LTS | https://nodejs.org |
| Docker Desktop | cualquiera reciente | https://www.docker.com/products/docker-desktop |
| Cursor (opcional) | — | https://cursor.com |

Alternativa con winget:
```powershell
winget install Git.Git OpenJS.NodeJS.LTS Docker.DockerDesktop
```

Verificar:
```powershell
git --version
node -v              # debe mostrar v22.x
docker -v
docker compose version
```

> Si `npm` muestra un error de "ejecución de scripts deshabilitada", ejecutar una sola vez:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```

---

## 2. Clonar el repositorio

```powershell
cd $HOME\Documents
git clone https://github.com/<usuario>/parking-turnos.git
cd parking-turnos
```

Reemplazar `<usuario>` por el dueño del repositorio. Si el repositorio es privado, Git pedirá iniciar sesión en GitHub.

---

## 3. Levantar DynamoDB Local y MinIO

1. Abrir **Docker Desktop** y esperar a que diga *Engine running*.
2. Desde la raíz `parking-turnos`:

```powershell
docker compose up -d
docker ps
```

**Esperado:** dos contenedores con estado `Up`: `amazon/dynamodb-local` y `pgsty/minio`.

---

## 4. Instalar dependencias del backend

```powershell
cd backend
npm install
```

> La librería de Excel (SheetJS) se descarga desde `cdn.sheetjs.com`. Si la red corporativa la bloquea, `npm install` fallará en ese paquete: pedir acceso a ese dominio o instalar desde otra red.

---

## 5. Crear el archivo `.env`

El `.env` **no está en GitHub** (contiene secretos). Se crea a partir de la plantilla:

```powershell
Copy-Item .env.example .env
```

Generar una clave secreta para los tokens del administrador:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Abrir `backend/.env` y completar las dos variables vacías:
```
ADMIN_PASSWORD=UnaClaveSegura2026!
ADMIN_SECRET=<pegar aquí la clave generada>
```

El archivo completo debe quedar así:
```
APP_ENV=local
PORT=3000
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
TABLE_NAME=Registros
BUCKET_FOTOS=parking-fotos
EXCEL_KEY=config/parqueaderos.xlsx
DYNAMO_ENDPOINT=http://localhost:8000
S3_ENDPOINT=http://localhost:9000
SESION_MAX_HORAS=16
ADMIN_PASSWORD=UnaClaveSegura2026!
ADMIN_SECRET=<clave de 64 caracteres>
```

---

## 6. Crear tabla, bucket y cargar el Excel

Desde `backend`:

```powershell
npm run init:local
```
**Esperado:**
```
✔ Tabla Registros creada
✔ Bucket parking-fotos creado
```

Cargar la lista de parqueaderos:
```powershell
npm run subir:excel
```
**Esperado:** `✔ Excel subido a parking-fotos/config/parqueaderos.xlsx`

> Si no existe `data/parqueaderos.xlsx`, generar la plantilla de ejemplo con `npm run plantilla` y repetir `npm run subir:excel`.

---

## 7. Arrancar la aplicación

```powershell
npm run dev
```
**Esperado:** `Servidor local en http://localhost:3000`

Dejar esta terminal abierta. El servidor se reinicia solo al guardar cambios en el código (no al cambiar el `.env`: en ese caso, `Ctrl + C` y `npm run dev`).

---

## 8. Verificar que todo funciona

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | `http://localhost:3000/api/health` | `{"estado":"ok",...}` |
| 2 | `http://localhost:3000/?p=PQ-001` | Pantalla del operador con "Parqueadero Centro" |
| 3 | Cédula + foto + Confirmar | "✅ Entrada registrada" |
| 4 | `http://localhost:3000/admin.html` | Login; con la clave del `.env` se ven los registros |
| 5 | `http://localhost:9001` (usuario/clave `minioadmin`) | Bucket `parking-fotos` con `config/` y `fotos/` |

Pruebas automáticas, en **otra terminal** desde `backend` (con el servidor encendido):
```powershell
npm test               # pruebas unitarias → fail 0
npm run prueba:flujo   # flujo completo → ✅ Flujo completo OK
```

---

## 9. Uso diario

Al volver a trabajar en el proyecto:
```powershell
# 1. Abrir Docker Desktop
# 2. Desde la raíz del proyecto
docker compose up -d
cd backend
npm run dev
```

Los datos (registros y fotos) se conservan en la carpeta `.data/` entre sesiones.

Para detener todo: `Ctrl + C` en la terminal del servidor y `docker compose stop` en la raíz.

---

## 10. Comandos útiles

| Comando (desde `backend`) | Para qué |
|---|---|
| `npm run dev` | Arranca el servidor local |
| `npm test` | Pruebas unitarias |
| `npm run prueba:flujo` | Prueba de punta a punta |
| `npm run ver` | Muestra los últimos 20 registros |
| `npm run subir:excel` | Sube `data/parqueaderos.xlsx` tras editarlo |
| `npm run plantilla` | Regenera el Excel de ejemplo (sobrescribe el actual) |

**Reiniciar los datos locales desde cero** (desde la raíz):
```powershell
docker compose down
Remove-Item -Recurse -Force .data
docker compose up -d
cd backend; npm run init:local; npm run subir:excel
```

---

## 11. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `docker compose up` falla con *cannot connect to the Docker daemon* | Docker Desktop cerrado | Abrirlo y esperar *Engine running* |
| *port is already allocated* (8000, 9000 o 9001) | Otro programa usa el puerto | Cerrar ese programa o cambiar el puerto izquierdo en `docker-compose.yml` y el endpoint en `.env` |
| `EADDRINUSE :3000` al hacer `npm run dev` | Otro servidor en el puerto 3000 | Cerrar la otra terminal o cambiar `PORT` en `.env` |
| La pantalla muestra "Error interno, intente de nuevo" | Contenedores apagados o tabla sin crear | `docker compose up -d` y `npm run init:local` |
| "Punto no válido" con `PQ-001` | Excel no cargado | `npm run subir:excel` |
| Admin responde "Administración no configurada" | `ADMIN_PASSWORD` vacío o `ADMIN_SECRET` con menos de 32 caracteres | Completar el `.env` (paso 5) y reiniciar el servidor |
| "Permiso de cámara denegado" | El navegador bloqueó la cámara | Clic en el ícono 🔒 junto a la URL → permitir cámara → recargar |
| La cámara no abre desde un celular en `http://192.168.x.x:3000` | Los navegadores exigen HTTPS para la cámara fuera de `localhost` | Probar desde el PC; las pruebas en celular se hacen con la versión en AWS |
| `npm install` falla en `xlsx` | Bloqueo de `cdn.sheetjs.com` | Ver nota del paso 4 |

# Proios Manager - ERP & BPM

Proios Manager es un sistema **ERP/BPM** (Enterprise Resource Planning / Business Process Management) modular estructurado bajo principios de *Domain-Driven Design (DDD)* y *Event-Driven Architecture (EDA)*. 
Diseñado con un sólido backend en Django (API DRF), bases de datos PostgreSQL, colas asíncronas con Celery/Redis y un frontend React (Vite).

## 🏛️ Arquitectura del Proyecto

El sistema evolucionó de un monolito a contextos delimitados (Bounded Contexts) para asegurar máxima escalabilidad y trazabilidad operativa.

**Módulos Principales:**
- **`usuarios`**: Gestión de Perfiles, Autenticación JWT y Control de Acceso (RBAC) con `django-guardian`.
- **`operaciones`**: Core operativo regido por una **Máquina de Estados Finita (FSM)**. Supervisa flujos desde Presupuestos hasta Entregas.
- **`inventario`**: Diseño estilo *Ledger Inmutable*. Los items (`Articulos`) dictan su stock a través de cálculos fijos basados en historial de `MovimientoStock`.
- **`produccion`**: Gestión de órdenes de fabricación y Fórmulas/BOM (Bill of Materials).

*(La interconexión de dominios se realiza asíncronamente mediante un `EventBus` interno acoplado a Celery para evitar bloqueos).*

---

## 🚀 Requisitos Previos

Asegúrate de tener instalado en tu sistema:
- [Git](https://git-scm.com/)
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

---

## 🛠️ Instalación Paso a Paso (Plug & Play)

Esta versión de la aplicación está empaquetada para levantarse sin fallos en una máquina nueva, con todas sus dependencias transaccionales y migraciones resueltas.

### 1. Clonar el repositorio

```bash
git clone https://github.com/Antonio-Riveros/Stock.git
cd "Proios Manager" 
```

### 2. Configurar Variables de Entorno

El proyecto incluye un archivo de molde seguro. No es necesario realizar configuraciones complejas para desarrollo local.

**Linux/MacOS:**
```bash
cp .env.example .env
```
**Windows (PowerShell):**
```powershell
Copy-Item .env.example -Destination .env
```

### 3. Levantar Infraestructura con Docker

Proios Manager automatiza el despliegue a un solo comando. 
Ejecuta el siguiente comando en la raíz del proyecto para descargar imágenes, compilar el SO, e iniciar los servicios en segundo plano:

```bash
docker compose up --build -d
```

**⚠️ AVISO SOBRE MIGRACIONES (Novedad):**
Anteriormente, levantar Docker fallaba o crasheaba si la base de datos estaba vacía. **Esto ya fue resuelto.**
El repositorio ahora versiona las migraciones iniciales (`0001_initial.py`). Cada vez que Docker construya el backend, ejecutará `python manage.py migrate` automáticamente de manera segura y mapeará los esquemas sin crashear. 

### 4. Crear Superusuario (Administrador)

Una vez que Docker finalice y todo corra estable (`docker compose ps`), debes crear un usuario administrador para ingresar al sistema:

```bash
docker compose run --rm --entrypoint python backend manage.py createsuperuser
```
*(Sigue las instrucciones en consola).*

---

## 🌐 Acceso a la Aplicación

Todos los servicios locales se unifican bajo el orquestador Nginx:

- **Frontend Interactivo:** [http://localhost:3000/](http://localhost:3000/) o [http://localhost/](http://localhost/)
- **API Backend:** [http://localhost/api/](http://localhost/api/) o [http://localhost:8000/](http://localhost:8000/)
- **Panel Administrativo Django:** [http://localhost:8000/admin/](http://localhost:8000/admin/)

---

## 🛑 Comandos Frecuentes y Mantenimiento

**Ver logs en tiempo real (Crucial para Celery Workers y API):**
```bash
docker compose logs -f
```

**Crear una nueva migración (tras modificar `models.py` en backend):**
```bash
docker compose run --rm --entrypoint python backend manage.py makemigrations
```

**Detener contenedores sin destruir datos:**
```bash
docker compose stop
```

**Purga Completa (Reset Factory):**
Si realizas un cambio masivo en la arquitectura y necesitas reiniciar todo desde cero destruyendo la base de datos local y el caché de redis:
```bash
docker compose down -v
```

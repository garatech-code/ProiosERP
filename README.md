# Proios Manager

Sistema de gestión y administración (GARA) que integra un frontend desarrollado en React (Vite) y un backend potente en Django (Python) respaldado por PostgreSQL, Redis, Celery y Nginx para servir la aplicación en conjunto.

## 🚀 Requisitos Previos

Asegúrate de tener instalado en tu sistema:
- [Git](https://git-scm.com/)
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## 🛠️ Instalación Paso a Paso

Sigue estas instrucciones para levantar el proyecto en un entorno local mediante Docker:

### 1. Clonar el repositorio

Abre tu terminal y clona este repositorio en tu máquina:

```bash
git clone https://github.com/TU_USUARIO/proios-manager.git
cd "Proios Manager" 
# (o el nombre que tenga tu carpeta local)
```

### 2. Configurar Variables de Entorno

El proyecto requiere un archivo `.env` en la raíz para funcionar de manera correcta. Se provee un archivo de ejemplo llamado `.env.example`.

En Linux/MacOS:
```bash
cp .env.example .env
```
En Windows (PowerShell):
```powershell
Copy-Item .env.example -Destination .env
```

Abre el archivo `.env` resultante y revisa sus valores. Para un entorno de desarrollo local, los valores predeterminados (como contraseñas o secret keys dummy) deben ser suficientes. A futuro si despliegas en producción, actualiza dichos valores con secretos fuertes.

### 3. Levantar los Contenedores con Docker

Construye y levanta todos los servicios utilizando Docker Compose:

```bash
docker-compose up --build -d
```

Este comando descargará las imágenes necesarias, instalará las dependencias en ambos entornos (Node modules, Python packages) y levantará en segundo plano (`-d`) los contenedores:
- Base de datos relacional (`postgres`)
- Caché y encolado (`redis`)
- Backend API REST (`django`)
- Workers de tareas asíncronas y cron (`celery_worker`, `celery_beat`)
- Aplicación de Frontend (`vite`)
- Servidor Web Reverse-Proxy (`nginx`)

### 4. Aplicar Migraciones y Crear Superusuario

Una vez los contenedores estén corriendo de forma estable, debes aplicar las migraciones de los modelos a la base de datos de Django:

```bash
docker-compose exec backend python manage.py migrate
```

Luego, crea un superusuario (administrador) para poder ingresar al backend si es necesario:

```bash
docker-compose exec backend python manage.py createsuperuser
```
Sigue las instrucciones en consola ingresando tus credenciales (email y contraseña).

### 5. Acceso a la Aplicación

La aplicación se ejecuta íntegramente de manera local y todos sus servicios se conectan entre sí a la red de Docker. Los puertos se exponen exteriormente para que los puedas ver en tu explorador:

- **Aplicación Frontend (Interactiva)**: [http://localhost/](http://localhost/) (redireccionado por Nginx) o directo a [http://localhost:3000/](http://localhost:3000/)
- **API Backend**: Las rutas con prefijo `/api/` en [http://localhost/api/](http://localhost/api/) van dirigidas a la base de datos o en forma directa visitando [http://localhost:8000/](http://localhost:8000/).
- **Panel de Administración (Django):** [http://localhost/admin/](http://localhost/admin/) (redireccionado por Nginx) o visitando [http://localhost:8000/admin/](http://localhost:8000/admin/).

---

## 🛑 Gestión de Contenedores

Para ver el log en tiempo real de todos los contenedores y verificar que todo funciona:
```bash
docker-compose logs -f
```

Para detener los contenedores temporalmente sin impactar los datos en curso:
```bash
docker-compose stop
```

Para detener los contenedores y destruirlos por completo (ideal para cuando quieres reconstruir desde cero):
```bash
docker-compose down
```

*(Nota de seguridad: Los volúmenes de base de datos persisten en Docker gracias a Named Volumes (`postgres_data`, `redis_data`), por lo que toda la carga en la DB permanecerá conservada tras usar un `down`).*

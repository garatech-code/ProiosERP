# Guía de Instalación Definitiva: Proios Manager en TrueNAS

Esta guía detalla el proceso paso a paso para desplegar **Proios Manager** (ERP) y su **TV Dashboard** en el servidor de producción (TrueNAS) de su cliente.

Dado que el proyecto está completamente dockerizado, el proceso de instalación es limpio, seguro y no requiere instalar dependencias engorrosas directamente en el sistema operativo del servidor.

---

## 1. Requisitos Previos en TrueNAS

TrueNAS (específicamente TrueNAS SCALE) cuenta con soporte nativo para aplicaciones basadas en contenedores Docker. 

1. **Habilitar SSH:** Asegúrese de tener acceso SSH al servidor TrueNAS (se habilita desde la interfaz web de TrueNAS en *Services > SSH*).
2. **Docker Compose:** TrueNAS SCALE ya incluye Docker. Asegúrese de que el comando `docker compose` (o `docker-compose`) esté disponible en la consola.
3. **Red:** Asegúrese de que la IP del servidor TrueNAS sea estática dentro de la red local de la empresa (Ejemplo: `192.168.1.100`).

---

## 2. Descarga del Proyecto (Clonar el Repositorio)

1. Conéctese por SSH al servidor TrueNAS:
   ```bash
   ssh administrador@IP_DEL_TRUENAS
   ```
2. Navegue a la carpeta o *dataset* donde almacenará las aplicaciones (generalmente se crea un dataset específico para apps desde la interfaz de TrueNAS):
   ```bash
   cd /mnt/pool_name/apps_dataset/
   ```
3. Clone el repositorio directamente desde GitHub:
   ```bash
   git clone https://github.com/Antonio-Riveros/Stock.git proios_manager
   cd proios_manager
   ```

---

## 3. Configuración de Variables de Entorno

Antes de iniciar, el sistema necesita las credenciales de base de datos y configuraciones básicas.

1. Dentro de la carpeta del proyecto, copie el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```
2. Edite el archivo `.env` (puede usar el editor `nano`):
   ```bash
   nano .env
   ```
3. Configure los valores esenciales. Si va a utilizar la base de datos PostgreSQL local (incluida en el docker-compose), basta con configurar contraseñas seguras:
   ```env
   POSTGRES_DB=proios_db
   POSTGRES_USER=proios_admin
   POSTGRES_PASSWORD=una_contraseña_segura
   DB_HOST=db
   # Si utiliza Neon.tech u otro externo, reemplace DB_HOST por la URL externa y asegúrese de que sslmode=require.
   ```

---

## 4. Construcción y Despliegue de los Contenedores

Una vez configurado el archivo `.env`, inicie la construcción de la infraestructura. Este comando descargará las imágenes base y compilará el frontend, el backend y el TV Dashboard simultáneamente.

Ejecute en la raíz del proyecto:
```bash
docker-compose up -d --build
```
*(Este proceso puede tardar unos minutos la primera vez, ya que debe descargar librerías e instalar las dependencias de Node.js y Python).*

Una vez finalizado, verifique que todos los contenedores estén corriendo:
```bash
docker ps
```
Debería ver los contenedores de: `proios_db`, `proios_redis`, `proios_backend`, `proios_frontend`, `proios_tv_dashboard` y `proios_nginx`.

---

## 5. Inicialización de la Base de Datos

Ahora que los contenedores están corriendo, debe crear las tablas en la base de datos y el usuario administrador principal.

1. **Aplicar las migraciones (Crear las tablas):**
   ```bash
   docker exec -it proios_backend python manage.py migrate
   ```

2. **Crear el primer usuario Administrador (Owner):**
   ```bash
   docker exec -it proios_backend python manage.py createsuperuser
   ```
   *Siga las instrucciones en pantalla para ingresar un email, nombre de usuario y contraseña.*

---

## 6. Acceso al Sistema

¡El sistema ya está funcionando! Puede acceder desde cualquier computadora o dispositivo conectado a la red local de la oficina o a la red VPN de la empresa.

Asumiendo que la IP del servidor TrueNAS es `192.168.1.100`:

### ERP Principal (Proios Manager)
Abra su navegador web e ingrese a:
👉 **`http://192.168.1.100/`**
*(El servidor Nginx en el puerto 80 atenderá la petición automáticamente. Utilice el usuario administrador que acaba de crear).*

### TV Dashboard (Pantalla de Operaciones)
Para la MiniPC o Smart TV conectada en la oficina, abra el navegador a pantalla completa (suele ser pulsando `F11`) e ingrese a:
👉 **`http://192.168.1.100:4000/`**
*(El dashboard conectará de forma segura con el servidor, detectará que está en una IP local permitida y comenzará a mostrar las operaciones de inmediato, refrescándose automáticamente).*

---

## 7. Mantenimiento y Actualizaciones Futuras

Cuando usted (como desarrollador) haga nuevas mejoras y las suba a GitHub, para actualizar el servidor de su cliente solo debe ejecutar estos 3 comandos vía SSH en el servidor:

```bash
cd /mnt/pool_name/apps_dataset/proios_manager
git pull origin develop
docker-compose up -d --build
docker exec -it proios_backend python manage.py migrate
```

*(Esto descargará los últimos cambios, reconstruirá solo lo necesario y aplicará nuevas tablas a la base de datos sin borrar ninguna información existente).*

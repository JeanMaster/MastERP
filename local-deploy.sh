#!/bin/bash

# ==============================================================================
#   MastERP - Local Deploy Script
#   Despliega el sistema en un servidor Linux dentro de la red local
#   Uso: ./local-deploy.sh [SERVER_IP] [SERVER_USER]
#   Ejemplo: ./local-deploy.sh 192.168.1.10 masterp
# ==============================================================================

# --- Colores ---
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# --- Configuración ---
SERVER_IP="${1:-192.168.1.10}"
SERVER_USER="${2:-masterp}"
APP_NAME="masterp"
DEPLOY_DIR="/var/www/$APP_NAME"
BACKEND_DIR="/opt/$APP_NAME/backend"
NGINX_CONF="/etc/nginx/sites-available/$APP_NAME"
API_URL="http://$SERVER_IP/api"

# ==============================================================================
print_header() {
    echo ""
    echo -e "${BLUE}============================================================${NC}"
    echo -e "${BLUE}  🚀 MastERP - Local Deploy${NC}"
    echo -e "${BLUE}  Servidor: ${GREEN}$SERVER_USER@$SERVER_IP${NC}"
    echo -e "${BLUE}============================================================${NC}"
    echo ""
}

print_step() {
    echo ""
    echo -e "${CYAN}▶ $1${NC}"
}

print_ok() {
    echo -e "  ${GREEN}✔ $1${NC}"
}

print_warn() {
    echo -e "  ${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "  ${RED}✘ ERROR: $1${NC}"
    exit 1
}

# ==============================================================================
# PASO 0: Verificaciones locales
# ==============================================================================
print_header

print_step "Verificando entorno local..."

# Verificar que estamos en la raíz del proyecto
if [ ! -f "package-lock.json" ] && [ ! -d "apps" ]; then
    print_error "Debes ejecutar este script desde la raíz del proyecto MastERP."
fi

# Verificar que npm está disponible
command -v npm &>/dev/null || print_error "npm no encontrado. Instala Node.js primero."

# Verificar que SSH está disponible
command -v ssh &>/dev/null || print_error "ssh no encontrado."

# Verificar que scp está disponible
command -v scp &>/dev/null || print_error "scp no encontrado."

print_ok "Entorno local OK"
print_ok "Servidor destino: $SERVER_IP"
print_ok "API URL configurada: $API_URL"

# ==============================================================================
# PASO 1: Probar conexión SSH al servidor
# ==============================================================================
print_step "Probando conexión SSH al servidor..."

ssh -o ConnectTimeout=10 -o BatchMode=yes "$SERVER_USER@$SERVER_IP" "echo OK" &>/dev/null
if [ $? -ne 0 ]; then
    print_warn "No se puede conectar sin contraseña. Asegúrate de tener tu clave SSH configurada."
    print_warn "Puedes agregar tu clave con: ssh-copy-id $SERVER_USER@$SERVER_IP"
    echo ""
    echo -e "  Continuando con autenticación por contraseña..."
fi

print_ok "Conexión al servidor disponible"

# ==============================================================================
# PASO 2: Preparar el servidor (instalar dependencias si es primera vez)
# ==============================================================================
print_step "Preparando el servidor (dependencias del sistema)..."

ssh "$SERVER_USER@$SERVER_IP" bash <<'REMOTE_SETUP'
set -e

# Verificar si Node.js está instalado
if ! command -v node &>/dev/null; then
    echo "  → Instalando Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 
    sudo apt-get install -y nodejs
fi

# Verificar si PM2 está instalado
if ! command -v pm2 &>/dev/null; then
    echo "  → Instalando PM2..."
    sudo npm install -g pm2
fi

# Verificar si Nginx está instalado
if ! command -v nginx &>/dev/null; then
    echo "  → Instalando Nginx..."
    sudo apt-get install -y nginx
    sudo systemctl enable nginx
fi

# Verificar si PostgreSQL está instalado
if ! command -v psql &>/dev/null; then
    echo "  → Instalando PostgreSQL..."
    sudo apt-get install -y postgresql postgresql-contrib
    sudo systemctl enable postgresql
    sudo systemctl start postgresql
fi

echo "  ✔ Dependencias del sistema OK"
REMOTE_SETUP

print_ok "Servidor preparado"

# ==============================================================================
# PASO 3: Compilar el Frontend localmente
# ==============================================================================
print_step "Compilando Frontend para producción..."
print_warn "API URL que se incrustará: $API_URL"

cd apps/frontend

# Instalar dependencias si es necesario
if [ ! -d "node_modules" ]; then
    echo "  → Instalando dependencias del frontend..."
    npm install --silent
fi

# Compilar con la URL del servidor de la tienda
VITE_API_URL="$API_URL" npm run build

if [ ! -d "dist" ]; then
    print_error "La compilación del frontend falló. Revisa los errores arriba."
fi

print_ok "Frontend compilado exitosamente (carpeta: apps/frontend/dist)"
cd ../..

# ==============================================================================
# PASO 4: Subir Frontend al servidor
# ==============================================================================
print_step "Subiendo Frontend al servidor..."

# Crear directorio en el servidor
ssh "$SERVER_USER@$SERVER_IP" "sudo mkdir -p $DEPLOY_DIR && sudo chown -R $SERVER_USER:$SERVER_USER $DEPLOY_DIR"

# Copiar archivos compilados
scp -r apps/frontend/dist/* "$SERVER_USER@$SERVER_IP:$DEPLOY_DIR/"

print_ok "Frontend desplegado en $DEPLOY_DIR"

# ==============================================================================
# PASO 5: Subir Backend al servidor
# ==============================================================================
print_step "Subiendo Backend al servidor..."

# Crear directorio para el backend en el servidor
ssh "$SERVER_USER@$SERVER_IP" "sudo mkdir -p $BACKEND_DIR && sudo chown -R $SERVER_USER:$SERVER_USER $BACKEND_DIR"

# Copiar el código fuente del backend
# (excluimos node_modules y dist para no transferir archivos pesados)
rsync -az --exclude='node_modules' --exclude='dist' \
    apps/backend/ "$SERVER_USER@$SERVER_IP:$BACKEND_DIR/"

print_ok "Código del backend subido a $BACKEND_DIR"

# ==============================================================================
# PASO 6: Instalar dependencias y compilar Backend en el servidor
# ==============================================================================
print_step "Instalando dependencias y compilando Backend en el servidor..."

ssh "$SERVER_USER@$SERVER_IP" bash <<REMOTE_BACKEND
set -e
cd $BACKEND_DIR

echo "  → Instalando dependencias npm..."
npm install --production=false 2>&1 | tail -5

echo "  → Generando cliente Prisma..."
npx prisma generate

echo "  → Compilando TypeScript..."
npm run build

echo "  ✔ Backend compilado correctamente"
REMOTE_BACKEND

print_ok "Backend listo en el servidor"

# ==============================================================================
# PASO 7: Verificar/Crear base de datos PostgreSQL en el servidor
# ==============================================================================
print_step "Verificando base de datos PostgreSQL..."

ssh "$SERVER_USER@$SERVER_IP" bash <<'REMOTE_DB'
# Verificar si el usuario y la base de datos existen
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='valery_db'" 2>/dev/null)
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='valery'" 2>/dev/null)

if [ "$USER_EXISTS" != "1" ]; then
    echo "  → Creando usuario PostgreSQL 'valery'..."
    sudo -u postgres psql -c "CREATE USER valery WITH PASSWORD 'valery_prod_password';"
fi

if [ "$DB_EXISTS" != "1" ]; then
    echo "  → Creando base de datos 'valery_db'..."
    sudo -u postgres psql -c "CREATE DATABASE valery_db OWNER valery;"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE valery_db TO valery;"
fi

echo "  ✔ Base de datos OK"
REMOTE_DB

print_ok "Base de datos PostgreSQL lista"

# ==============================================================================
# PASO 8: Ejecutar migraciones de Prisma en el servidor
# ==============================================================================
print_step "Ejecutando migraciones de base de datos..."

ssh "$SERVER_USER@$SERVER_IP" bash <<REMOTE_MIGRATE
set -e
cd $BACKEND_DIR

# Verificar que el .env de producción exista
if [ ! -f ".env" ]; then
    echo "  ⚠ No se encontró .env en el servidor."
    echo "  → Creando .env de producción por defecto..."
    cat > .env <<EOF
DATABASE_URL="postgresql://valery:valery_prod_password@localhost:5432/valery_db?schema=public"
JWT_SECRET=CAMBIA_ESTA_CLAVE_SECRETA_POR_UNA_MUY_LARGA_Y_SEGURA
JWT_EXPIRATION=7d
NODE_ENV=production
PORT=3000
CORS_ORIGIN=http://$SERVER_IP
API_PREFIX=api
API_VERSION=v1
EOF
    echo "  ⚠ IMPORTANTE: Edita $BACKEND_DIR/.env y cambia el JWT_SECRET"
fi

echo "  → Aplicando migraciones..."
npx prisma migrate deploy

echo "  ✔ Migraciones aplicadas"
REMOTE_MIGRATE

print_ok "Migraciones ejecutadas correctamente"

# ==============================================================================
# PASO 9: Configurar Nginx
# ==============================================================================
print_step "Configurando Nginx como servidor web y proxy inverso..."

ssh "$SERVER_USER@$SERVER_IP" bash <<REMOTE_NGINX
# Crear configuración de Nginx
sudo tee $NGINX_CONF > /dev/null <<'NGINX_CONFIG'
server {
    listen 80;
    server_name $SERVER_IP _;

    # ── Frontend (archivos estáticos compilados de Vite) ──────────────────
    root $DEPLOY_DIR;
    index index.html;

    # Soporte para React Router (SPA)
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # ── Backend API (proxy inverso a NestJS en puerto 3000) ───────────────
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 20M;
    }

    # ── Logs ──────────────────────────────────────────────────────────────
    access_log /var/log/nginx/masterp.access.log;
    error_log  /var/log/nginx/masterp.error.log;
}
NGINX_CONFIG

# Activar el sitio
sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/$APP_NAME

# Desactivar el sitio por defecto de Nginx si existe
sudo rm -f /etc/nginx/sites-enabled/default

# Verificar configuración y recargar
sudo nginx -t && sudo systemctl reload nginx
echo "  ✔ Nginx configurado y recargado"
REMOTE_NGINX

print_ok "Nginx configurado correctamente"

# ==============================================================================
# PASO 10: Iniciar/Reiniciar Backend con PM2
# ==============================================================================
print_step "Iniciando Backend con PM2..."

ssh "$SERVER_USER@$SERVER_IP" bash <<REMOTE_PM2
cd $BACKEND_DIR

# Si ya existe el proceso en PM2, lo reiniciamos; si no, lo creamos
if pm2 describe $APP_NAME-backend &>/dev/null; then
    echo "  → Reiniciando proceso existente en PM2..."
    pm2 restart $APP_NAME-backend
else
    echo "  → Registrando nuevo proceso en PM2..."
    pm2 start dist/src/main.js \
        --name "$APP_NAME-backend" \
        --cwd "$BACKEND_DIR" \
        --log /var/log/$APP_NAME/backend.log \
        --time
fi

# Guardar lista de procesos para auto-inicio
pm2 save

# Configurar PM2 para iniciarse con el sistema operativo (solo primera vez)
pm2 startup systemd -u $SERVER_USER --hp /home/$SERVER_USER 2>/dev/null | grep "sudo" | bash || true

echo "  ✔ Backend corriendo con PM2"
pm2 list
REMOTE_PM2

print_ok "Backend iniciado con PM2"

# ==============================================================================
# FIN: Resumen
# ==============================================================================
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}  ✨ ¡Despliegue Completado Exitosamente! ✨${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "  🌐 Sistema accesible en la red local:"
echo -e "     ${GREEN}http://$SERVER_IP${NC}"
echo ""
echo -e "  📋 Acceso desde cada PC de la tienda:"
echo -e "     Abrir ${YELLOW}Chrome o Firefox${NC} y navegar a:"
echo -e "     ${GREEN}http://$SERVER_IP${NC}"
echo ""
echo -e "  🔧 Comandos útiles en el servidor:"
echo -e "     ${CYAN}pm2 status${NC}            → Ver estado del backend"
echo -e "     ${CYAN}pm2 logs masterp-backend${NC} → Ver logs en tiempo real"
echo -e "     ${CYAN}pm2 restart masterp-backend${NC} → Reiniciar backend"
echo -e "     ${CYAN}sudo systemctl status nginx${NC} → Ver estado de Nginx"
echo ""
echo -e "  ⚠️  ${YELLOW}IMPORTANTE: Verifica el archivo .env en el servidor:${NC}"
echo -e "     ${CYAN}nano $BACKEND_DIR/.env${NC}"
echo -e "     Asegúrate de cambiar ${RED}JWT_SECRET${NC} por una clave segura."
echo ""

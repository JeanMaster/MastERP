#!/bin/bash

# ==============================================================================
#   MastERP - Instalación Presencial en Tienda
#   
#   Este script se ejecuta DIRECTAMENTE EN EL SERVIDOR de la tienda.
#   Puede usarse desde:
#     - USB: copia el proyecto al servidor y ejecuta este script
#     - Git:  git clone <repo> && cd MastERP && ./deploy/onsite-install.sh
#
#   Uso: sudo ./deploy/onsite-install.sh
# ==============================================================================

# --- Colores ---
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

APP_NAME="masterp"
DEPLOY_DIR="/var/www/$APP_NAME"
BACKEND_DIR="/opt/$APP_NAME/backend"
LOG_DIR="/var/log/$APP_NAME"

# ==============================================================================
print_banner() {
    clear
    echo -e "${BLUE}"
    echo "  ╔══════════════════════════════════════════════════════╗"
    echo "  ║       MastERP - Instalación en Servidor Local        ║"
    echo "  ║              Script de Instalación Inicial           ║"
    echo "  ╚══════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo ""
    echo -e "${CYAN}${BOLD}[ PASO $1 ]${NC} ${CYAN}$2${NC}"
    echo -e "${CYAN}$(printf '─%.0s' {1..55})${NC}"
}

print_ok()    { echo -e "  ${GREEN}✔  $1${NC}"; }
print_warn()  { echo -e "  ${YELLOW}⚠  $1${NC}"; }
print_info()  { echo -e "  ${BLUE}ℹ  $1${NC}"; }
print_error() { echo -e "\n  ${RED}✘  ERROR: $1${NC}\n"; exit 1; }

ask() {
    echo -ne "  ${BOLD}$1${NC} [${CYAN}$2${NC}]: "
    read -r response
    echo "${response:-$2}"
}

# ==============================================================================
# INICIO
# ==============================================================================
print_banner

# Verificar que se ejecuta como root
if [ "$EUID" -ne 0 ]; then
    print_error "Este script requiere permisos de superusuario. Usa: sudo ./deploy/onsite-install.sh"
fi

# Verificar que estamos en la raíz del proyecto
if [ ! -d "apps/backend" ] || [ ! -d "apps/frontend" ]; then
    print_error "Ejecuta este script desde la raíz del proyecto MastERP."
fi

echo -e "  Bienvenido al asistente de instalación de ${BOLD}MastERP${NC}."
echo -e "  Este proceso configurará el servidor de la tienda."
echo -e "  Duración estimada: ${YELLOW}5-10 minutos${NC}"
echo ""

# ==============================================================================
# PASO 1: Recopilar configuración
# ==============================================================================
print_step "1" "Configuración del Sistema"

# Detectar IP local automáticamente
DETECTED_IP=$(hostname -I | awk '{print $1}')
echo ""
echo -e "  IP detectada del servidor: ${GREEN}$DETECTED_IP${NC}"
SERVER_IP=$(ask "IP local del servidor (la que usarán las cajas para conectarse)" "$DETECTED_IP")

DB_PASSWORD=$(ask "Contraseña para la base de datos" "masterp_prod_$(date +%Y)")
JWT_SECRET=$(ask "Clave secreta JWT (déjala aleatoria o escribe una)" "$(openssl rand -hex 32 2>/dev/null || echo 'cambia-esta-clave-secreta-larga')")
SERVER_USER=$(ask "Usuario Linux que correrá la aplicación" "$SUDO_USER")

echo ""
echo -e "  ${BOLD}Resumen de configuración:${NC}"
echo -e "    IP del Servidor:  ${GREEN}$SERVER_IP${NC}"
echo -e "    Usuario del App:  ${GREEN}$SERVER_USER${NC}"
echo -e "    Acceso desde las cajas: ${GREEN}http://$SERVER_IP${NC}"
echo ""
echo -ne "  ¿Confirmar e iniciar instalación? [S/n]: "
read -r confirm
confirm="${confirm:-S}"
if [[ ! "$confirm" =~ ^[Ss]$ ]]; then
    echo "  Instalación cancelada."
    exit 0
fi

# ==============================================================================
# PASO 2: Instalar dependencias del sistema
# ==============================================================================
print_step "2" "Instalando Dependencias del Sistema"

echo "  → Actualizando lista de paquetes..."
apt-get update -qq

# Node.js
if ! command -v node &>/dev/null; then
    echo "  → Instalando Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - &>/dev/null
    apt-get install -y nodejs &>/dev/null
    print_ok "Node.js $(node -v) instalado"
else
    print_ok "Node.js $(node -v) ya instalado"
fi

# PM2
if ! command -v pm2 &>/dev/null; then
    echo "  → Instalando PM2..."
    npm install -g pm2 &>/dev/null
    print_ok "PM2 instalado"
else
    print_ok "PM2 ya instalado"
fi

# Nginx
if ! command -v nginx &>/dev/null; then
    echo "  → Instalando Nginx..."
    apt-get install -y nginx &>/dev/null
    systemctl enable nginx &>/dev/null
    print_ok "Nginx instalado"
else
    print_ok "Nginx ya instalado"
fi

# PostgreSQL
if ! command -v psql &>/dev/null; then
    echo "  → Instalando PostgreSQL..."
    apt-get install -y postgresql postgresql-contrib &>/dev/null
    systemctl enable postgresql &>/dev/null
    systemctl start postgresql
    print_ok "PostgreSQL instalado"
else
    print_ok "PostgreSQL ya instalado"
    systemctl start postgresql 2>/dev/null || true
fi

# ==============================================================================
# PASO 3: Configurar base de datos
# ==============================================================================
print_step "3" "Configurando Base de Datos PostgreSQL"

DB_USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='valery'" 2>/dev/null)
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='valery_db'" 2>/dev/null)

if [ "$DB_USER_EXISTS" != "1" ]; then
    sudo -u postgres psql -c "CREATE USER valery WITH PASSWORD '$DB_PASSWORD';" &>/dev/null
    print_ok "Usuario 'valery' de PostgreSQL creado"
else
    sudo -u postgres psql -c "ALTER USER valery WITH PASSWORD '$DB_PASSWORD';" &>/dev/null
    print_ok "Contraseña del usuario 'valery' actualizada"
fi

if [ "$DB_EXISTS" != "1" ]; then
    sudo -u postgres psql -c "CREATE DATABASE valery_db OWNER valery;" &>/dev/null
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE valery_db TO valery;" &>/dev/null
    print_ok "Base de datos 'valery_db' creada"
else
    print_ok "Base de datos 'valery_db' ya existe"
fi

# ==============================================================================
# PASO 4: Preparar el Backend
# ==============================================================================
print_step "4" "Preparando Backend (API)"

# Crear directorios
mkdir -p "$BACKEND_DIR" "$LOG_DIR"
chown -R "$SERVER_USER":"$SERVER_USER" "$BACKEND_DIR" "$LOG_DIR"

# Copiar código del backend
echo "  → Copiando código del backend..."
rsync -a --exclude='node_modules' --exclude='dist' apps/backend/ "$BACKEND_DIR/"
chown -R "$SERVER_USER":"$SERVER_USER" "$BACKEND_DIR"

# Crear .env de producción
cat > "$BACKEND_DIR/.env" <<EOF
# MastERP - Configuración de Producción
# Generado el $(date '+%Y-%m-%d %H:%M')

# Base de Datos
DATABASE_URL="postgresql://valery:${DB_PASSWORD}@localhost:5432/valery_db?schema=public"

# Seguridad
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRATION=7d

# Servidor
NODE_ENV=production
PORT=3000

# CORS (solo permite el servidor local)
CORS_ORIGIN=http://${SERVER_IP}

# API
API_PREFIX=api
API_VERSION=v1
EOF

print_ok ".env de producción creado"

# Instalar dependencias del backend
echo "  → Instalando dependencias npm..."
cd "$BACKEND_DIR"
sudo -u "$SERVER_USER" npm install --production=false 2>&1 | tail -3

# Generar cliente Prisma
echo "  → Generando cliente Prisma..."
sudo -u "$SERVER_USER" npx prisma generate 2>&1 | tail -3

# Ejecutar migraciones
echo "  → Aplicando migraciones de base de datos..."
sudo -u "$SERVER_USER" npx prisma migrate deploy 2>&1 | tail -5

# Compilar TypeScript
echo "  → Compilando TypeScript..."
sudo -u "$SERVER_USER" npm run build 2>&1 | tail -3

print_ok "Backend compilado correctamente"
cd - > /dev/null

# ==============================================================================
# PASO 5: Compilar y desplegar Frontend
# ==============================================================================
print_step "5" "Compilando Frontend (Interfaz de Usuario)"

mkdir -p "$DEPLOY_DIR"
chown -R "$SERVER_USER":"$SERVER_USER" "$DEPLOY_DIR"

echo "  → Instalando dependencias del frontend..."
cd apps/frontend
sudo -u "$SERVER_USER" npm install 2>&1 | tail -3

echo "  → Compilando con URL del servidor: http://$SERVER_IP/api"
sudo -u "$SERVER_USER" bash -c "VITE_API_URL=http://$SERVER_IP/api npm run build" 2>&1 | tail -5

if [ ! -d "dist" ]; then
    print_error "La compilación del frontend falló. Revisa los errores."
fi

cp -r dist/* "$DEPLOY_DIR/"
chown -R www-data:www-data "$DEPLOY_DIR"
print_ok "Frontend desplegado en $DEPLOY_DIR"
cd - > /dev/null

# ==============================================================================
# PASO 6: Configurar Nginx
# ==============================================================================
print_step "6" "Configurando Nginx"

cat > "/etc/nginx/sites-available/$APP_NAME" <<NGINX_EOF
server {
    listen 80;
    server_name $SERVER_IP _;

    # Frontend (archivos estáticos de Vite)
    root $DEPLOY_DIR;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API (proxy inverso a NestJS)
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

    access_log $LOG_DIR/nginx.access.log;
    error_log  $LOG_DIR/nginx.error.log;
}
NGINX_EOF

ln -sf "/etc/nginx/sites-available/$APP_NAME" "/etc/nginx/sites-enabled/$APP_NAME"
rm -f /etc/nginx/sites-enabled/default

nginx -t &>/dev/null && systemctl reload nginx
print_ok "Nginx configurado y activo"

# ==============================================================================
# PASO 7: Iniciar Backend con PM2
# ==============================================================================
print_step "7" "Iniciando Backend con PM2"

# Cambiar al usuario de la aplicación para correr PM2
sudo -u "$SERVER_USER" bash <<PM2_SETUP
cd $BACKEND_DIR

# Detener proceso anterior si existe
pm2 delete $APP_NAME-backend 2>/dev/null || true

# Iniciar el backend
pm2 start dist/src/main.js \
    --name "$APP_NAME-backend" \
    --cwd "$BACKEND_DIR" \
    --log $LOG_DIR/backend.log \
    --time \
    --restart-delay 3000

pm2 save
PM2_SETUP

# Configurar PM2 para auto-inicio al encender el servidor
PM2_STARTUP=$(sudo -u "$SERVER_USER" pm2 startup systemd -u "$SERVER_USER" --hp "/home/$SERVER_USER" 2>/dev/null | grep "sudo env")
if [ -n "$PM2_STARTUP" ]; then
    eval "$PM2_STARTUP" &>/dev/null
fi

print_ok "Backend corriendo con PM2 (auto-inicio habilitado)"

# ==============================================================================
# VERIFICACIÓN FINAL
# ==============================================================================
print_step "8" "Verificación Final"

sleep 3  # Dar tiempo a que NestJS arranque

# Test del backend
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api 2>/dev/null)
if [[ "$BACKEND_STATUS" == "200" || "$BACKEND_STATUS" == "404" || "$BACKEND_STATUS" == "401" ]]; then
    print_ok "Backend respondiendo correctamente (HTTP $BACKEND_STATUS)"
else
    print_warn "Backend puede estar iniciando aún (HTTP $BACKEND_STATUS). Revisa con: pm2 logs $APP_NAME-backend"
fi

# Test del frontend via Nginx
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost 2>/dev/null)
if [[ "$FRONTEND_STATUS" == "200" ]]; then
    print_ok "Frontend accesible via Nginx (HTTP $FRONTEND_STATUS)"
else
    print_warn "Nginx: HTTP $FRONTEND_STATUS. Revisa con: sudo nginx -t"
fi

# ==============================================================================
# RESUMEN FINAL
# ==============================================================================
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✨  ¡Instalación Completada Exitosamente!  ✨     ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  🌐 ${BOLD}El sistema está disponible en:${NC}"
echo -e "     ${GREEN}http://$SERVER_IP${NC}"
echo ""
echo -e "  💻 ${BOLD}Instrucciones para las cajas y el administrador:${NC}"
echo -e "     Abrir ${YELLOW}Chrome o Firefox${NC} y navegar a:"
echo -e "     ${GREEN}http://$SERVER_IP${NC}"
echo ""
echo -e "  🔧 ${BOLD}Comandos útiles de mantenimiento:${NC}"
echo -e "     ${CYAN}pm2 status${NC}                     → Estado del backend"
echo -e "     ${CYAN}pm2 logs $APP_NAME-backend${NC}  → Ver logs en vivo"
echo -e "     ${CYAN}pm2 restart $APP_NAME-backend${NC} → Reiniciar backend"
echo -e "     ${CYAN}sudo systemctl status nginx${NC}   → Estado de Nginx"
echo -e "     ${CYAN}sudo systemctl status postgresql${NC} → Estado de la BD"
echo ""
echo -e "  📄 ${BOLD}Logs del sistema:${NC}"
echo -e "     Backend: ${CYAN}$LOG_DIR/backend.log${NC}"
echo -e "     Nginx:   ${CYAN}$LOG_DIR/nginx.access.log${NC}"
echo ""
echo -e "  ⚠️  ${YELLOW}IMPORTANTE:${NC}"
echo -e "     El archivo de configuración está en:"
echo -e "     ${CYAN}$BACKEND_DIR/.env${NC}"
echo ""

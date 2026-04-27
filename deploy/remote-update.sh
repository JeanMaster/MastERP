#!/bin/bash

# ==============================================================================
#   MastERP - Actualización Remota (desde PC del desarrollador)
#
#   Este script se ejecuta en TU PC (no en el servidor).
#   Se conecta al servidor de la tienda via SSH y despliega la última versión.
#
#   Requisitos previos:
#     - El servidor ya debe tener la instalación inicial hecha con onsite-install.sh
#     - Tu clave SSH debe estar autorizada en el servidor
#     - El código debe estar en el repo git actualizado
#
#   Uso: ./deploy/remote-update.sh [IP_SERVIDOR] [USUARIO]
#   Ejemplo: ./deploy/remote-update.sh 192.168.1.10 masterp
# ==============================================================================

# --- Colores ---
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# --- Configuración ---
SERVER_IP="${1:-}"
SERVER_USER="${2:-masterp}"
APP_NAME="masterp"
DEPLOY_DIR="/var/www/$APP_NAME"
BACKEND_DIR="/opt/$APP_NAME/backend"
LOG_DIR="/var/log/$APP_NAME"

# ==============================================================================
print_banner() {
    clear
    echo -e "${BLUE}"
    echo "  ╔══════════════════════════════════════════════════════╗"
    echo "  ║      MastERP - Actualización Remota vía SSH          ║"
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

# ==============================================================================
# INICIO
# ==============================================================================
print_banner

# Verificar parámetros
if [ -z "$SERVER_IP" ]; then
    echo -ne "  ${BOLD}IP del servidor de la tienda:${NC} "
    read -r SERVER_IP
    [ -z "$SERVER_IP" ] && print_error "Debes especificar la IP del servidor."
fi

echo -e "  Actualizando ${BOLD}MastERP${NC} en el servidor ${GREEN}$SERVER_USER@$SERVER_IP${NC}"
echo ""

# Verificar que estamos en la raíz del proyecto
if [ ! -d "apps/backend" ] || [ ! -d "apps/frontend" ]; then
    print_error "Ejecuta este script desde la raíz del proyecto MastERP."
fi

# ==============================================================================
# PASO 1: Verificar conexión SSH
# ==============================================================================
print_step "1" "Verificando conexión SSH al servidor"

ssh -o ConnectTimeout=10 -o BatchMode=yes "$SERVER_USER@$SERVER_IP" "echo OK" &>/dev/null
if [ $? -ne 0 ]; then
    print_warn "No se puede conectar sin contraseña. Configurando autenticación..."
    echo ""
    echo -e "  Para evitar ingresar la contraseña en cada actualización, corre:"
    echo -e "  ${CYAN}ssh-copy-id $SERVER_USER@$SERVER_IP${NC}"
    echo ""
fi

# Verificar que el servidor tiene la instalación base
ssh "$SERVER_USER@$SERVER_IP" "[ -d $BACKEND_DIR ] && [ -d $DEPLOY_DIR ]" 2>/dev/null
if [ $? -ne 0 ]; then
    print_error "El servidor no tiene la instalación inicial. Ejecuta primero onsite-install.sh en el servidor."
fi

print_ok "Conexión SSH OK"

# Obtener la versión actual del servidor para el log
REMOTE_VERSION=$(ssh "$SERVER_USER@$SERVER_IP" "cat $BACKEND_DIR/package.json 2>/dev/null | grep '\"version\"' | head -1 | awk -F'\"' '{print \$4}'" 2>/dev/null)
LOCAL_VERSION=$(grep '"version"' apps/backend/package.json | head -1 | awk -F'"' '{print $4}')
print_info "Versión en servidor: ${REMOTE_VERSION:-desconocida}  →  Local: ${LOCAL_VERSION:-desconocida}"

# ==============================================================================
# PASO 2: Mostrar qué cambios se van a subir
# ==============================================================================
print_step "2" "Verificando cambios a desplegar"

COMMIT_HASH=$(git log -1 --format="%h" 2>/dev/null || echo "sin git")
COMMIT_MSG=$(git log -1 --format="%s" 2>/dev/null || echo "")
COMMIT_DATE=$(git log -1 --format="%ai" 2>/dev/null || echo "")

echo ""
echo -e "  ${BOLD}Último commit a desplegar:${NC}"
echo -e "    Hash:    ${CYAN}$COMMIT_HASH${NC}"
echo -e "    Mensaje: ${YELLOW}$COMMIT_MSG${NC}"
echo -e "    Fecha:   $COMMIT_DATE"
echo ""
echo -ne "  ¿Continuar con el despliegue? [S/n]: "
read -r confirm
confirm="${confirm:-S}"
[[ ! "$confirm" =~ ^[Ss]$ ]] && echo "  Despliegue cancelado." && exit 0

# ==============================================================================
# PASO 3: Compilar Frontend localmente
# ==============================================================================
print_step "3" "Compilando Frontend (en tu PC)"

print_info "API URL: http://$SERVER_IP/api"

cd apps/frontend

if [ ! -d "node_modules" ]; then
    echo "  → Instalando dependencias..."
    npm install --silent
fi

echo "  → Compilando..."
VITE_API_URL="http://$SERVER_IP/api" npm run build 2>&1 | tail -5

if [ ! -d "dist" ]; then
    print_error "La compilación del frontend falló."
fi

print_ok "Frontend compilado correctamente"
cd ../..

# ==============================================================================
# PASO 4: Subir Frontend al servidor
# ==============================================================================
print_step "4" "Subiendo Frontend al servidor"

echo "  → Limpiando versión anterior..."
ssh "$SERVER_USER@$SERVER_IP" "sudo rm -rf $DEPLOY_DIR/* && sudo mkdir -p $DEPLOY_DIR && sudo chown $SERVER_USER:$SERVER_USER $DEPLOY_DIR"

echo "  → Transfiriendo archivos ($(du -sh apps/frontend/dist | cut -f1))..."
scp -r -q apps/frontend/dist/* "$SERVER_USER@$SERVER_IP:$DEPLOY_DIR/"

ssh "$SERVER_USER@$SERVER_IP" "sudo chown -R www-data:www-data $DEPLOY_DIR"

print_ok "Frontend actualizado en el servidor"

# ==============================================================================
# PASO 5: Actualizar Backend en el servidor
# ==============================================================================
print_step "5" "Actualizando Backend en el servidor"

echo "  → Sincronizando código fuente..."
rsync -az --exclude='node_modules' --exclude='dist' --exclude='.env' \
    apps/backend/ "$SERVER_USER@$SERVER_IP:$BACKEND_DIR/"

print_ok "Código del backend transferido"

# ==============================================================================
# PASO 6: Recompilar e instalar dependencias en el servidor
# ==============================================================================
print_step "6" "Compilando Backend en el servidor"

ssh "$SERVER_USER@$SERVER_IP" bash <<REMOTE_BUILD
set -e
cd $BACKEND_DIR

echo "  → Instalando/actualizando dependencias..."
npm install --production=false 2>&1 | tail -3

echo "  → Generando cliente Prisma..."
npx prisma generate 2>&1 | tail -2

echo "  → Compilando TypeScript..."
npm run build 2>&1 | tail -3
REMOTE_BUILD

print_ok "Backend compilado en el servidor"

# ==============================================================================
# PASO 7: Ejecutar migraciones de base de datos
# ==============================================================================
print_step "7" "Ejecutando migraciones de base de datos"

ssh "$SERVER_USER@$SERVER_IP" bash <<REMOTE_MIGRATE
set -e
cd $BACKEND_DIR
echo "  → Aplicando migraciones..."
npx prisma migrate deploy 2>&1 | tail -5
REMOTE_MIGRATE

print_ok "Migraciones ejecutadas"

# ==============================================================================
# PASO 8: Reiniciar el Backend
# ==============================================================================
print_step "8" "Reiniciando Backend"

ssh "$SERVER_USER@$SERVER_IP" bash <<REMOTE_RESTART
cd $BACKEND_DIR

echo "  → Reiniciando proceso PM2..."
pm2 restart $APP_NAME-backend
pm2 save

echo "  → Recargando Nginx..."
sudo nginx -t && sudo systemctl reload nginx
REMOTE_RESTART

print_ok "Servicios reiniciados"

# ==============================================================================
# PASO 9: Verificación final
# ==============================================================================
print_step "9" "Verificación Final"

sleep 4  # Dar tiempo a que NestJS arranque completamente

# Test del backend
BACKEND_STATUS=$(ssh "$SERVER_USER@$SERVER_IP" "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api 2>/dev/null")
if [[ "$BACKEND_STATUS" == "200" || "$BACKEND_STATUS" == "404" || "$BACKEND_STATUS" == "401" ]]; then
    print_ok "Backend respondiendo (HTTP $BACKEND_STATUS)"
else
    print_warn "Backend HTTP $BACKEND_STATUS — puede estar iniciando. Revisa: pm2 logs $APP_NAME-backend"
fi

# Test del frontend
FRONTEND_STATUS=$(ssh "$SERVER_USER@$SERVER_IP" "curl -s -o /dev/null -w '%{http_code}' http://localhost 2>/dev/null")
if [[ "$FRONTEND_STATUS" == "200" ]]; then
    print_ok "Frontend accesible via Nginx (HTTP $FRONTEND_STATUS)"
else
    print_warn "Nginx HTTP $FRONTEND_STATUS"
fi

# Guardar log del deploy
DEPLOY_LOG="$SERVER_USER@$SERVER_IP:$LOG_DIR/deploys.log"
ssh "$SERVER_USER@$SERVER_IP" "echo '[$(date +%Y-%m-%d\ %H:%M)] Deploy exitoso - Commit: $COMMIT_HASH - $COMMIT_MSG' >> $LOG_DIR/deploys.log" 2>/dev/null

# ==============================================================================
# RESUMEN FINAL
# ==============================================================================
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║    ✨  ¡Actualización Desplegada Exitosamente!  ✨   ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  🌐 Sistema actualizado en: ${GREEN}http://$SERVER_IP${NC}"
echo -e "  📦 Commit desplegado:      ${CYAN}$COMMIT_HASH${NC} - $COMMIT_MSG"
echo ""
echo -e "  🔧 Para ver el estado del servidor:"
echo -e "     ${CYAN}ssh $SERVER_USER@$SERVER_IP 'pm2 status'${NC}"
echo -e "     ${CYAN}ssh $SERVER_USER@$SERVER_IP 'pm2 logs $APP_NAME-backend --lines 50'${NC}"
echo ""

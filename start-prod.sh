#!/bin/bash

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}===================================================${NC}"
echo -e "${BLUE}   🚀 MastERP - Servidor de Producción   ${NC}"
echo -e "${BLUE}===================================================${NC}"
echo ""

# 0. Asegurar que estamos en el directorio raíz del proyecto
PROJECT_ROOT=$(cd "$(dirname "$0")" && pwd)
cd "$PROJECT_ROOT" || exit 1

# 0.1 Verificar si ya está corriendo para evitar duplicados
if pgrep -f "node.*/MastERP/apps/backend" > /dev/null || pgrep -f "vite.*--host" > /dev/null; then
    echo -e "${YELLOW}⚠️  Los servidores ya están en ejecución.${NC}"
    echo -e "   Si deseas reiniciarlos, ejecuta primero: ${BLUE}stopz${NC}"
    exit 0
fi

# 0.2 Cargar Entorno (NVM/Node)
# Requerido para ejecuciones automáticas desde Windows/VBS
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm no encontrado. Verifique la instalación de Node/NVM."
    exit 1
fi

# 1. Configuración de IP Fija
HOST_IP="192.168.127.107"
API_URL="http://$HOST_IP:3000/api"

echo -e "⚙️  Configurando sistema para IP Fija: ${GREEN}$HOST_IP${NC}"
echo -e "🔗 API URL: ${GREEN}$API_URL${NC}"
echo ""

# 2. Iniciar Backend
echo -e "${GREEN}📦Iniciando Backend (Cerebro)...${NC}"
cd apps/backend
setsid npm run start:dev > ../../backend.prod.log 2>&1 &
sleep 1
BACKEND_PID=$(pgrep -f "node.*/MastERP/apps/backend" | tail -n 1)
cd ../..
echo $BACKEND_PID > .masterp.pids
echo "   ✅ Backend corriendo [PID: $BACKEND_PID]"

# 3. Iniciar Frontend
echo -e "${GREEN}💻Iniciando Frontend (Interfaz)...${NC}"
cd apps/frontend
setsid bash -c "VITE_API_URL=$API_URL npm run dev -- --host" > ../../frontend.prod.log 2>&1 &
sleep 1
FRONTEND_PID=$(pgrep -f "vite.*--host" | tail -n 1)
cd ../..
echo $FRONTEND_PID >> .masterp.pids
echo "   ✅ Frontend corriendo [PID: $FRONTEND_PID]"

echo ""
echo -e "${BLUE}===================================================${NC}"
echo -e "${GREEN}✨ ¡Sistema en Línea! ✨${NC}"
echo -e "${BLUE}===================================================${NC}"
echo -e "🌍 Accede desde cualquier PC en la red:"
echo -e "   👉 ${GREEN}http://$HOST_IP:5173${NC}"
echo ""
echo -e "📄 Logs disponibles en:"
echo "   - backend.prod.log"
echo "   - frontend.prod.log"
echo ""
echo -e "🔴 Para detener los servidores de forma segura, ejecuta:"
echo "   stopz"
echo ""

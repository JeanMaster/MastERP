#!/bin/bash

# restart-local.sh
# Reinicio limpio y completo para desarrollo local
# - Detiene servidores
# - Mata procesos residuales de forma segura (sin tocar VSCode/WSL)
# - Hace build de backend y frontend
# - Levanta todo de nuevo limpio

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   🔄 MastERP - Reinicio Limpio Local (Dev)                ${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# Ir a la raíz del proyecto
PROJECT_ROOT=$(cd "$(dirname "$0")" && pwd)
cd "$PROJECT_ROOT"

echo -e "${YELLOW}🛑 Paso 1: Deteniendo servidores...${NC}"

# Intentar usar stop-local si existe, sino hacer kill manual seguro
if [ -f "./stop-local.sh" ]; then
    ./stop-local.sh || true
else
    # Matamos de forma segura solo lo relacionado con el proyecto
    pkill -9 -f "node.*/ValeryPort/apps/backend" 2>/dev/null || true
    pkill -9 -f "node.*/ValeryPort/apps/frontend" 2>/dev/null || true
    pkill -9 -f "vite.*--host" 2>/dev/null || true
    pkill -9 -f "nest start" 2>/dev/null || true
    pkill -9 -f "dist/src/main" 2>/dev/null || true
fi

echo -e "${GREEN}✅ Servidores detenidos.${NC}"
echo ""

echo -e "${YELLOW}🧹 Paso 2: Matando procesos residuales de forma segura...${NC}"

# Matamos solo procesos específicos del proyecto (no tocamos VSCode Server)
sudo pkill -9 -f "dist/src/main" 2>/dev/null || true
sudo pkill -9 -f "ValeryPort/apps/backend" 2>/dev/null || true
sudo pkill -9 -f "vite" 2>/dev/null || true
sudo pkill -9 -f "nest start" 2>/dev/null || true

# Limpiamos archivo de PIDs si existe
rm -f .masterp.pids

echo -e "${GREEN}✅ Procesos residuales eliminados.${NC}"
echo ""

echo -e "\n${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}   🔨 PASO 3: Haciendo build (Backend + Frontend)          ${NC}"
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}\n"

BACKEND_BUILD_OK=false
FRONTEND_BUILD_OK=false

echo -e "${BLUE}[1/2] Compilando Backend...${NC}"
cd "$PROJECT_ROOT/apps/backend"
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}      ✅ Backend compilado correctamente${NC}"
    BACKEND_BUILD_OK=true
else
    echo -e "${RED}      ❌ Error al compilar el Backend${NC}"
    BACKEND_BUILD_OK=false
fi

echo ""

echo -e "${BLUE}[2/2] Compilando Frontend...${NC}"
cd "$PROJECT_ROOT/apps/frontend"
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}      ✅ Frontend compilado correctamente${NC}"
    FRONTEND_BUILD_OK=true
else
    echo -e "${RED}      ❌ Error al compilar el Frontend${NC}"
    FRONTEND_BUILD_OK=false
fi

cd "$PROJECT_ROOT"

echo -e "\n${GREEN}✅ Paso 3 completado${NC}"
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}\n"

echo -e "${YELLOW}🚀 Paso 4: Iniciando servidores limpios...${NC}"

# Cargamos NVM si existe (útil en WSL)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm no encontrado."
    exit 1
fi

# Configuración para desarrollo local
HOST_IP="localhost"
API_URL="http://$HOST_IP:3000/api"

echo -e "⚙️  Configurando para IP: ${GREEN}$HOST_IP${NC}"
echo -e "🔗 API URL: ${GREEN}$API_URL${NC}"
echo ""

cd "$PROJECT_ROOT"

# Iniciar Backend en modo desarrollo
echo -e "${GREEN}📦 Iniciando Backend (modo desarrollo)...${NC}"
cd "$PROJECT_ROOT/apps/backend"
nohup npm run start:dev > ../../backend.prod.log 2>&1 &
disown
sleep 2
BACKEND_PID=$(pgrep -f "node.*/ValeryPort/apps/backend" | tail -n 1)
cd "$PROJECT_ROOT"
echo $BACKEND_PID > .masterp.pids
echo "   ✅ Backend corriendo [PID: $BACKEND_PID]"

# Iniciar Frontend
echo -e "${GREEN}💻 Iniciando Frontend...${NC}"
cd "$PROJECT_ROOT/apps/frontend"
nohup bash -c "VITE_API_URL=$API_URL npm run dev -- --host" > ../../frontend.prod.log 2>&1 &
disown
sleep 2
FRONTEND_PID=$(pgrep -f "vite.*--host" | tail -n 1)
cd "$PROJECT_ROOT"
echo $FRONTEND_PID >> .masterp.pids
echo "   ✅ Frontend corriendo [PID: $FRONTEND_PID]"

# Desasociar completamente todos los jobs del shell actual (evita que cuelgue la terminal)
disown -a 2>/dev/null || true

echo ""

# ==================== RESET + RESUMEN FINAL LIMPIO ====================
# Limpiamos el terminal al final para que el resumen se vea bien
reset 2>/dev/null || true

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   📋 RESUMEN FINAL - Reinicio Local (Dev)                 ${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# Builds
echo -e "${YELLOW}Builds:${NC}"
if [ "$BACKEND_BUILD_OK" = true ]; then
    echo -e "  Backend:   ${GREEN}✅ Exitoso${NC}"
else
    echo -e "  Backend:   ${RED}❌ Falló${NC}"
fi

if [ "$FRONTEND_BUILD_OK" = true ]; then
    echo -e "  Frontend:  ${GREEN}✅ Exitoso${NC}"
else
    echo -e "  Frontend:  ${RED}❌ Falló${NC}"
fi

echo ""

# Servidores
echo -e "${YELLOW}Servidores en ejecución:${NC}"
if [ -f .masterp.pids ]; then
    while IFS= read -r pid; do
        if ps -p "$pid" > /dev/null 2>&1; then
            echo -e "  PID $pid → ${GREEN}Corriendo${NC}"
        else
            echo -e "  PID $pid → ${RED}No encontrado${NC}"
        fi
    done < .masterp.pids
else
    echo -e "  ${YELLOW}(No se encontró archivo de PIDs)${NC}"
fi

echo ""
echo -e "${YELLOW}Acceso:${NC}"
echo -e "  ${GREEN}http://$HOST_IP:5173${NC}"
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo "  - backend.prod.log"
echo "  - frontend.prod.log"
echo ""
echo -e "${YELLOW}Para detener todo:${NC}"
echo -e "  ${BLUE}./stop-local.sh${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
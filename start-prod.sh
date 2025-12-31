#!/bin/bash

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}===================================================${NC}"
echo -e "${BLUE}   🚀 Valery Corporativo - Servidor de Producción   ${NC}"
echo -e "${BLUE}===================================================${NC}"
echo ""

# 1. Solicitar IP
echo -e "${YELLOW}❓ Ingrese la IP de este computador en la red (Windows Host):${NC}"
echo -e "   (Ejemplo: 192.168.1.50)"
read -p "   > " HOST_IP

if [ -z "$HOST_IP" ]; then
    echo -e "${YELLOW}⚠️  No se ingresó IP, asumiendo localhost...${NC}"
    HOST_IP="localhost"
fi

API_URL="http://$HOST_IP:3000/api"
echo ""
echo -e "⚙️  Configurando sistema para: ${GREEN}$HOST_IP${NC}"
echo -e "🔗 API URL: ${GREEN}$API_URL${NC}"
echo ""

# 2. Iniciar Backend
echo -e "${GREEN}📦Iniciando Backend (Cerebro)...${NC}"
cd apps/backend
# Usamos start:dev para asegurar que escuche en 0.0.0.0
nohup npm run start:dev > ../../backend.prod.log 2>&1 &
BACKEND_PID=$!
cd ../..
echo "   ✅ Backend corriendo [PID: $BACKEND_PID]"

# 3. Iniciar Frontend
echo -e "${GREEN}💻Iniciando Frontend (Interfaz)...${NC}"
cd apps/frontend
# VITE_API_URL inyecta la IP correcta. --host expone la app.
nohup bash -c "VITE_API_URL=$API_URL npm run dev -- --host" > ../../frontend.prod.log 2>&1 &
FRONTEND_PID=$!
cd ../..
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
echo -e "🔴 Para detener los servidores, ejecuta:"
echo "   pkill -f 'node|vite'"
echo ""

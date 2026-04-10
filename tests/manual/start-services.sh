#!/bin/bash

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Iniciando servicios de MastERP...${NC}"

# Iniciar Backend
echo -e "${GREEN}📦 Iniciando Backend (NestJS)...${NC}"
cd apps/backend
nohup npm run start:dev > ../../backend.log 2>&1 &
BACKEND_PID=$!
cd ../..
echo "   ✅ Backend corriendo en PID: $BACKEND_PID"
echo "   📄 Logs: backend.log"

# Iniciar Frontend
echo -e "${GREEN}💻 Iniciando Frontend (Vite)...${NC}"
cd apps/frontend
nohup npm run dev > ../../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ../..
echo "   ✅ Frontend corriendo en PID: $FRONTEND_PID"
echo "   📄 Logs: frontend.log"

echo -e "${BLUE}✨ Todo listo! Servicios corriendo en segundo plano.${NC}"
echo "   👉 Backend: http://localhost:3000"
echo "   👉 Frontend: http://localhost:5173"
echo ""
echo "Para detener los servicios, puedes usar: pkill -f 'node|vite'"

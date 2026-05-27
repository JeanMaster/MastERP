#!/bin/bash

# stop-local.sh
# Detiene de forma segura los servidores locales de MastERP

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${RED}🛑 Deteniendo servidores locales de MastERP...${NC}"

PROJECT_ROOT=$(cd "$(dirname "$0")" && pwd)
cd "$PROJECT_ROOT"

# Matamos procesos específicos del proyecto (seguro)
pkill -9 -f "node.*/ValeryPort/apps/backend" 2>/dev/null || true
pkill -9 -f "node.*/ValeryPort/apps/frontend" 2>/dev/null || true
pkill -9 -f "vite.*--host" 2>/dev/null || true
pkill -9 -f "nest start" 2>/dev/null || true
pkill -9 -f "dist/src/main" 2>/dev/null || true

# Limpiamos archivo de PIDs
rm -f .masterp.pids

echo -e "${GREEN}✅ Servidores locales detenidos correctamente.${NC}"

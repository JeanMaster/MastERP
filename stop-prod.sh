#!/bin/bash

# Colores para output
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${RED}🛑 Deteniendo servicios de Valery Corporativo...${NC}"

# Asegurar que estamos en el directorio raíz
PROJECT_ROOT=$(cd "$(dirname "$0")" && pwd)
cd "$PROJECT_ROOT" || exit 1

PID_FILE="$PROJECT_ROOT/.zenith.pids"

# Estrategia 1: Matar por patrones específicos (Más fiable)
echo -e "   ⏳ Deteniendo procesos de Backend y Frontend..."
# Matamos específicamente procesos de node que cuelguen de nuestras carpetas de apps
pkill -9 -f "node.*/ValeryPort/apps/backend" 2>/dev/null
pkill -9 -f "node.*/ValeryPort/apps/frontend" 2>/dev/null
pkill -9 -f "vite.*--host" 2>/dev/null

# Estrategia 2: Limpieza por PIDs guardados (Si aún quedan)
if [ -f "$PID_FILE" ]; then
    while IFS= read -r pid; do
        if ps -p "$pid" > /dev/null; then
            pkill -P "$pid" 2>/dev/null
            kill -9 "$pid" 2>/dev/null
        fi
    done < "$PID_FILE"
    rm "$PID_FILE"
fi

echo -e "${YELLOW}✅ Servicios detenidos correctamente.${NC}"

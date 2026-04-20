# Guía de Sincronización y Actualización de Producción

Este documento contiene las instrucciones críticas para actualizar el entorno de producción de MastERP, resolviendo los conflictos de historial de Prisma que impiden la carga de los módulos de Marketing e IA.

## Contexto del Problema
La base de datos de producción tiene columnas y tablas creadas manualmente o por migraciones interrumpidas de Febrero 2026. Al intentar actualizar al código más reciente, Prisma intenta crear de nuevo estas columnas, causando errores de tipo `P3009` (columna ya existe) y `P2021` (tabla no encontrada).

---

## Procedimiento de Actualización (MODO OFFLINE)

### 1. Detención del Sistema
Asegúrese de que ningún proceso esté bloqueando la base de datos o los puertos.
```bash
# Desde la raíz del proyecto
stopz
```

### 2. Actualización de Código
Traiga las últimas mejoras de red y lógica de IA.
```bash
git pull origin master
```

### 3. Sincronización de Tipos de Datos
Genere el cliente de Prisma para que el backend reconozca las nuevas tablas antes de compilar.
```bash
cd apps/backend
npx prisma generate
```

### 4. Resolución Quirúrgica de Migraciones
Este paso es **VITAL**. Indica a Prisma que ignore las piezas ya instaladas de febrero para que pueda saltar a las nuevas de abril. Ejecute estos comandos dentro de `apps/backend`:

```bash
npx prisma migrate resolve --applied 20260210141512_add_cash_verification
npx prisma migrate resolve --applied 20260210145750_add_cashier_assignment
npx prisma migrate resolve --applied 20260210192824_add_session_cash_counts
npx prisma migrate resolve --applied 20260210195837_add_exchange_rate_to_cash_movement
npx prisma migrate resolve --applied 20260212160519_add_pos_liquidation_fields
npx prisma migrate resolve --applied 20260212184536_add_mobile_payment_field
npx prisma migrate resolve --applied 20260212193415_add_bank_account_to_expense
npx prisma migrate resolve --applied 20260213153117_enhance_purchase_payment
npx prisma migrate resolve --applied 20260218172018_add_mercadolibre_integration
npx prisma migrate resolve --applied 20260219134653_add_multi_images
```

### 5. Despliegue de Nuevas Funcionalidades
Una vez limpio el camino, aplique las migraciones de Marketing e IA.
```bash
npx prisma migrate deploy
```

### 6. Construcción y Arranque
```bash
# Dentro de apps/backend
npm run build

# Volver a raíz y arrancar
cd ../..
./start-prod.sh
```

---

## Plan de Emergencia (Rollback)
Si el sistema no arranca o hay errores de venta, ejecute:
```bash
stopz
git reset --hard df9a6d9379663aed04835f53db401d19c96fac06
cd apps/backend && npx prisma generate
cd ../..
./start-prod.sh
```

---

## Verificación Final
Acceda a `/marketing` en el navegador. Si el dashboard carga gráficos y no da error 404, la sincronización fue exitosa.

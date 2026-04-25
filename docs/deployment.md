# Guía de Despliegue en Producción 🚀

Sigue estos pasos para poner tu sistema online de forma gratuita utilizando Neon, Render y Vercel.

## 1. Base de Datos (Neon) 💾
1. Crea una cuenta en [Neon.tech](https://neon.tech/).
2. Crea un nuevo proyecto llamado `masterp`.
3. Copia el **Connection String** (ej: `postgresql://user:password@host/neondb?sslmode=require`).
4. **IMPORTANTE:** Guarda este string, lo usaremos en el paso 2.

## 2. Servidor Backend (Render) ⚙️
1. Crea una cuenta en [Render.com](https://render.com/).
2. Haz clic en **New +** > **Web Service**.
3. Conecta tu repositorio de GitHub.
4. Selecciona la subcarpeta: `apps/backend`. (En configuración avanzada de Render, especifica el Dockerfile en `apps/backend/Dockerfile`)
5. Configura los siguientes campos:
   - **Runtime:** Docker
   - **Plan:** Free
6. Agrega las **Environment Variables**:
   - `DATABASE_URL`: (El que copiaste de Neon)
   - `JWT_SECRET`: (Una frase secreta larga y aleatoria)
   - `NODE_ENV`: `production`
   - `PORT`: `3000`
7. Haz clic en **Create Web Service**.
8. Una vez desplegado, copia la URL que te da Render (ej: `https://masterp-backend.onrender.com`).

## 3. Interfaz Frontend (Vercel) 🎨
1. Crea una cuenta en [Vercel.com](https://vercel.com/).
2. Haz clic en **Add New** > **Project**.
3. Conecta tu repositorio de GitHub.
4. Selecciona la subcarpeta: `apps/frontend`.
5. En **Framework Preset**, selecciona `Vite`.
6. En **Environment Variables**, agrega:
   - `VITE_API_URL`: `https://masterp-backend.onrender.com/api` (La URL de tu backend de Render + `/api`)
7. Haz clic en **Deploy**.

## 4. Configuración Final 🔗
1. Entra a tu URL de Vercel.
2. Inicia sesión con tus credenciales de Administrador.
3. El sistema ya debería estar conectado a la nube. 
4. Si necesitas cambiar algo, ve a **Configuración > Conexión de Red** y verifica que el modo esté en **Remoto** con la URL de Render.

---

### Notas de Mantenimiento
- **Cold Start:** En el plan gratuito de Render, si no hay visitas por 15 min, el servidor se "duerme". Al entrar de nuevo, tardará unos 30 segundos en despertar.
- **Migraciones:** El sistema está configurado para ejecutar `npx prisma migrate deploy` automáticamente cada vez que se despliega el backend.

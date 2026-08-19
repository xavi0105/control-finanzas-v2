# 💳 OptiCard · Control de Finanzas

Aplicación web de control financiero personal con React + Vite + Supabase, lista para desplegar en **Netlify**.

## ✨ Funcionalidades

- 🔐 **Autenticación** con Supabase (registro e inicio de sesión por correo).
- 📊 **Resumen** con métricas estilo dashboard: dinero disponible, deuda de crédito, balance neto real y uso de crédito global.
- 🤖 **Coach financiero**: alerta inteligente que analiza tus gastos frente a tus ingresos.
- 💡 **Recomendador**: evalúa qué cuenta te conviene para cada compra (días de financiamiento, cashback y liquidez).
- 🧮 **Simulador MSI**: calcula el rendimiento de comprar a meses sin intereses manteniendo tu dinero en una cajita con tasa anual.
- 💳 **Cuentas y tarjetas**: cuentas de débito/ahorro con saldo inicial y tasa de rendimiento; tarjetas de crédito con límite, día de corte y día de pago.
- 📥 **Transacciones**: registrar ingresos y gastos con categorías, filtros y búsqueda.
- 🎯 **Metas de ahorro** con barra de progreso y aportaciones.
- 📈 **Reportes** con gráficas (flujo mensual, distribución por categoría, resumen anual).
- 📥/📤 **Exportar e importar CSV** y respaldo completo en JSON.
- 📱 **PWA**: instalable en el dispositivo y funciona parcialmente sin conexión.

## 🚀 Despliegue en Netlify

### 1. Crear el proyecto en Supabase (gratis)

1. Ve a [supabase.com](https://supabase.com) e inicia sesión.
2. Crea un nuevo proyecto (elige una región cercana a ti).
3. En tu proyecto, abre **SQL Editor** → **New query**.
4. Pega el contenido de `supabase/schema.sql` y pulsa **Run**. Esto crea las tablas (`accounts`, `categories`, `transactions`, `goals`), las políticas de seguridad (RLS) y las categorías por defecto.
5. Ve a **Authentication → Providers** y confirma que **Email** está habilitado.
6. En **Settings → API** copia tu **Project URL** y tu **anon public key**.

### 2. Configurar variables de entorno

Copia `.env.example` a `.env` y completa los valores:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU-ANON-KEY
```

### 3. Desplegar en Netlify

**Opción A — Interfaz web de Netlify:**
1. Sube el proyecto a un repositorio en GitHub/GitLab/Bitbucket.
2. En [netlify.com](https://netlify.com) elige **Add new site → Import an existing project**.
3. Selecciona el repositorio.
4. En **Build settings** usa los valores automáticos (ya están en `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
5. En **Environment variables** agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
6. Pulsa **Deploy site**.

**Opción B — Netlify CLI:**
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```
Sigue el asistente y confirma `dist` como directorio de publicación.

> ⚠️ En el dashboard de Netlify también debes agregar las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en **Site settings → Environment variables**.

### 4. Usar la app

1. Regístrate desde la pantalla de inicio.
2. Revisa tu correo y confirma la cuenta (si lo configuraste).
3. Inicia sesión: verás tu cuenta "Efectivo" y las categorías por defecto ya creadas.
4. Registra tu saldo inicial como un **ingreso** en tu cuenta (o edita la cuenta y pon su saldo inicial).
5. Empieza a registrar gastos e ingresos.

## 🛠️ Desarrollo local

```bash
npm install
npm run dev      # servidor de desarrollo en http://localhost:5173
npm run build    # build de producción en dist/
npm run preview  # previsualizar el build
```

## 🧱 Estructura del proyecto

```
├── supabase/
│   └── schema.sql          # Esquema de base de datos + RLS + categorías por defecto
├── public/
│   ├── manifest.json       # Configuración PWA
│   ├── sw.js               # Service worker (caché offline)
│   └── icon-192/512.png    # Iconos de la app
└── src/
    ├── components/         # Layout, modales, tarjetas de métricas
    ├── context/            # AuthContext, FinanceContext, ToastContext
    ├── lib/supabase.js     # Cliente de Supabase
    ├── pages/              # Dashboard, Recomendador, Transacciones, Cuentas, Metas, Reportes, Ajustes
    ├── styles/global.css   # Estilos
    └── utils/              # Formato de moneda/fecha y CSV
```

## 🧮 Modelo de datos

| Tabla          | Descripción                                    |
|----------------|------------------------------------------------|
| `accounts`     | Cuentas y tarjetas (débito/ahorro/crédito)     |
| `categories`   | Categorías de ingresos y gastos                |
| `transactions` | Movimientos (ingreso/gasto) vinculados a cuentas |
| `goals`        | Metas de ahorro con monto meta y ahorrado      |

## 🛡️ Seguridad

- Las políticas **Row Level Security (RLS)** garantizan que cada usuario solo vea y modifique sus propios datos.
- Las credenciales de Supabase solo se exponen como variables de entorno del build; nunca se suben al repositorio (`.env` está en `.gitignore`).
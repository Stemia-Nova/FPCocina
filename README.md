# Menú desde tu nevera (Next.js + OpenAI)

Demo simple para subir una foto de la nevera y generar un menú con IA
(entrante, principal y postre), pasos, lista de compra y alérgenos.

## Requisitos

- Node.js 18+
- NPM 9+

## Instalación y ejecución

```bash
npm install
npm run dev
```

Abre `http://localhost:3000` en el navegador.

## Configuración de variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto con:

```bash
OPENAI_API_KEY=tu_clave_aqui
USE_MOCK=false
```

## Modo demo (fallback)

Para forzar el resultado mock (sin llamar a OpenAI):

```bash
USE_MOCK=true
```

Si la llamada a OpenAI falla (red, key, rate limit o parse), la API
responderá automáticamente con el mock y el frontend mostrará un aviso.

## Scripts disponibles

- `npm run dev` – entorno de desarrollo
- `npm run build` – build de producción
- `npm run start` – ejecutar el build

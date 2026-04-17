# Arquitectura actual de SIRPE

## Capas actuales

- **STATE**: estado global del sistema.
- **AUTH / API**: acceso, sesión e integración backend.
- **INGESTA**: lectura de Excel y preparación de datos.
- **ANALYTICS**: sectorización, hotspots y lógica operativa.
- **ROUTING**: construcción de rutas.
- **MAP**: representación geoespacial.
- **UI RENDER**: tablas, paneles y gráficas.
- **EVENTS**: interacción del usuario.
- **EXPORT**: salidas operativas.

## Objetivo de esta estructura Git

Permitir evolución incremental sin volver a un HTML monolítico difícil de mantener.

## Próximas mejoras recomendadas

1. Introducir un `app-init.js`.
2. Reducir dependencias globales implícitas.
3. Externalizar configuración por entorno.
4. Añadir pruebas mínimas sobre pipeline principal.

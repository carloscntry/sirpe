# Changelog

## [v1.30.0] - 2026-04-17

### Added
- Modularización ligera del sistema en múltiples archivos JS
- Estructura organizada por bloques (config, state, analytics, render, etc.)
- Dashboard central con paneles retráctiles funcionales
- Integración completa del módulo Voronoi con recursos
- Sistema de recomendaciones automáticas
- Botones de simulación operativa

### Improved
- Alineación visual de formularios en todo el sistema
- Organización del dashboard por jerarquía operativa
- Flujo visual posterior a resultados Voronoi
- Consistencia en nombres de zonas con displayZoneName()

### Fixed
- Eliminación de funciones duplicadas críticas (routing, map, render)
- Corrección de render en tabla de rutas (manejo de punto fijo)
- Corrección en tabla de resumen (etiquetado de rutas fijas)
- Recursos iniciales configurados en cero
- Corrección de acceso al sistema en versión modular

### Refactored
- Reorganización completa del script en bloques funcionales
- Consolidación del núcleo operativo (analytics + routing)
- Separación de responsabilidades dentro del sistema
- Preparación del sistema para escalabilidad

---
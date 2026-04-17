# SIRPE

Sistema Inteligente de Rutas Policiales Eficientes.

Este repositorio contiene la versión modular ligera de SIRPE, organizada para mantenimiento, control de cambios y evolución incremental.

## Estructura

```text
SIRPE/
├── index.html
├── js/
│   ├── state.js
│   ├── auth-api.js
│   ├── ingesta.js
│   ├── analytics.js
│   ├── routing.js
│   ├── map.js
│   ├── ui-render.js
│   ├── events.js
│   ├── export.js
│   ├── heatmap-loader.js
│   ├── voronoi-resource-sync.js
│   └── collapse-bindings.js
├── docs/
├── data/
├── backups/
├── .gitignore
├── CHANGELOG.md
└── README.md
```

## Cómo ejecutar

### Opción 1: abrir localmente
Abre `index.html` en el navegador, manteniendo la carpeta `js/` al mismo nivel.

### Opción 2: servidor local recomendado
```bash
python -m http.server 8000
```
Luego abre la dirección local en tu navegador.

## Requisitos operativos

- La carpeta `js/` debe estar junto a `index.html`.
- Si el acceso depende de backend, el servicio API debe estar levantado y accesible.
- Si cambias `apiBaseUrl`, documenta el entorno en este archivo o en `docs/`.

## Flujo de trabajo Git recomendado

```bash
git init
git branch -M main
git add .
git commit -m "chore: bootstrap repositorio SIRPE modular"
```

## Convención sugerida de commits

- `feat:` nueva función
- `fix:` corrección de error
- `refactor:` limpieza interna sin cambiar comportamiento
- `style:` cambios visuales o de formato
- `docs:` documentación
- `chore:` mantenimiento general

## Ramas sugeridas

- `main`: versión estable
- `develop`: integración de cambios
- `feature/*`: mejoras puntuales
- `fix/*`: correcciones específicas

## Siguientes pasos recomendados

1. Mantener la versión estable en `main`.
2. Documentar cambios importantes en `CHANGELOG.md`.
3. Guardar auditorías, capturas y decisiones técnicas en `docs/`.
4. Separar configuración sensible o por entorno en un archivo de configuración controlado.


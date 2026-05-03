# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## GitHub Actions Workflows

Este proyecto utiliza GitHub Actions para automatizar builds y releases de la aplicación Electron.

### Workflows disponibles:

#### 1. **Build & Test** (`build.yml`)
- **Trigger**: Push a `main`, tags `v*`, Pull Requests, ejecución manual
- **Validación**: Verifica que `public/seed_data.json` contenga exactamente 175 tareas
- **Builds**: Windows (.exe), Linux (.AppImage/.deb), macOS (.dmg)
- **Artifacts**: Los instaladores se suben como artifacts de GitHub Actions (disponibles 90 días)

#### 2. **Release** (`release.yml`)
- **Trigger**: Tags `v*` o ejecución manual con opciones
- **Publicación**: 
  - **Tag trigger**: Crea release pública en GitHub
  - **Manual (draft)**: Crea draft release para revisar antes de publicar
  - **Manual (release)**: Crea release pública inmediata
- **Plataformas**: Windows y macOS (sin certificados de firma)

### Cómo empaquetar la aplicación:

1. **Desarrollo**:
   ```bash
   # Ejecutar en modo desarrollo
   ./start.bat  # Windows
   # o
   cd gkapp-web && npm run dev
   ```

2. **Build de prueba**:
   - Push a `main` o crear PR → `Build & Test` se ejecuta automáticamente
   - O ejecutar manualmente desde GitHub Actions

3. **Crear release**:
   ```bash
   # Opción 1: Tag automático
   git tag v1.1.0
   git push origin v1.1.0
   
   # Opción 2: Manual (draft)
   # Ejecutar "Release" workflow manualmente con opción "draft"
   ```

4. **Descargar instaladores**:
   - Ve a GitHub → Releases
   - Descarga el instalador para tu plataforma (Windows/macOS)

### Notas importantes:
- **Sin certificados**: Aparecerán advertencias de seguridad al instalar (normal)
- **Datos iniciales**: La app incluye 175 tareas originales en `public/seed_data.json`
- **Validación**: El build fallará si `seed_data.json` no tiene 175 tareas
- **Artifacts**: Los builds de PR se guardan 90 días; las releases son permanentes

### Configuración de seguridad:
- Windows: `verifyUpdateCodeSignature: false` en `package.json`
- macOS: `sign: false` en configuración de electron-builder

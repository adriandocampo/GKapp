# Implementation Plan: SofaScore Integration (Heatmap + Shot Map)

## Overview
Integrar datos de SofaScore en GKApp para reemplazar el radar chart del portero con un heatmap real y añadir un mapa de tiros del rival. Los datos se obtienen desde la API pública de SofaScore (`/api/v1`) vía el proceso principal de Electron, evitando CORS, y se cachean en IndexedDB.

## API Endpoints Identificados
- `GET /api/v1/event/{eventId}` → datos del partido (homeTeam, awayTeam, scores)
- `GET /api/v1/event/{eventId}/lineups` → alineaciones (identificar portero por `position: "G"`)
- `GET /api/v1/event/{eventId}/shotmap` → tiros del partido con xG, coordenadas, goalMouth
- `GET /api/v1/event/{eventId}/player/{playerId}/heatmap` → puntos {x,y} del heatmap del jugador

## Data Structures
### Heatmap
```json
{ "heatmap": [{ "x": 0-100, "y": 0-100 }] }
```
- `x`: longitud del campo (0 = portería defendida, 100 = portería rival)
- `y`: anchura del campo (0 = banda izquierda, 100 = banda derecha, 50 = centro)

### Shotmap Entry
```json
{
  "player": { "name", "shortName", "id" },
  "isHome": true/false,
  "shotType": "goal" | "miss" | "post" | "block" | "save",
  "playerCoordinates": { "x", "y", "z" },
  "goalMouthCoordinates": { "x", "y", "z" },
  "goalMouthLocation": "low-centre" | "high" | ...,
  "xg": 0.0-1.0,
  "time": 0-90
}
```

## Architecture Changes
- **New file**: `gkapp-web/electron/sofascoreScraper.js` — módulo de scraping desde main process
- **Modified**: `gkapp-web/electron/main.js` — añadir IPC handlers `sofascore:fetch-match-data`
- **Modified**: `gkapp-web/src/db.js` — añadir tabla `analyses` (o extender) con `matchUrl` y `sofascoreData`
- **Modified**: `gkapp-web/src/pages/Analysis.jsx` — añadir campo URL, botón fetch, integrar componentes
- **New file**: `gkapp-web/src/components/GoalkeeperHeatmap.jsx` — reemplaza `GoalkeeperRadar.jsx`
- **New file**: `gkapp-web/src/components/ShotMap.jsx` — mapa de tiros del rival
- **Deleted**: `gkapp-web/src/components/GoalkeeperRadar.jsx` (o dejar de importar)

## Implementation Steps

### Phase 1: Database Schema (db.js)
1. Añadir versión de migración 14 (o la siguiente disponible)
2. Extender tabla `analyses` con: `matchUrl` (string), `sofascoreData` (object/json)
3. En upgrade, inicializar campos en registros existentes

### Phase 2: Electron Scraper (sofascoreScraper.js + main.js)
1. Crear `sofascoreScraper.js` con clase `SofaScoreScraper`:
   - `extractEventId(url)`: parsea la URL de SofaScore para obtener el eventId
   - `fetchEvent(eventId)`: petición a `/api/v1/event/{eventId}`
   - `fetchLineups(eventId)`: petición a `/api/v1/event/{eventId}/lineups`
   - `fetchShotmap(eventId)`: petición a `/api/v1/event/{eventId}/shotmap`
   - `fetchHeatmap(eventId, playerId)`: petición a `/api/v1/event/{eventId}/player/{playerId}/heatmap`
   - `fetchMatchData(url, goalkeeperName)`: orquesta todo:
     a. Extrae eventId
     b. Obtiene evento y lineups
     c. Identifica portero por nombre aproximado (fuzzy match) o por `position: "G"`
     d. Obtiene heatmap del portero
     e. Filtra shotmap para obtener solo tiros del equipo rival
     f. Devuelve objeto consolidado
2. En `main.js`, añadir IPC handler:
   - `ipcMain.handle('sofascore:fetch-match-data', (event, { url, goalkeeperName }) => ...)`
3. Headers requeridos: `User-Agent`, `Accept: application/json`, `Referer: https://www.sofascore.com/`

### Phase 3: UI Form (Analysis.jsx)
1. Añadir estado: `matchUrl`, `sofascoreData`, `sofascoreLoading`, `sofascoreError`
2. Añadir input debajo del campo de fecha:
   - Label: "🔗 URL de SofaScore"
   - Placeholder: "https://www.sofascore.com/..."
3. Añadir botón "Cargar datos SofaScore" al lado del input
4. Al hacer clic:
   - Llama a `window.electron.invoke('sofascore:fetch-match-data', { url: matchUrl, goalkeeperName: parsed?.goalkeeper?.name })`
   - Guarda resultado en estado y en IndexedDB (`db.analyses.update(analysisId, { matchUrl, sofascoreData: data })`)
5. Al cargar un análisis existente (`loadAnalysis`), restaurar `matchUrl` y `sofascoreData`

### Phase 4: GoalkeeperHeatmap Component
1. Crear `GoalkeeperHeatmap.jsx`:
   - Props: `heatmap` (array de {x,y})
   - Renderiza un campo de fútbol esquemático (SVG o Canvas) con dimensiones 100x100
   - Dibuja líneas del campo (área, mediocampo, etc.)
   - Dibuja puntos del heatmap como círculos con opacidad/gradiente de calor
   - El portero del equipo visitante (away) tendrá su portería en x=0, por lo que el heatmap debe mostrar la mitad izquierda del campo
   - Para home goalkeeper, la portería está en x=100, mostrar mitad derecha
   - Incluir leyenda con nombre del portero y datos básicos

### Phase 5: ShotMap Component
1. Crear `ShotMap.jsx`:
   - Props: `shots` (array de shotmap), `isHomeGoalkeeper` (boolean)
   - Renderiza campo de fútbol (vista desde arriba, 105m x 68m o 100x100)
   - Cada tiro: círculo en `playerCoordinates` (x,y)
     - Tamaño del círculo proporcional a `xg` (escalar: min 4px, max 20px)
     - Color según `shotType`:
       - `goal`: rojo intenso `#ef4444`
       - `miss`: gris `#9ca3af`
       - `post`: amarillo `#f59e0b`
       - `block`: azul `#3b82f6`
       - `save`: verde `#22c55e`
   - Goal mouth: dibujar portería en el borde correspondiente y mostrar xGOT si existe
   - Leyenda: lista de tiros con jugador, minuto, xG, resultado
   - Tooltip hover: mostrar detalles del tiro

### Phase 6: Integration & Cache
1. En `Analysis.jsx`:
   - Reemplazar `<GoalkeeperRadar gkStats={gkStats} />` por:
     ```jsx
     <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
       <h3 className="text-sm font-medium text-slate-300 mb-2">Heatmap del Portero</h3>
       {sofascoreData?.goalkeeperHeatmap ? (
         <GoalkeeperHeatmap heatmap={sofascoreData.goalkeeperHeatmap} goalkeeperName={parsed?.goalkeeper?.name} />
       ) : (
         <div className="text-xs text-slate-500 italic">Carga una URL de SofaScore para ver el heatmap</div>
       )}
     </div>
     ```
   - Añadir `<ShotMap shots={sofascoreData?.rivalShots || []} />` en la grid de charts
2. Guardar automáticamente `matchUrl` y `sofascoreData` al guardar análisis
3. Al cargar análisis existente, restaurar datos desde DB

## Testing Strategy
- Unit tests: `sofascoreScraper.js` — mock de la API, verificar parsing de URL
- Integration tests: Cargar URL real de test, verificar que devuelve heatmap y shots
- UI tests: Verificar que componentes se renderizan con datos mock

## Risks & Mitigations
- **Risk**: API de SofaScore devuelve 403 o rate limit
  - Mitigation: Cacheo agresivo en IndexedDB (no repetir fetch si ya tenemos datos). Mostrar mensaje de error al usuario.
- **Risk**: Cambios en la API no documentada
  - Mitigation: Wrap cada endpoint en try/catch, devolver datos parciales si alguno falla
- **Risk**: Nombre del portero no coincide exactamente entre XML y SofaScore
  - Mitigation: Fuzzy matching por nombre (ignorar acentos, mayúsculas, espacios). Si falla, permitir selección manual.

## Success Criteria
- [ ] Usuario puede pegar URL de SofaScore y cargar datos con un clic
- [ ] Heatmap del portero reemplaza al radar chart existente
- [ ] Mapa de tiros muestra tiros del rival con tamaño=xG, color=resultado
- [ ] Datos se cachean en IndexedDB (no re-fetch al recargar análisis)
- [ ] UI es responsiva y mantiene el estilo oscuro existente (slate-800/900)

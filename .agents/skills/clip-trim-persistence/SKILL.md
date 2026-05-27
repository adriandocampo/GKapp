# Skill: Clip Trim & Persistence Pattern

## Overview

This skill documents the **clip length editing and persistence pattern** used in SportsCutter, a football video clip visualizer. It covers:

1. **Dual-slider trim UI** for adjusting clip start/end times
2. **Per-clip customization storage** (trim, rating, phase) persisted server-side in `projects.json`
3. **View-aware customizations** (TV vs Tactical camera views)
4. **Legacy migration** handling for backward compatibility
5. **Export integration** where trimmed times flow into FFmpeg export jobs

Use this skill when implementing or adapting clip-editing features in GKApp or similar video analysis tools.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                               │
│  ┌──────────────┐      ┌─────────────────┐                │
│  │ Video Player │◄────►│ Trim Sliders    │                │
│  │  (HTML5)     │      │ (start/end)     │                │
│  └──────────────┘      └────────┬────────┘                │
│                                 │                          │
│  ┌──────────────┐      ┌───────▼────────┐                │
│  │ Custom Data  │◄────►│  customData    │                │
│  │  (JS object) │      │  {uid:{start,  │                │
│  └──────────────┘      │   end,phase,   │                │
│                        │   rating,_v}}  │                │
│                        └───────┬────────┘                │
│                                │ POST /api/customizations│
└────────────────────────────────┼──────────────────────────┘
                                 │
┌────────────────────────────────▼──────────────────────────┐
│                      FLASK BACKEND                           │
│  ┌────────────────────────────────────────┐                 │
│  │  save_project_customizations()        │                 │
│  │  → projects.json["projects"][i][       │                 │
│  │    "customizations"] = customData     │                 │
│  │  → Atomic write: .tmp → rename        │                 │
│  └────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Customizations Object (per project)

Stored in `projects.json` under each project's `customizations` key:

```json
{
  "active_project": "project_id",
  "projects": [
    {
      "id": "project_id",
      "name": "Project Name",
      "path": "projects/project_id",
      "customizations": {
        "0_15": {          // "matchIdx_instancesIndex"
          "start": 124.5,  // trimmed start (seconds)
          "end": 138.2,    // trimmed end (seconds)
          "phase": "Creación",
          "rating": 4,
          "_v": 2          // version marker for migration
        },
        "0_15_tactical": { // view-specific override (TV vs Tactical)
          "start": 122.0,
          "end": 140.0,
          "_v": 2
        }
      }
    }
  ]
}
```

### Key Concepts

| Key Pattern | Meaning |
|-------------|---------|
| `{matchIdx}_{instIdx}` | Base customization for a clip instance |
| `{matchIdx}_{instIdx}_{view}` | View-specific override (`tv` or `tactical`) |
| `_v` | Version marker (used for legacy migration) |

---

## Frontend Implementation

### 1. State Management

```javascript
// Global state
let customData = {};  // Loaded from server on boot
let currentView = 'tv'; // or 'tactical'

// Load from server
async function loadCustomizations() {
  try {
    const res = await fetch('/api/customizations');
    customData = await res.json();
  } catch {
    customData = {};
  }
}

// Save to server (debounced in practice)
async function saveCustomizations() {
  try {
    await fetch('/api/customizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customData)
    });
  } catch (e) {
    console.error('Failed to save customizations', e);
  }
}
```

### 2. View-Aware Keys

```javascript
function getViewUid(baseUid, view) {
  return `${baseUid}_${view || currentView}`;
}

// Read with fallback: view-specific → base → default
function getCustomStart(uid, defVal, view) {
  const viewUid = getViewUid(uid, view);
  if (customData[viewUid]?.start !== undefined) return customData[viewUid].start;
  if (customData[uid]?.start !== undefined) return customData[uid].start;
  return defVal;
}

function getCustomEnd(uid, defVal, view) {
  const viewUid = getViewUid(uid, view);
  if (customData[viewUid]?.end !== undefined) return customData[viewUid].end;
  if (customData[uid]?.end !== undefined) return customData[uid].end;
  return defVal;
}
```

### 3. Trim Slider UI

**HTML Structure:**

```html
<div class="trim-container">
  <div class="trim-track-bg"></div>
  <div class="trim-track-fill" id="trimTrackFill"></div>
  <input type="range" class="trim-input" id="trimStart" step="0.1">
  <input type="range" class="trim-input" id="trimEnd" step="0.1">
  <div class="trim-tooltip" id="trimTooltip"></div>
</div>
```

**CSS (essential):**

```css
.trim-container {
  position: relative;
  height: 20px;
  flex: 1;
  display: flex;
  align-items: center;
}
.trim-track-bg {
  position: absolute;
  left: 0; right: 0;
  height: 6px;
  background: var(--border);
  border-radius: 3px;
}
.trim-track-fill {
  position: absolute;
  height: 6px;
  background: var(--accent);
  border-radius: 3px;
}
.trim-input {
  position: absolute;
  width: 100%;
  -webkit-appearance: none;
  background: transparent;
  pointer-events: none;
  margin: 0;
}
.trim-input::-webkit-slider-thumb {
  pointer-events: auto;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: var(--text);
  border: 2px solid var(--accent);
  border-radius: 50%;
  cursor: ew-resize;
}
```

**JavaScript Logic:**

```javascript
function updateTrimUI(updateClip, which) {
  const trimStart = document.getElementById('trimStart');
  const trimEnd = document.getElementById('trimEnd');
  const fill = document.getElementById('trimTrackFill');
  
  let sVal = parseFloat(trimStart.value);
  let eVal = parseFloat(trimEnd.value);
  
  // Enforce start <= end
  if (sVal > eVal) {
    if (document.activeElement === trimStart) {
      trimStart.value = eVal; sVal = eVal;
    } else {
      trimEnd.value = sVal; eVal = sVal;
    }
  }
  
  // Visual fill bar
  const min = parseFloat(trimStart.min);
  const max = parseFloat(trimStart.max);
  const range = max - min;
  if (fill) {
    fill.style.left = ((sVal - min) / range * 100) + '%';
    fill.style.right = ((max - eVal) / range * 100) + '%';
  }
  
  // Show tooltip
  if (which) {
    const activeVal = which === 'start' ? sVal : eVal;
    showTrimTooltip(activeVal, which);
  }
  
  // Persist and update player
  if (updateClip && currentClip) {
    const deltaStart = sVal - currentClip.clipStart;
    const deltaEnd = eVal - currentClip.clipEnd;
    currentClip.clipStart = sVal;
    currentClip.clipEnd = eVal;
    currentClip.rawStart = Math.max(0, currentClip.rawStart + deltaStart);
    currentClip.rawEnd = Math.max(0, currentClip.rawEnd + deltaEnd);
    
    const uid = `${currentClip.matchIdx}_${currentClip.instancesIndex}`;
    setCustomTrim(uid, currentClip.rawStart, currentClip.rawEnd);
  }
}

function setCustomTrim(uid, start, end, view) {
  const viewUid = getViewUid(uid, view);
  
  // Save view-specific
  if (!customData[viewUid]) customData[viewUid] = {};
  customData[viewUid].start = start;
  customData[viewUid].end = end;
  customData[viewUid]._v = 2;
  
  // Also save to base for cross-view compatibility
  if (!customData[uid]) customData[uid] = {};
  customData[uid].start = start;
  customData[uid].end = end;
  customData[uid]._v = 2;
  
  saveCustomizations();
}
```

**Reset Trim:**

```javascript
function resetTrim() {
  const uid = `${currentClip.matchIdx}_${currentClip.instancesIndex}`;
  const viewUid = getViewUid(uid, currentView);
  
  // Remove custom trim data
  if (customData[viewUid]) {
    delete customData[viewUid].start;
    delete customData[viewUid].end;
    if (Object.keys(customData[viewUid]).length === 0) delete customData[viewUid];
  }
  if (customData[uid]) {
    delete customData[uid].start;
    delete customData[uid].end;
    if (Object.keys(customData[uid]).length === 0) delete customData[uid];
  }
  
  saveCustomizations();
  
  // Reset player times to original
  currentClip.rawStart = currentClip.clip.start;
  currentClip.rawEnd = currentClip.clip.end;
  currentClip.clipStart = Math.max(0, currentClip.clip.start - 3 - currentClip.videoOffset);
  currentClip.clipEnd = currentClip.clip.end - currentClip.videoOffset;
  updateVideoPlayerPanel();
}
```

### 4. Event Listeners

```javascript
document.addEventListener('DOMContentLoaded', () => {
  const tStart = document.getElementById('trimStart');
  const tEnd = document.getElementById('trimEnd');
  
  if (tStart && tEnd) {
    tStart.addEventListener('input', () => {
      updateTrimUI(true, 'start');
      const p = document.getElementById('videoPlayerPanel');
      if (p) p.currentTime = parseFloat(tStart.value);
    });
    tStart.addEventListener('change', () => hideTrimTooltip());
    
    tEnd.addEventListener('input', () => {
      updateTrimUI(true, 'end');
      const p = document.getElementById('videoPlayerPanel');
      if (p) p.currentTime = parseFloat(tEnd.value);
    });
    tEnd.addEventListener('change', () => hideTrimTooltip());
  }
});
```

---

## Backend Implementation (Flask)

### 1. API Endpoints

```python
from flask import Flask, request, jsonify
import json
from pathlib import Path

PROJECTS_FILE = Path("projects.json")

def load_projects():
    data = {"active_project": None, "projects": []}
    if PROJECTS_FILE.exists():
        with open(PROJECTS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    return data

def save_projects(data):
    """Atomic write to prevent corruption."""
    tmp = PROJECTS_FILE.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    try:
        tmp.replace(PROJECTS_FILE)
    except PermissionError:
        PROJECTS_FILE.unlink(missing_ok=True)
        tmp.rename(PROJECTS_FILE)

def get_active_project():
    data = load_projects()
    active_id = data.get("active_project")
    for p in data.get("projects", []):
        if p["id"] == active_id:
            return p
    return None

# ── GET customizations ──
@app.route("/api/customizations", methods=["GET"])
def api_get_customizations():
    """Return customizations for the active project."""
    data = load_projects()
    active = get_active_project()
    if not active:
        return jsonify({})
    for p in data.get("projects", []):
        if p["id"] == active["id"]:
            return jsonify(p.get("customizations", {}))
    return jsonify({})

# ── POST customizations ──
@app.route("/api/customizations", methods=["POST"])
def api_save_customizations():
    """Save customizations for the active project."""
    body = request.json
    if body is None:
        return jsonify({"error": "Invalid JSON"}), 400
    
    data = load_projects()
    active = get_active_project()
    if not active:
        return jsonify({"error": "No active project"}), 400
    
    for p in data.get("projects", []):
        if p["id"] == active["id"]:
            p["customizations"] = body
            save_projects(data)
            return jsonify({"success": True})
    
    return jsonify({"error": "Could not save"}), 500
```

### 2. Helper Functions

```python
def get_project_customizations():
    """Return the customizations dict for the active project."""
    data = load_projects()
    active = get_active_project()
    if not active:
        return {}
    for p in data.get("projects", []):
        if p["id"] == active["id"]:
            return p.get("customizations", {})
    return {}

def save_project_customizations(customizations: dict):
    """Store customizations dict for the active project."""
    data = load_projects()
    active = get_active_project()
    if not active:
        return False
    for p in data.get("projects", []):
        if p["id"] == active["id"]:
            p["customizations"] = customizations
            save_projects(data)
            return True
    return False
```

---

## Export Integration

When clips are exported to FFmpeg, trimmed times are used:

```javascript
function getExportTimes(p) {
  const hasTrim = hasCustomTrim(p._uid, p._view);
  const start = hasTrim ? p.start : Math.max(0, p.start - 3); // -3s buffer if no trim
  const end = p.end;
  return { start, end };
}

// In export function:
for (const p of playlist) {
  const exportTimes = getExportTimes(p);
  clipsForExport.push({
    video: p.video,
    start: exportTimes.start,
    end: exportTimes.end,
    label: p.code,
    match: p.matchName
  });
}
```

**Backend FFmpeg call:**

```python
import subprocess

cmd = [
    "ffmpeg", "-y", 
    "-ss", str(clip["start"]), 
    "-to", str(clip["end"]),
    "-i", video_path, 
    "-c:v", "libx264", 
    "-c:a", "aac",
    "-avoid_negative_ts", "1", 
    output_path
]
subprocess.run(cmd, capture_output=True, timeout=120)
```

---

## Legacy Migration

When the data format changes, implement a migration on boot:

```javascript
function migrateLegacyTacticalTrims() {
  let migrated = false;
  for (const key of Object.keys(customData)) {
    if (!key.endsWith('_tactical')) continue;
    const cd = customData[key];
    if (cd._v === 2) continue;  // Already migrated
    
    // Convert old format (video time) to new format (raw XML time)
    const parts = key.split('_');
    const matchIdx = parseInt(parts[0]);
    const instancesIndex = parseInt(parts[1]);
    const match = allMatches[matchIdx];
    const inst = match.instances[instancesIndex];
    
    const syncItem = findBestTactical(match.xml_name);
    if (!syncItem) continue;
    
    const offsets = tacticalOffsets[syncItem.name] || {};
    const tvPart1 = match.tv_part1 || 1;
    const tvPart2 = match.tv_part2 || 2700;
    const tactPart1 = offsets.part1 || syncItem.tactical_part1 || 0;
    const tactPart2 = offsets.part2 || syncItem.tactical_part2 || 2700;
    
    if (cd.start !== undefined) {
      if (inst.start >= tvPart2) {
        cd.start = cd.start + (tvPart2 - tactPart2);
      } else {
        cd.start = cd.start + (tvPart1 - tactPart1);
      }
    }
    if (cd.end !== undefined) {
      if (inst.end >= tvPart2) {
        cd.end = cd.end + (tvPart2 - tactPart2);
      } else {
        cd.end = cd.end + (tvPart1 - tactPart1);
      }
    }
    cd._v = 2;
    migrated = true;
  }
  if (migrated) {
    saveCustomizations();
    console.log('Migrated legacy tactical trims');
  }
}
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Server-side persistence** (`projects.json`) | Multiple users/devices, no localStorage limits, survives cache clears |
| **Atomic writes** (`.tmp` → rename) | Prevents corruption if crash during write |
| **View-specific keys** (`_tv`, `_tactical`) | TV and Tactical cameras have different sync offsets; trims must be independent |
| **Dual storage** (view + base) | Cross-view fallback: if no tactical trim, use base/TV trim |
| **Version marker** (`_v`) | Enables data migrations without breaking old saves |
| **-3s export buffer** (if no trim) | Gives context before the event; trimmed clips export exactly as set |
| **Immediate save on slider change** | User doesn't lose work; acceptable because writes are small JSON |

---

## Critical Files to Review

If adapting this pattern, study these locations in SportsCutter:

| File | Lines | Purpose |
|------|-------|---------|
| `app.py` | 112-135 | `get_project_customizations()` / `save_project_customizations()` |
| `app.py` | 1237-1251 | `/api/customizations` GET/POST routes |
| `templates/index.html` | 1013-1074 | Trim slider CSS |
| `templates/index.html` | 1353-1360 | Trim slider HTML |
| `templates/index.html` | 1561-1640 | `customData` loading, migration, save |
| `templates/index.html` | 2739-2803 | `getCustomStart/End/Phase`, `setCustomTrim` |
| `templates/index.html` | 3372-3390 | Slider setup in video player |
| `templates/index.html` | 3439-3454 | Slider event listeners |
| `templates/index.html` | 3457-3479 | `resetTrim()` |
| `templates/index.html` | 3499-3556 | `updateTrimUI()` |

---

## Adapting to GKApp

To port this pattern to GKApp:

1. **Create a project registry file** (e.g., `projects.json`) with per-project `customizations`
2. **Add `/api/customizations` routes** — copy the Flask pattern above
3. **Implement the dual-slider UI** in your frontend — copy the HTML/CSS/JS trim components
4. **Use `uid` keys** based on your data model (e.g., `{sessionId}_{eventId}`)
5. **Add view-aware keys** if GKApp has multiple camera angles
6. **Integrate with export** — pass trimmed times to your video cutter/FFmpeg
7. **Consider adding a `_v` version field** for future migrations

---

## Testing Checklist

- [ ] Trim sliders update the video preview in real time
- [ ] Start slider cannot exceed end slider (and vice versa)
- [ ] Reset button restores original clip boundaries
- [ ] Custom trim persists after page reload
- [ ] Export uses trimmed times (not original XML times)
- [ ] Tactical view trims are independent of TV view trims
- [ ] If no custom trim, export adds a small buffer (-3s)
- [ ] Legacy data auto-migrates on first load
- [ ] Atomic writes don't corrupt `projects.json` on crash

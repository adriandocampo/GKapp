import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import updater from 'electron-updater';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';
import { sendUsageTracking } from './tracking.js';
import { SofaScoreScraper } from './sofascoreScraper.js';

const execPromise = promisify(exec);


const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

let mainWindow = null;

function isDev() {
  return process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
}

function backupUserData() {
  try {
    const userData = app.getPath('userData');
    const backupDir = path.join(userData, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `pre-update-backup-${timestamp}`);
    fs.mkdirSync(backupPath, { recursive: true });

    const indexedDbPath = path.join(userData, 'IndexedDB');
    if (fs.existsSync(indexedDbPath)) {
      fs.cpSync(indexedDbPath, path.join(backupPath, 'IndexedDB'), { recursive: true, force: true });
    }

    const configPath = path.join(userData, 'gkapp-config.json');
    if (fs.existsSync(configPath)) {
      fs.copyFileSync(configPath, path.join(backupPath, 'gkapp-config.json'));
    }

    console.log('[Updater] Backup creado en:', backupPath);
  } catch (err) {
    console.error('[Updater] Error al crear backup:', err);
  }
}

function setupAutoUpdater() {
  if (isDev()) {
    console.log('[Updater] Desactivado en modo desarrollo');
    return;
  }

  const { autoUpdater } = updater;
  autoUpdater.autoDownload = false;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Nueva versión disponible:', info.version);
    mainWindow?.webContents.send('update-available', { version: info.version });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow?.webContents.send('download-progress', {
      percent: progressObj.percent,
      status: `Descargando... ${Math.round(progressObj.percent)}%`,
    });
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('[Updater] Actualización descargada, lista para instalar');
    mainWindow?.webContents.send('update-downloaded');
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err.message);
    mainWindow?.webContents.send('update-error', err.message);
  });

  ipcMain.handle('download-update', () => {
    autoUpdater.downloadUpdate();
  });

  ipcMain.handle('install-update', () => {
    backupUserData();
    setTimeout(() => {
      autoUpdater.quitAndInstall(true, true);
    }, 500);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[Updater] Check failed:', err.message);
    });
  }, 3000);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(currentDir, '../preload/index.js'),
    },
  });

  if (isDev()) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(currentDir, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function resolveRendererPublicDir() {
  if (isDev()) {
    return path.resolve(currentDir, '../public');
  }
  return path.resolve(currentDir, '../renderer');
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject);
  });
}

async function lookupBeSoccerMeta(matchName) {
  const html = await fetchText('https://es.besoccer.com/equipo/partidos/lugo');
  const wanted = normalizeText(matchName)
    .replace(/\(player-based\)|\(team-based\)/g, '')
    .trim();

  const m = wanted.match(/^(.*?)\s*-\s*(.*?)\s+(\d+)\s*-\s*(\d+)$/);
  if (!m) return null;
  const teamA = normalizeText(m[1]);
  const teamB = normalizeText(m[2]);
  const score = `${m[3]}-${m[4]}`;
  const compactScore = `${m[3]} ${m[4]}`;
  const normalizedHtml = normalizeText(html);
  const haystack = normalizedHtml.replace(/\s+/g, ' ');

  const needles = [
    `${teamA} ${teamB}`,
    `${teamB} ${teamA}`,
  ];

  for (const needle of needles) {
    const idx = haystack.indexOf(needle);
    if (idx === -1) continue;
    const around = haystack.slice(Math.max(0, idx - 1500), idx + 2500);
    if (!around.includes(score) && !around.includes(compactScore)) continue;
    const dateMatch = around.match(/(\d{1,2})\s*(?:\/|-|\s)\s*(\d{1,2})\s*(?:\/|-|\s)\s*(\d{4})/);
    const jornadaMatch = around.match(/jornada\s*(\d{1,2})/i);
    return {
      date: dateMatch ? `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}` : null,
      jornadaNumber: jornadaMatch ? Number(jornadaMatch[1]) : null,
    };
  }

  const lines = html.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = normalizeText(lines[i]);
    if (!line || !line.includes(score)) continue;
    if (line.includes(teamA) && line.includes(teamB)) {
      const around = lines.slice(Math.max(0, i - 8), Math.min(lines.length, i + 8)).join(' ');
      const dateMatch = around.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      const jornadaMatch = around.match(/jornada\s*(\d{1,2})/i);
      return {
        date: dateMatch ? dateMatch[1] : null,
        jornadaNumber: jornadaMatch ? Number(jornadaMatch[1]) : null,
      };
    }
  }
  return null;
}

ipcMain.handle('analysis:list-public-xml', async () => {
  const xmlDir = path.join(resolveRendererPublicDir(), 'XML');
  if (!fs.existsSync(xmlDir)) return [];
  return fs.readdirSync(xmlDir)
    .filter((f) => f.toLowerCase().endsWith('.xml'))
    .sort((a, b) => a.localeCompare(b, 'es'));
});

ipcMain.handle('analysis:read-public-xml', async (_evt, fileName) => {
  const xmlDir = path.join(resolveRendererPublicDir(), 'XML');
  const fullPath = path.join(xmlDir, fileName || '');
  if (!fullPath.startsWith(xmlDir)) throw new Error('Ruta inválida');
  return fs.readFileSync(fullPath, 'utf8');
});

ipcMain.handle('analysis:pick-video', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win, {
    title: 'Seleccionar vídeo',
    properties: ['openFile'],
    filters: [{ name: 'Vídeo', extensions: ['mp4', 'mov', 'avi', 'mkv', 'm4v', 'webm'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('analysis:lookup-besoccer', async (_evt, matchName) => {
  try {
    return await lookupBeSoccerMeta(matchName);
  } catch {
    return null;
  }
});

ipcMain.handle('analysis:select-folder', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Seleccionar carpeta de destino para los clips'
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('analysis:export-clips', async (_evt, { videoPath, clips, outputDir }) => {
  try {
    const results = [];
    for (const clip of clips) {
      const { start, end, name } = clip;
      const fileName = `${name.replace(/[^a-z0-9]/gi, '_')}_${start}.mp4`;
      const outputPath = path.join(outputDir, fileName);
      
      // Fast cut using -c copy
      const cmd = `ffmpeg -y -ss ${start} -to ${end} -i "${videoPath}" -c copy "${outputPath}"`;
      await execPromise(cmd);
      results.push({ name, success: true, path: outputPath });
    }
    return { success: true, results };
  } catch (err) {
    console.error('Export error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('sofascore:fetch-match-data', async (_evt, { url, goalkeeperName }) => {
  try {
    const scraper = new SofaScoreScraper();
    const data = await scraper.fetchMatchData(url, goalkeeperName);
    return { success: true, data };
  } catch (err) {
    console.error('[SofaScore] fetchMatchData error:', err.message);
    return { success: false, error: err.message };
  }
});

app.whenReady().then(() => {
  sendUsageTracking();
  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

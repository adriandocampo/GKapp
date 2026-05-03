import { app, BrowserWindow, ipcMain } from 'electron';
import updater from 'electron-updater';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { sendUsageTracking } from './tracking.js';

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

import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TRACKING_ENDPOINT = 'https://script.google.com/macros/s/AKfycbx6e9tJMeNhQbGp-Bmx5NB6OrDfhd4V6VYCujgSyK-TUgX-63bu5Duh3R3-m6GK-QqdoA/exec';
const CONFIG_FILE = 'gkapp-config.json';

function getConfigPath() {
  return path.join(app.getPath('userData'), CONFIG_FILE);
}

function getConfig() {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  return null;
}

function saveConfig(config) {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function generateUserId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getOrCreateUserId() {
  let config = getConfig();
  if (!config) {
    const userId = generateUserId();
    config = { userId, createdAt: new Date().toISOString() };
    saveConfig(config);
    return { userId, isFirstRun: true };
  }
  return { userId: config.userId, isFirstRun: false };
}

export function sendUsageTracking() {
  try {
    const { userId, isFirstRun } = getOrCreateUserId();
    const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    let appVersion = 'unknown';
    if (fs.existsSync(pkgPath)) {
      appVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version;
    }

    const payload = {
      userId,
      platform: process.platform,
      appVersion,
      isFirstRun,
    };

    fetch(TRACKING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (error) {
    // Silently fail
  }
}

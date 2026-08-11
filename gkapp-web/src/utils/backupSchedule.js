const DAY_MS = 86400000;

/**
 * Decide whether a backup should run now.
 *
 * A pending one-shot request (requestedBackupAt) always wins, even when the
 * automatic backup is disabled. Otherwise a backup runs only when enabled,
 * there is a previous backup older than intervalDays, and the user has had
 * activity since that backup.
 */
export function shouldRunBackup({ config, lastBackupDate, hasActivity, now = Date.now() }) {
  if (!config) return false;

  if (config.requestedBackupAt) return true;

  if (!config.enabled) return false;

  if (!lastBackupDate) return true;

  const lastTime = lastBackupDate instanceof Date
    ? lastBackupDate.getTime()
    : new Date(lastBackupDate).getTime();
  const daysSince = (now - lastTime) / DAY_MS;

  return daysSince >= (config.intervalDays || 7) && hasActivity;
}

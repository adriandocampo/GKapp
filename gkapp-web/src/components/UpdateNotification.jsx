import { useState, useEffect, useCallback } from 'react';
import { Download, X, RotateCcw, ShieldCheck } from 'lucide-react';

export default function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [progress, setProgress] = useState(null);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (!window.electronAPI?.onUpdateAvailable) return;

    const removeAvailable = window.electronAPI.onUpdateAvailable((info) => {
      setUpdateInfo(info);
      setProgress(null);
    });

    const removeDownloaded = window.electronAPI.onUpdateDownloaded(() => {
      setProgress({ percent: 100, status: 'Listo para instalar' });
    });

    const removeError = window.electronAPI.onUpdateError((err) => {
      console.error('Update error:', err);
      setProgress(null);
    });

    return () => {
      removeAvailable?.();
      removeDownloaded?.();
      removeError?.();
    };
  }, []);

  const handleDownload = useCallback(() => {
    setProgress({ percent: 0, status: 'Descargando actualización...' });
    window.electronAPI?.downloadUpdate?.();
  }, []);

  const handleInstall = useCallback(() => {
    setIsInstalling(true);
    window.electronAPI?.installUpdate?.();
  }, []);

  const handleDismiss = useCallback(() => {
    setUpdateInfo(null);
    setProgress(null);
  }, []);

  if (!updateInfo) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-sm w-full">
      <div className="bg-gk-card border border-gk-border-hover rounded-lg shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Download size={20} className="text-gk-accent" />
            <h3 className="font-semibold text-gk-text-primary">Nueva versión disponible</h3>
          </div>
          {!isInstalling && (
            <button
              onClick={handleDismiss}
              className="text-gk-text-tertiary hover:text-gk-text-primary transition-colors"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <p className="text-sm text-gk-text-secondary mb-3">
          GKApp <span className="text-gk-accent font-medium">{updateInfo.version}</span> está lista.
        </p>

        <div className="flex items-start space-x-2 bg-gk-elevated/50 rounded p-2 mb-3">
          <ShieldCheck size={16} className="text-gk-accent mt-0.5 flex-shrink-0" />
          <p className="text-xs text-gk-text-tertiary">
            Tus sesiones, tareas y configuraciones se conservarán al actualizar. Los datos nunca se eliminan durante una actualización.
          </p>
        </div>

        {progress && (
          <div className="mb-3">
            <div className="w-full bg-gk-elevated rounded-full h-2">
              <div
                className="bg-gk-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <p className="text-xs text-gk-text-tertiary mt-1">{progress.status}</p>
          </div>
        )}

        <div className="flex space-x-2">
          {!progress && (
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center space-x-2 bg-gk-accent hover:bg-gk-accent text-white text-sm font-medium py-2 px-4 rounded-md transition-colors"
            >
              <Download size={16} />
              <span>Descargar</span>
            </button>
          )}

          {progress?.percent === 100 && (
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="flex-1 flex items-center justify-center space-x-2 bg-gk-accent hover:bg-gk-accent disabled:bg-gk-elevated text-white text-sm font-medium py-2 px-4 rounded-md transition-colors"
            >
              <RotateCcw size={16} />
              <span>{isInstalling ? 'Instalando...' : 'Instalar y reiniciar'}</span>
            </button>
          )}

          {!isInstalling && (
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-sm text-gk-text-secondary hover:text-white transition-colors"
            >
              Más tarde
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

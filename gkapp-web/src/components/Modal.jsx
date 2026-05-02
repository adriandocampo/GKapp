/* eslint-disable react-refresh/only-export-components */
import { useState, useCallback, createContext, useContext } from 'react';
import { X } from 'lucide-react';

const ModalContext = createContext();

export function ModalProvider({ children }) {
  const [modal, setModal] = useState(null);

  const showModal = useCallback((config) => {
    return new Promise((resolve) => {
      setModal({ ...config, resolve });
    });
  }, []);

  const closeModal = useCallback((result) => {
    if (modal?.resolve) modal.resolve(result);
    setModal(null);
  }, [modal]);

  return (
    <ModalContext.Provider value={{ showModal }}>
      {children}
      {modal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70" onClick={() => closeModal(modal.cancelValue ?? null)}>
          <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-md w-full" onClick={e => e.stopPropagation()}>
            {modal.title && (
              <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-100">{modal.title}</h3>
                <button onClick={() => closeModal(modal.cancelValue ?? null)} className="p-1 hover:bg-slate-700 rounded text-slate-400">
                  <X size={20} />
                </button>
              </div>
            )}
            <div className="p-4">
              {modal.message && <p className="text-slate-300 text-sm mb-4">{modal.message}</p>}
              {modal.type === 'confirm' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => closeModal(false)}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 font-medium transition-colors"
                  >
                    {modal.cancelText || 'Cancelar'}
                  </button>
                  <button
                    onClick={() => closeModal(true)}
                    className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-white font-medium transition-colors"
                  >
                    {modal.confirmText || 'Confirmar'}
                  </button>
                </div>
              )}
              {modal.type === 'prompt' && (
                <div className="space-y-3">
                  <input
                    type="text"
                    defaultValue={modal.defaultValue || ''}
                    placeholder={modal.placeholder || ''}
                    className="modal-prompt-input w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const val = e.target.value.trim();
                        if (val || !modal.required) closeModal(val);
                      }
                      if (e.key === 'Escape') closeModal(null);
                    }}
                    ref={el => el?.focus()}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => closeModal(null)}
                      className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => {
                        const input = document.querySelector('.modal-prompt-input');
                        const val = input?.value?.trim();
                        if (val || !modal.required) closeModal(val);
                      }}
                      className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-white font-medium transition-colors"
                    >
                      {modal.confirmText || 'Aceptar'}
                    </button>
                  </div>
                </div>
              )}
              {modal.type === 'alert' && (
                <button
                  onClick={() => closeModal(true)}
                  className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-white font-medium transition-colors"
                >
                  Aceptar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
}

export function useConfirm() {
  const { showModal } = useModal();
  return useCallback((message, options = {}) => {
    return showModal({
      type: 'confirm',
      title: options.title || 'Confirmar',
      message,
      confirmText: options.confirmText || 'Confirmar',
      cancelText: options.cancelText || 'Cancelar',
      cancelValue: false,
    });
  }, [showModal]);
}

export function usePrompt() {
  const { showModal } = useModal();
  return useCallback((message, options = {}) => {
    return showModal({
      type: 'prompt',
      title: options.title || 'Introducir valor',
      message,
      placeholder: options.placeholder || '',
      defaultValue: options.defaultValue || '',
      required: options.required ?? false,
      confirmText: options.confirmText || 'Aceptar',
      cancelValue: null,
    });
  }, [showModal]);
}

export function useAlert() {
  const { showModal } = useModal();
  return useCallback((message, options = {}) => {
    return showModal({
      type: 'alert',
      title: options.title || 'Atención',
      message,
    });
  }, [showModal]);
}

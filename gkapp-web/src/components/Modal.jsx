/* eslint-disable react-refresh/only-export-components */
import { useState, useCallback, createContext, useContext, useEffect, useRef } from 'react';
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
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{background: 'rgba(0,0,0,0.7)'}} onClick={() => closeModal(modal.cancelValue ?? null)}>
          <div className="glass-card-static max-w-md w-full" style={{borderRadius: 20}} onClick={e => e.stopPropagation()}>
            {modal.title && (
              <div className="p-5 flex items-center justify-between" style={{borderBottom: '1px solid rgba(185,165,135,0.08)'}}>
                <h3 className="text-lg font-bold" style={{color: '#f1ede7'}}>{modal.title}</h3>
                <button onClick={() => closeModal(modal.cancelValue ?? null)} className="v2-btn-ghost p-1 rounded-lg">
                  <X size={20} />
                </button>
              </div>
            )}
            <div className="p-5">
              {modal.messageHtml ? (
                <div className="text-sm mb-4" style={{color: '#baa587', lineHeight: 1.6}} dangerouslySetInnerHTML={{ __html: modal.messageHtml }} />
              ) : modal.message && <p className="text-sm mb-4" style={{color: '#baa587'}}>{modal.message}</p>}
              {modal.type === 'confirm' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => closeModal(false)}
                    className="v2-btn-ghost flex-1 justify-center py-2.5"
                  >
                    {modal.cancelText || 'Cancelar'}
                  </button>
                  <button
                    onClick={() => closeModal(true)}
                    style={{
                      flex: 1,
                      background: 'rgba(232,172,101,0.12)',
                      border: '1px solid rgba(232,172,101,0.15)',
                      borderRadius: 14,
                      padding: '10px 16px',
                      color: '#e8ac65',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
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
                    className="v2-input w-full"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const val = e.target.value.trim();
                        if (val || !modal.required) closeModal(val);
                      }
                      if (e.key === 'Escape') closeModal(null);
                    }}
                    ref={el => el?.focus()}
                    id="modal-prompt-input"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => closeModal(null)}
                      className="v2-btn-ghost flex-1 justify-center py-2.5"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => {
                        const input = document.getElementById('modal-prompt-input');
                        const val = input?.value?.trim();
                        if (val || !modal.required) closeModal(val);
                      }}
                      style={{
                        flex: 1,
                        background: 'rgba(232,172,101,0.12)',
                        border: '1px solid rgba(232,172,101,0.15)',
                        borderRadius: 14,
                        padding: '10px 16px',
                        color: '#e8ac65',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      {modal.confirmText || 'Aceptar'}
                    </button>
                  </div>
                </div>
              )}
              {modal.type === 'session-form' && (
                <SessionForm
                  modal={modal}
                  closeModal={closeModal}
                />
              )}
              {modal.type === 'alert' && (
                <button
                  onClick={() => closeModal(true)}
                  style={{
                    width: '100%',
                    background: 'rgba(232,172,101,0.12)',
                    border: '1px solid rgba(232,172,101,0.15)',
                    borderRadius: 14,
                    padding: '10px 16px',
                    color: '#e8ac65',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
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
      message: options.messageHtml ? undefined : message,
      messageHtml: options.messageHtml,
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

function SessionForm({ modal, closeModal }) {
  const [date, setDate] = useState(modal.defaultDate || new Date().toISOString().split('T')[0]);
  const [microciclo, setMicrociclo] = useState('');
  const [mdType, setMdType] = useState('');
  const nameRef = useRef();

  useEffect(() => { nameRef.current?.focus(); }, []);

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  function handleConfirm() {
    const name = nameRef.current?.value?.trim();
    if (!name) { nameRef.current?.focus(); return; }
    if (!microciclo.trim()) return;
    if (!mdType) return;
    closeModal({ name, date, microciclo: microciclo.trim(), mdType });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{color: '#997b66'}}>Nombre *</label>
        <input
          ref={nameRef}
          type="text"
          defaultValue={modal.defaultName || ''}
          placeholder="Mi sesión"
          className="v2-input w-full"
          onKeyDown={e => { if (e.key === 'Escape') closeModal(null); }}
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{color: '#997b66'}}>Fecha *</label>
        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="v2-input flex-1"
          />
          <button
            type="button"
            onClick={() => setDate(today)}
            className="px-3 py-2 rounded-xl text-sm transition-all"
            style={{
              background: date === today ? 'rgba(232,172,101,0.15)' : 'rgba(22,20,16,0.6)',
              color: date === today ? '#e8ac65' : '#baa587',
              border: '1px solid rgba(185,165,135,0.08)',
            }}
          >Hoy</button>
          <button
            type="button"
            onClick={() => setDate(tomorrow)}
            className="px-3 py-2 rounded-xl text-sm transition-all"
            style={{
              background: date === tomorrow ? 'rgba(232,172,101,0.15)' : 'rgba(22,20,16,0.6)',
              color: date === tomorrow ? '#e8ac65' : '#baa587',
              border: '1px solid rgba(185,165,135,0.08)',
            }}
          >Mañana</button>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{color: '#997b66'}}>Microciclo *</label>
        <input
          type="text"
          value={microciclo}
          onChange={e => setMicrociclo(e.target.value)}
          placeholder="Ej: 1"
          className="v2-input w-full"
          onKeyDown={e => { if (e.key === 'Enter' && microciclo.trim() && mdType) handleConfirm(); }}
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{color: '#997b66'}}>Tipo de MD *</label>
        <select
          value={mdType}
          onChange={e => setMdType(e.target.value)}
          className="v2-select w-full"
        >
          <option value="">Seleccionar tipo MD</option>
          <option value="Pretemporada">Pretemporada</option>
          <option value="MD-5">MD-5</option>
          <option value="MD-4">MD-4</option>
          <option value="MD-3">MD-3</option>
          <option value="MD-2">MD-2</option>
          <option value="MD-1">MD-1</option>
          <option value="MD+1">MD+1</option>
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => closeModal(null)}
          className="v2-btn-ghost flex-1 justify-center py-2.5"
        >Cancelar</button>
        <button
          onClick={handleConfirm}
          style={{
            flex: 1,
            background: 'rgba(232,172,101,0.12)',
            border: '1px solid rgba(232,172,101,0.15)',
            borderRadius: 14,
            padding: '10px 16px',
            color: !microciclo.trim() || !mdType ? '#997b66' : '#e8ac65',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: !microciclo.trim() || !mdType ? 'default' : 'pointer',
            opacity: !microciclo.trim() || !mdType ? 0.5 : 1,
          }}
          disabled={!microciclo.trim() || !mdType}
        >Aceptar</button>
      </div>
    </div>
  );
}

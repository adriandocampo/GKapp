import { useState, useRef, useEffect, useCallback } from 'react';
import { Square, Circle, ArrowRight, Type, Trash2, RotateCw, ChevronUp, ChevronDown, ChevronRight, RotateCcw, Paintbrush, LayoutTemplate, AlignLeft, AlignCenter, AlignRight, AlignVerticalSpaceAround, AlignHorizontalSpaceAround, Triangle, Hash, Link, Clipboard, Plus, Save, Star } from 'lucide-react';
import { FIELDS, OBJECTS_BY_CATEGORY } from '../data/imageAssets.js';

function uid() { return Math.random().toString(36).substr(2, 9); }

function getArrowBox(el) {
  const minX = Math.min(el.x1, el.x2);
  const minY = Math.min(el.y1, el.y2);
  const maxX = Math.max(el.x1, el.x2);
  const maxY = Math.max(el.y1, el.y2);
  return { x: minX, y: minY, w: Math.max(10, maxX - minX), h: Math.max(10, maxY - minY) };
}

export default function ImageEditor({ onSave, onCancel, taskData = {}, initialElements = null }) {
  const canvasRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  const [elements, setElements] = useState(initialElements || []);
  const [selectedIds, setSelectedIds] = useState([]);
  const [toolTab, setToolTab] = useState('fields');
  const [expandedCategories, setExpandedCategories] = useState(() => new Set());
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [rotating, setRotating] = useState(null);
  const [editingTextId, setEditingTextId] = useState(null);
  const [clipboard, setClipboard] = useState(null);
  const [pasteCount, setPasteCount] = useState(0);
  const [selectBox, setSelectBox] = useState(null);
  const fileInputRef = useRef();
  const objectFileInputRef = useRef();
  const [showAddObjectModal, setShowAddObjectModal] = useState(false);
  const [objectUrl, setObjectUrl] = useState('');
  const [showTextInputModal, setShowTextInputModal] = useState(false);
  const [textInputValue, setTextInputValue] = useState('');
  const [shapePresets, setShapePresets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('shapePresets') || '{"rect":[],"circle":[],"triangle":[]}'); } catch { return { rect: [], circle: [], triangle: [] }; }
  });
  const [showPresetName, setShowPresetName] = useState(false);
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    const fieldEl = elements.find(e => e.type === 'field');
    const fieldSrc = fieldEl?.src;
    if (!fieldSrc) return;
    const img = new Image();
    img.onload = () => {
      const maxW = Math.min(window.innerWidth - 420, 1000);
      const scale = Math.min(1, maxW / img.naturalWidth);
      setCanvasSize({ w: img.naturalWidth * scale, h: img.naturalHeight * scale });
    };
    img.src = fieldSrc;
  }, [elements]);

  const addElement = useCallback((type, extra = {}) => {
    const id = uid();
    if (type === 'field') {
      setElements(prev => {
        const filtered = prev.filter(e => e.type !== 'field');
        return [...filtered, { id, type, x: 0, y: 0, w: canvasSize.w, h: canvasSize.h, zIndex: 0, ...extra }];
      });
    } else if (type === 'text') {
      setElements(prev => [...prev, {
        id, type, x: canvasSize.w / 2 - 50, y: canvasSize.h / 2 - 25, w: 200, h: 40,
        text: extra.text || 'Texto', fontSize: extra.fontSize || 20, color: extra.color || '#000000',
        fontWeight: extra.fontWeight || 'normal', bgColor: extra.bgColor || 'transparent',
        textAlign: extra.textAlign || 'left', padding: extra.padding || 4,
        stroke: extra.stroke || '#000000', strokeWidth: extra.strokeWidth || 2, noStroke: true,
        rotation: 0, opacity: 1, flipH: false, zIndex: prev.length + 1,
      }]);
    } else if (type === 'rect') {
      setElements(prev => [...prev, {
        id, type, x: canvasSize.w / 2 - 50, y: canvasSize.h / 2 - 50, w: 100, h: 100,
        fill: 'transparent', stroke: '#000000', strokeWidth: 3, fillType: 'transparent',
        strokeStyle: 'solid', fillOpacity: 0.2,
        rotation: 0, opacity: 1, flipH: false, zIndex: prev.length + 1,
      }]);
    } else if (type === 'circle') {
      setElements(prev => [...prev, {
        id, type, x: canvasSize.w / 2 - 50, y: canvasSize.h / 2 - 50, w: 100, h: 100,
        fill: 'transparent', stroke: '#000000', strokeWidth: 3, fillType: 'transparent',
        strokeStyle: 'solid', fillOpacity: 0.2,
        rotation: 0, opacity: 1, flipH: false, zIndex: prev.length + 1,
      }]);
    } else if (type === 'triangle') {
      setElements(prev => [...prev, {
        id, type, x: canvasSize.w / 2 - 50, y: canvasSize.h / 2 - 50, w: 100, h: 100,
        fill: 'transparent', stroke: '#000000', strokeWidth: 3, fillType: 'transparent',
        strokeStyle: 'solid', fillOpacity: 0.2,
        rotation: 0, opacity: 1, flipH: false, zIndex: prev.length + 1,
      }]);
    } else if (type === 'number') {
      setElements(prev => [...prev, {
        id, type, x: canvasSize.w / 2 - 30, y: canvasSize.h / 2 - 30, w: 60, h: 60,
        number: 1, numberColor: extra.numberColor || '#000000',
        fontSize: extra.fontSize || 28, fontWeight: 'bold',
        stroke: extra.stroke || '#000000', strokeWidth: extra.strokeWidth || 3,
        bgColor: extra.bgColor || '#ffffff', noStroke: false,
        rotation: 0, opacity: 1, flipH: false, zIndex: prev.length + 1,
      }]);
    } else if (type === 'arrow') {
      const x1 = canvasSize.w / 2 - 60;
      const y1 = canvasSize.h / 2;
      const x2 = canvasSize.w / 2 + 60;
      const y2 = canvasSize.h / 2;
      setElements(prev => [...prev, {
        id, type, x1, y1, x2, y2,
        stroke: '#000000', strokeWidth: 4, headStyle: 'standard',
        doubleHead: false, headSize: 4, strokeStyle: 'solid',
        opacity: 1, flipH: false, zIndex: prev.length + 1,
      }]);
    } else {
      setElements(prev => [...prev, {
        id, type, x: canvasSize.w / 2 - 50, y: canvasSize.h / 2 - 50, w: 100, h: 100,
        rotation: 0, opacity: 1, flipH: false, zIndex: prev.length + 1, ...extra,
      }]);
    }
    setSelectedIds([id]);
  }, [canvasSize.w, canvasSize.h]);

  const generateCard = () => {
    const { subtitle, time, reps, focus, description } = taskData;
    const baseZ = elements.length;

    if (subtitle) {
      setElements(prev => [...prev, {
        id: uid(), type: 'text', x: 30, y: 10, w: canvasSize.w * 0.22, h: 22,
        text: String(subtitle).toUpperCase(), fontSize: 12, color: '#000000', fontWeight: 'bold',
        bgColor: 'transparent', textAlign: 'left', padding: 2, zIndex: baseZ + 1,
      }]);
    }
    if (focus) {
      setElements(prev => [...prev, {
        id: uid(), type: 'text', x: canvasSize.w * 0.58, y: 10, w: canvasSize.w * 0.22, h: 22,
        text: String(focus).toUpperCase(), fontSize: 12, color: '#000000', fontWeight: 'bold',
        bgColor: 'transparent', textAlign: 'left', padding: 2, zIndex: baseZ + 2,
      }]);
    }
    if (time) {
      setElements(prev => [...prev, {
        id: uid(), type: 'text', x: 60, y: 56, w: 60, h: 18,
        text: String(time).toUpperCase(), fontSize: 11, color: '#000000', fontWeight: 'bold',
        bgColor: 'transparent', textAlign: 'left', padding: 2, zIndex: baseZ + 3,
      }]);
    }
    if (reps) {
      setElements(prev => [...prev, {
        id: uid(), type: 'text', x: 60, y: 76, w: 60, h: 18,
        text: String(reps).toUpperCase(), fontSize: 11, color: '#000000', fontWeight: 'bold',
        bgColor: 'transparent', textAlign: 'left', padding: 2, zIndex: baseZ + 4,
      }]);
    }
    if (description) {
      setElements(prev => [...prev, {
        id: uid(), type: 'text', x: 20, y: canvasSize.h - 40, w: canvasSize.w - 40, h: 36,
        text: String(description).toUpperCase(), fontSize: 13, color: '#000000', fontWeight: 'bold',
        bgColor: 'transparent', textAlign: 'center', padding: 2, zIndex: baseZ + 5,
      }]);
    }
  };

  const handleSelect = (id, e) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    } else {
      setSelectedIds([id]);
    }
  };

  const clearSelection = () => { setSelectedIds([]); setEditingTextId(null); };

  const onMouseDownCanvas = (e) => {
    if (e.button !== 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = canvasSize.w / rect.width;
    const sy = canvasSize.h / rect.height;
    const x = (e.clientX - rect.left) * sx;
    const y = (e.clientY - rect.top) * sy;
    setSelectBox({ startX: x, startY: y, currentX: x, currentY: y, ctrlKey: e.ctrlKey || e.metaKey });
  };

  const onMouseDownEl = (e, el) => {
    if (el.type === 'field') return;
    e.stopPropagation();
    if (editingTextId === el.id) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = canvasSize.w / rect.width;
    const sy = canvasSize.h / rect.height;

    if (el.type === 'arrow') {
      const clickX = (e.clientX - rect.left) * sx;
      const clickY = (e.clientY - rect.top) * sy;
      const dStart = Math.hypot(clickX - el.x1, clickY - el.y1);
      const dEnd = Math.hypot(clickX - el.x2, clickY - el.y2);
      if (dStart < 15 && selectedIds.includes(el.id)) {
        setDragging({ id: el.id, type: 'arrow-start' });
        return;
      }
      if (dEnd < 15 && selectedIds.includes(el.id)) {
        setDragging({ id: el.id, type: 'arrow-end' });
        return;
      }
      setDragging({ id: el.id, type: 'arrow-move', ox: clickX, oy: clickY, sx: el.x1, sy: el.y1, ex: el.x2, ey: el.y2 });
      return;
    }

    if (selectedIds.length > 1 && selectedIds.includes(el.id)) {
      setDragging({ id: el.id, type: 'group-move', ox: (e.clientX - rect.left) * sx, oy: (e.clientY - rect.top) * sy, initial: elements.filter(x => selectedIds.includes(x.id)).map(x => ({ id: x.id, x: x.x, y: x.y, x1: x.x1, y1: x.y1, x2: x.x2, y2: x.y2 })) });
    } else {
      setDragging({ id: el.id, type: 'move', ox: (e.clientX - rect.left) * sx - el.x, oy: (e.clientY - rect.top) * sy - el.y });
    }
  };

  const onMouseDownResize = (e, handle) => {
    e.stopPropagation();
    const el = elements.find(x => x.id === selectedIds[0]);
    if (!el || el.type === 'arrow') return;
    setResizing({ id: el.id, handle, sx: e.clientX, sy: e.clientY, sw: el.w, sh: el.h, sl: el.x, st: el.y, fontSize: el.fontSize || 0 });
  };

  const onMouseDownRotate = (e) => {
    e.stopPropagation();
    const el = elements.find(x => x.id === selectedIds[0]);
    if (!el || el.type === 'arrow') return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = rect.left + (el.x + el.w / 2) * (rect.width / canvasSize.w);
    const cy = rect.top + (el.y + el.h / 2) * (rect.height / canvasSize.h);
    setRotating({ id: el.id, cx, cy, startAngle: Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI, startRot: el.rotation || 0 });
  };

  useEffect(() => {
    const onMove = (e) => {
      if (selectBox) {
        const rect = canvasRef.current.getBoundingClientRect();
        const sx = canvasSize.w / rect.width;
        const sy = canvasSize.h / rect.height;
        const mx = (e.clientX - rect.left) * sx;
        const my = (e.clientY - rect.top) * sy;
        setSelectBox(prev => prev ? { ...prev, currentX: mx, currentY: my } : null);
      }
      if (dragging) {
        const rect = canvasRef.current.getBoundingClientRect();
        const sx = canvasSize.w / rect.width;
        const sy = canvasSize.h / rect.height;
        const mx = (e.clientX - rect.left) * sx;
        const my = (e.clientY - rect.top) * sy;

        if (dragging.type === 'move') {
          setElements(prev => prev.map(el => el.id === dragging.id ? { ...el, x: mx - dragging.ox, y: my - dragging.oy } : el));
        } else if (dragging.type === 'group-move') {
          const dx = mx - dragging.ox;
          const dy = my - dragging.oy;
          setElements(prev => prev.map(el => {
            const ini = dragging.initial.find(i => i.id === el.id);
            if (!ini) return el;
            if (el.type === 'arrow') {
              return { ...el, x1: ini.x1 + dx, y1: ini.y1 + dy, x2: ini.x2 + dx, y2: ini.y2 + dy };
            }
            return { ...el, x: ini.x + dx, y: ini.y + dy };
          }));
        } else if (dragging.type === 'arrow-start') {
          setElements(prev => prev.map(el => el.id === dragging.id ? { ...el, x1: mx, y1: my } : el));
        } else if (dragging.type === 'arrow-end') {
          setElements(prev => prev.map(el => el.id === dragging.id ? { ...el, x2: mx, y2: my } : el));
        } else if (dragging.type === 'arrow-move') {
          const dx = mx - dragging.ox;
          const dy = my - dragging.oy;
          setElements(prev => prev.map(el => el.id === dragging.id ? { ...el, x1: dragging.sx + dx, y1: dragging.sy + dy, x2: dragging.ex + dx, y2: dragging.ey + dy } : el));
        }
      }
      if (resizing) {
        const rect = canvasRef.current.getBoundingClientRect();
        const sc = canvasSize.w / rect.width;
        const dx = (e.clientX - resizing.sx) * sc;
        const dy = (e.clientY - resizing.sy) * sc;
        setElements(prev => prev.map(el => {
          if (el.id !== resizing.id) return el;
          let u = {};
          if (el.type === 'number') {
            const deltas = [];
            if (resizing.handle.includes('e')) deltas.push(dx);
            if (resizing.handle.includes('w')) deltas.push(-dx);
            if (resizing.handle.includes('s')) deltas.push(dy);
            if (resizing.handle.includes('n')) deltas.push(-dy);
            const delta = deltas.length > 0 ? Math.max(...deltas) : 0;
            const newSize = Math.max(20, resizing.sw + delta);
            const ratio = newSize / resizing.sw;
            u.w = newSize;
            u.h = newSize;
            u.fontSize = Math.round(resizing.fontSize * ratio);
            if (resizing.handle.includes('w')) u.x = resizing.sl + (resizing.sw - newSize);
            if (resizing.handle.includes('n')) u.y = resizing.st + (resizing.sh - newSize);
          } else if (el.type === 'text') {
            if (resizing.handle.includes('e')) u.w = Math.max(20, resizing.sw + dx);
            if (resizing.handle.includes('w')) { u.w = Math.max(20, resizing.sw - dx); u.x = resizing.sl + (resizing.sw - u.w); }
            if (resizing.handle.includes('s')) u.h = Math.max(20, resizing.sh + dy);
            if (resizing.handle.includes('n')) { u.h = Math.max(20, resizing.sh - dy); u.y = resizing.st + (resizing.sh - u.h); }
          } else {
            if (resizing.handle.includes('e')) u.w = Math.max(20, resizing.sw + dx);
            if (resizing.handle.includes('w')) { u.w = Math.max(20, resizing.sw - dx); u.x = resizing.sl + (resizing.sw - u.w); }
            if (resizing.handle.includes('s')) u.h = Math.max(20, resizing.sh + dy);
            if (resizing.handle.includes('n')) { u.h = Math.max(20, resizing.sh - dy); u.y = resizing.st + (resizing.sh - u.h); }
          }
          return { ...el, ...u };
        }));
      }
      if (rotating) {
        const angle = Math.atan2(e.clientY - rotating.cy, e.clientX - rotating.cx) * 180 / Math.PI;
        setElements(prev => prev.map(el => el.id === rotating.id ? { ...el, rotation: rotating.startRot + (angle - rotating.startAngle) } : el));
      }
    };
    const onUp = () => {
      if (selectBox) {
        const box = {
          x: Math.min(selectBox.startX, selectBox.currentX),
          y: Math.min(selectBox.startY, selectBox.currentY),
          w: Math.abs(selectBox.currentX - selectBox.startX),
          h: Math.abs(selectBox.currentY - selectBox.startY),
        };
        if (box.w > 5 && box.h > 5) {
          const intersects = (el) => {
            let ex, ey, ew, eh;
            if (el.type === 'arrow') {
              const b = getArrowBox(el);
              ex = b.x; ey = b.y; ew = b.w; eh = b.h;
            } else {
              ex = el.x; ey = el.y; ew = el.w; eh = el.h;
            }
            return !(ex + ew < box.x || ex > box.x + box.w || ey + eh < box.y || ey > box.y + box.h);
          };
          const newSel = elements.filter(e => e.type !== 'field' && intersects(e)).map(e => e.id);
          if (selectBox.ctrlKey) {
            setSelectedIds(prev => [...new Set([...prev, ...newSel])]);
          } else {
            setSelectedIds(newSel);
          }
        } else if (!selectBox.ctrlKey) {
          clearSelection();
        }
        setSelectBox(null);
      }
      setDragging(null); setResizing(null); setRotating(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, resizing, rotating, canvasSize, selectBox, elements]);

  const updateSelected = (updates) => {
    setElements(prev => prev.map(el => selectedIds.includes(el.id) ? { ...el, ...updates } : el));
  };

  const deleteSelected = () => {
    setElements(prev => prev.filter(el => !selectedIds.includes(el.id)));
    setSelectedIds([]);
  };

  const clearOverlays = () => {
    setElements(prev => prev.filter(el => el.type === 'field'));
    setSelectedIds([]);
  };

  const bringForward = () => {
    const mx = Math.max(...elements.map(e => e.zIndex), 0);
    updateSelected({ zIndex: mx + 1 });
  };

  const sendBackward = () => {
    const mn = Math.min(...elements.map(e => e.zIndex), 0);
    updateSelected({ zIndex: mn - 1 });
  };

  const alignHorizontal = () => {
    if (selectedIds.length < 2) return;
    const sel = elements.filter(e => selectedIds.includes(e.id));
    const avgY = sel.reduce((sum, e) => sum + (e.type === 'arrow' ? (e.y1 + e.y2) / 2 : e.y + e.h / 2), 0) / sel.length;
    setElements(prev => prev.map(el => {
      if (!selectedIds.includes(el.id)) return el;
      if (el.type === 'arrow') {
        const midY = (el.y1 + el.y2) / 2;
        const dy = avgY - midY;
        return { ...el, y1: el.y1 + dy, y2: el.y2 + dy };
      }
      return { ...el, y: avgY - el.h / 2 };
    }));
  };

  const alignVertical = () => {
    if (selectedIds.length < 2) return;
    const sel = elements.filter(e => selectedIds.includes(e.id));
    const avgX = sel.reduce((sum, e) => sum + (e.type === 'arrow' ? (e.x1 + e.x2) / 2 : e.x + e.w / 2), 0) / sel.length;
    setElements(prev => prev.map(el => {
      if (!selectedIds.includes(el.id)) return el;
      if (el.type === 'arrow') {
        const midX = (el.x1 + el.x2) / 2;
        const dx = avgX - midX;
        return { ...el, x1: el.x1 + dx, x2: el.x2 + dx };
      }
      return { ...el, x: avgX - el.w / 2 };
    }));
  };

  const selectedEls = elements.filter(e => selectedIds.includes(e.id));
  const primarySelected = selectedEls[0];

  const duplicateSelected = () => {
    if (!primarySelected) return;
    const id = uid();
    let duplicated;
    if (primarySelected.type === 'arrow') {
      duplicated = { ...primarySelected, id, x1: primarySelected.x1 + 20, y1: primarySelected.y1 + 20, x2: primarySelected.x2 + 20, y2: primarySelected.y2 + 20 };
    } else if (primarySelected.type === 'number') {
      duplicated = { ...primarySelected, id, x: primarySelected.x + 20, y: primarySelected.y + 20, number: (primarySelected.number || 1) + 1 };
    } else {
      duplicated = { ...primarySelected, id, x: primarySelected.x + 20, y: primarySelected.y + 20 };
    }
    setElements(prev => [...prev, duplicated]);
    setSelectedIds([id]);
  };

  const copySelected = () => {
    if (!primarySelected) return;
    const { ...rest } = primarySelected;
    setClipboard({ ...rest });
    setPasteCount(0);
  };

  const pasteClipboard = () => {
    if (!clipboard) return;
    const id = uid();
    const offset = (pasteCount + 1) * 20;
    setPasteCount(prev => prev + 1);
    let pasted;
    if (clipboard.type === 'arrow') {
      pasted = { ...clipboard, id, x1: clipboard.x1 + offset, y1: clipboard.y1 + offset, x2: clipboard.x2 + offset, y2: clipboard.y2 + offset };
    } else {
      pasted = { ...clipboard, id, x: clipboard.x + offset, y: clipboard.y + offset };
    }
    setElements(prev => [...prev, pasted]);
    setSelectedIds([id]);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (editingTextId) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        copySelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        pasteClipboard();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          deleteSelected();
        }
      }
      if (e.key === 'Escape') {
        setSelectedIds([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primarySelected, clipboard, editingTextId, selectedIds, pasteCount]);

  const capture = async () => {
    try {
      setSelectedIds([]);
      setEditingTextId(null);
      setSelectBox(null);
      document.activeElement?.blur();

      await new Promise(resolve => {
        requestAnimationFrame(() => setTimeout(resolve, 80));
      });

      const el = canvasRef.current;
      if (!el) return;

      const styleTag = document.createElement('style');
      styleTag.id = 'capture-override';
      styleTag.textContent = `
        * { box-shadow: none !important; outline: none !important; }
        img { background: transparent !important; padding: 0 !important; margin: 0 !important; }
        .ring-2, .ring-teal-500 { box-shadow: none !important; outline: none !important; border: none !important; }
      `;
      el.appendChild(styleTag);

      await new Promise(resolve => setTimeout(resolve, 50));

      const domtoimage = await import('dom-to-image-more');
      const dataUrl = await domtoimage.toPng(el, {
        quality: 1,
        scale: 3,
        bgcolor: '#ffffff',
        width: canvasSize.w,
        height: canvasSize.h,
        style: { transform: 'none', transformOrigin: 'top left' },
      });

      styleTag.remove();

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      if (blob) { onSave(blob, elements); }
      else { alert('Error: no se pudo generar la imagen'); }
    } catch (err) {
      console.error('Capture error:', err);
      alert('Error al capturar la imagen: ' + err.message);
    }
  };

  const handleUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const url = URL.createObjectURL(file);
    addElement('image', { src: url });
  };

  const handleAddObjectFromFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const url = URL.createObjectURL(file);
    addElement('image', { src: url });
    setShowAddObjectModal(false);
  };

  const handleAddObjectFromUrl = () => {
    if (!objectUrl.trim()) return;
    addElement('image', { src: objectUrl.trim() });
    setShowAddObjectModal(false);
    setObjectUrl('');
  };

  const handlePasteImage = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const url = URL.createObjectURL(blob);
            addElement('image', { src: url });
            setShowAddObjectModal(false);
            return;
          }
        }
      }
      alert('No se encontró ninguna imagen en el portapapeles');
    } catch (err) {
      console.error('Paste error:', err);
      alert('No se pudo acceder al portapapeles. Asegúrate de dar permisos al navegador.');
    }
  };

  const handleAddText = () => {
    if (!textInputValue.trim()) return;
    addElement('text', { text: textInputValue.trim() });
    setShowTextInputModal(false);
    setTextInputValue('');
  };

  const saveShapePreset = () => {
    if (!primarySelected || !['rect', 'circle', 'triangle'].includes(primarySelected.type)) return;
    const shapeType = primarySelected.type;
    const name = presetName.trim() || `Preset ${shapePresets[shapeType].length + 1}`;
    const preset = {
      id: uid(),
      name,
      stroke: primarySelected.stroke,
      strokeWidth: primarySelected.strokeWidth,
      strokeStyle: primarySelected.strokeStyle,
      fill: primarySelected.fill,
      fillType: primarySelected.fillType,
      fillOpacity: primarySelected.fillOpacity,
    };
    const updated = { ...shapePresets, [shapeType]: [...shapePresets[shapeType], preset] };
    setShapePresets(updated);
    localStorage.setItem('shapePresets', JSON.stringify(updated));
    setShowPresetName(false);
    setPresetName('');
  };

  const loadShapePreset = (preset) => {
    if (!primarySelected || !['rect', 'circle', 'triangle'].includes(primarySelected.type)) return;
    updateSelected({
      stroke: preset.stroke,
      strokeWidth: preset.strokeWidth,
      strokeStyle: preset.strokeStyle,
      fill: preset.fill,
      fillType: preset.fillType,
      fillOpacity: preset.fillOpacity,
    });
  };

  const deleteShapePreset = (id) => {
    if (!primarySelected || !['rect', 'circle', 'triangle'].includes(primarySelected.type)) return;
    const shapeType = primarySelected.type;
    const updated = { ...shapePresets, [shapeType]: shapePresets[shapeType].filter(p => p.id !== id) };
    setShapePresets(updated);
    localStorage.setItem('shapePresets', JSON.stringify(updated));
  };

  const stripedStyle = (color, opacity = 0.2) => {
    const hexOpacity = Math.round(opacity * 255).toString(16).padStart(2, '0');
    const lightOpacity = Math.round(opacity * 0.5 * 255).toString(16).padStart(2, '0');
    return {
      background: `repeating-linear-gradient(45deg, ${color}${hexOpacity}, ${color}${hexOpacity} 10px, ${color}${lightOpacity} 10px, ${color}${lightOpacity} 20px)`,
      border: `2px solid ${color}`,
    };
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-lg font-bold text-slate-100">Editor de imagen</h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-200 flex items-center gap-2">
            <LayoutTemplate size={14} /> Subir imagen
          </button>
          <button onClick={generateCard} className="px-3 py-1.5 bg-pink-700 hover:bg-pink-600 rounded text-sm text-white flex items-center gap-2">
            <LayoutTemplate size={14} /> Generar ficha
          </button>
          <button onClick={clearOverlays} className="px-3 py-1.5 bg-red-900/60 hover:bg-red-900/80 rounded text-sm text-red-200 flex items-center gap-2">
            <RotateCcw size={14} /> Limpiar overlays
          </button>
          <button onClick={capture} className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded text-sm text-white font-medium">
            Usar como imagen
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-200">
            Cancelar
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        <input ref={objectFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAddObjectFromFile} />
      </div>

      {showAddObjectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Añadir objeto</h3>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Desde archivo</label>
              <button onClick={() => objectFileInputRef?.current?.click()} className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 flex items-center justify-center gap-2 transition-colors">
                <LayoutTemplate size={16} /> Seleccionar imagen
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Desde enlace web</label>
              <div className="flex gap-2">
                <input type="text" value={objectUrl} onChange={e => setObjectUrl(e.target.value)} placeholder="https://ejemplo.com/imagen.png" className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-teal-500" />
                <button onClick={handleAddObjectFromUrl} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-white flex items-center gap-1 transition-colors">
                  <Link size={14} /> Añadir
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Desde portapapeles</label>
              <button onClick={handlePasteImage} className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 flex items-center justify-center gap-2 transition-colors">
                <Clipboard size={16} /> Pegar imagen
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => { setShowAddObjectModal(false); setObjectUrl(''); }} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showTextInputModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Añadir texto</h3>
            <textarea
              value={textInputValue}
              onChange={e => setTextInputValue(e.target.value)}
              placeholder="Escribe el texto..."
              rows={4}
              autoFocus
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-teal-500 resize-none"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddText(); } }}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowTextInputModal(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors">
                Cancelar
              </button>
              <button onClick={handleAddText} disabled={!textInputValue.trim()} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-lg text-white transition-colors">
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 gap-3 min-h-0">
        <div className="w-56 bg-slate-800 rounded-xl border border-slate-700 flex flex-col overflow-hidden shrink-0">
          <div className="flex border-b border-slate-700">
            {[
              { key: 'fields', icon: LayoutTemplate, label: 'Campos' },
              { key: 'objects', icon: Paintbrush, label: 'Objetos' },
              { key: 'shapes', icon: Square, label: 'Formas' },
              { key: 'text', icon: Type, label: 'Texto' },
            ].map(t => (
              <button key={t.key} onClick={() => setToolTab(t.key)} className={`flex-1 py-2 text-xs font-medium transition-colors ${toolTab === t.key ? 'bg-slate-700 text-teal-400' : 'text-slate-400 hover:bg-slate-700/50'}`}>
                <t.icon size={14} className="mx-auto mb-0.5" /> {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {toolTab === 'fields' && FIELDS.map(f => (
              <button key={f.id} onClick={() => addElement('field', { src: f.src })} className="w-full text-left p-2 rounded hover:bg-slate-700 transition-colors">
                <img src={f.src} alt={f.name} className="w-full h-20 object-contain bg-slate-900 rounded mb-1" />
                <div className="text-xs text-slate-300">{f.name}</div>
              </button>
            ))}
            {toolTab === 'objects' && (
              <>
                <div className="p-2">
                  <button onClick={() => setShowAddObjectModal(true)} className="w-full p-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm text-white font-medium flex items-center justify-center gap-2"><Plus size={16} /> Añadir objeto</button>
                </div>
                {OBJECTS_BY_CATEGORY.map(cat => {
                  const isExpanded = expandedCategories.has(cat.key);
                  return (
                    <div key={cat.key} className="mb-1">
                      <button
                        onClick={() => {
                          setExpandedCategories(prev => {
                            const next = new Set(prev);
                            if (next.has(cat.key)) next.delete(cat.key);
                            else next.add(cat.key);
                            return next;
                          });
                        }}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-slate-700/60 transition-colors text-xs font-semibold text-slate-200 uppercase tracking-wide"
                      >
                        <span>{cat.label}</span>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      {isExpanded && (
                        <div className="space-y-1 px-1 pt-1">
                          {cat.items.map(o => (
                            <button key={o.id} onClick={() => addElement('object', { src: o.src })} className="w-full text-left p-2 rounded hover:bg-slate-700 transition-colors">
                              <img src={o.src} alt={o.name} className="w-full h-16 object-contain bg-transparent rounded mb-1" style={{ border: 'none', background: 'transparent' }} />
                              <div className="text-xs text-slate-300 capitalize">{o.name}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
            {toolTab === 'shapes' && (
              <div className="space-y-2 p-2">
                <button onClick={() => addElement('rect')} className="w-full p-2 bg-slate-700 hover:bg-slate-600 rounded flex items-center gap-2 text-sm text-slate-200"><Square size={16} /> Rectángulo</button>
                <button onClick={() => addElement('circle')} className="w-full p-2 bg-slate-700 hover:bg-slate-600 rounded flex items-center gap-2 text-sm text-slate-200"><Circle size={16} /> Círculo</button>
                <button onClick={() => addElement('triangle')} className="w-full p-2 bg-slate-700 hover:bg-slate-600 rounded flex items-center gap-2 text-sm text-slate-200"><Triangle size={16} /> Triángulo</button>
                <button onClick={() => addElement('arrow')} className="w-full p-2 bg-slate-700 hover:bg-slate-600 rounded flex items-center gap-2 text-sm text-slate-200"><ArrowRight size={16} /> Flecha</button>
              </div>
            )}
            {toolTab === 'text' && (
              <div className="p-2 space-y-2">
                <button onClick={() => { setTextInputValue(''); setShowTextInputModal(true); }} className="w-full p-2 bg-teal-600 hover:bg-teal-500 rounded text-sm text-white font-medium">+ Añadir texto</button>
                <button onClick={() => addElement('number')} className="w-full p-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm text-white font-medium flex items-center justify-center gap-2"><Hash size={16} /> Añadir número</button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 bg-slate-900 rounded-xl border border-slate-700 overflow-auto flex items-center justify-center p-4">
          <div
            ref={canvasRef}
            className="relative bg-white select-none"
            style={{ width: canvasSize.w, height: canvasSize.h }}
            onMouseDown={onMouseDownCanvas}
          >
            {elements.sort((a,b) => a.zIndex - b.zIndex).map(el => {
              const isSelected = selectedIds.includes(el.id);
              if (el.type === 'arrow') {
                const box = getArrowBox(el);
                const dx = el.x2 - el.x1;
                const dy = el.y2 - el.y1;
                const angle = Math.atan2(dy, dx);
                const hs = el.headSize || 4;
                const sx = el.x1 - box.x;
                const sy = el.y1 - box.y;
                const ex = el.x2 - box.x;
                const ey = el.y2 - box.y;
                const arrowHead = (x, y, dir) => {
                  const a = dir + Math.PI;
                  const p1x = x + hs * Math.cos(a - Math.PI / 6);
                  const p1y = y + hs * Math.sin(a - Math.PI / 6);
                  const p2x = x + hs * Math.cos(a + Math.PI / 6);
                  const p2y = y + hs * Math.sin(a + Math.PI / 6);
                  if (el.headStyle === 'round') {
                    return <circle cx={x} cy={y} r={hs * 0.4} fill={el.stroke} />;
                  }
                  return <polygon points={`${p1x},${p1y} ${x},${y} ${p2x},${p2y}`} fill={el.stroke} />;
                };
                return (
                  <div key={el.id} className="absolute" style={{ left: box.x, top: box.y, width: box.w, height: box.h, zIndex: el.zIndex, transform: `scaleX(${el.flipH ? -1 : 1})` }}>
                    <svg width="100%" height="100%" viewBox={`0 0 ${box.w} ${box.h}`} className="pointer-events-none overflow-visible">
                      <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeDasharray={el.strokeStyle === 'dashed' ? '8 6' : undefined} />
                      {arrowHead(ex, ey, angle)}
                      {el.doubleHead && arrowHead(sx, sy, angle + Math.PI)}
                    </svg>
                    <div className="absolute inset-0" style={{ cursor: 'move' }} onMouseDown={(e) => onMouseDownEl(e, el)} onClick={(e) => handleSelect(el.id, e)} />
                    {isSelected && (
                      <>
                        <div className="absolute w-4 h-4 bg-teal-500 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2 cursor-grab z-20" style={{ left: sx, top: sy }} onMouseDown={(e) => onMouseDownEl(e, el)} onClick={(e) => handleSelect(el.id, e)} />
                        <div className="absolute w-4 h-4 bg-teal-500 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2 cursor-grab z-20" style={{ left: ex, top: ey }} onMouseDown={(e) => onMouseDownEl(e, el)} onClick={(e) => handleSelect(el.id, e)} />
                      </>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={el.id}
                  className={`absolute ${isSelected && el.type !== 'field' ? 'ring-2 ring-teal-500' : ''}`}
                  style={{ left: el.x, top: el.y, width: el.type === 'field' ? canvasSize.w : el.w, height: el.type === 'field' ? canvasSize.h : el.h, transform: el.type !== 'field' ? `rotate(${el.rotation || 0}deg) scaleX(${el.flipH ? -1 : 1})` : undefined, opacity: el.opacity, zIndex: el.zIndex, cursor: el.type === 'field' ? 'default' : 'move' }}
                  onMouseDown={(e) => onMouseDownEl(e, el)}
                  onClick={(e) => handleSelect(el.id, e)}
                  onDoubleClick={(e) => { if (el.type === 'text') { e.stopPropagation(); setEditingTextId(el.id); } }}
                >
                  {el.type === 'field' && <img src={el.src} alt="" className="w-full h-full object-cover pointer-events-none" draggable={false} />}
                  {el.type === 'object' && <img src={el.src} alt="" className="w-full h-full object-contain pointer-events-none" draggable={false} style={{ border: 'none', background: 'transparent' }} />}
                  {el.type === 'image' && <img src={el.src} alt="" className="w-full h-full object-contain pointer-events-none" draggable={false} style={{ border: 'none', background: 'transparent' }} />}
                  {el.type === 'rect' && (
                    <div className="w-full h-full" style={{
                      ...(el.fillType === 'striped' ? stripedStyle(el.fill !== 'transparent' ? el.fill : el.stroke, el.fillOpacity) :
                        el.fillType === 'solid' ? { backgroundColor: el.fill } : { backgroundColor: 'transparent' }),
                      border: `${el.strokeWidth}px ${el.strokeStyle === 'dashed' ? 'dashed' : 'solid'} ${el.stroke}`,
                    }} />
                  )}
                  {el.type === 'circle' && (
                    <div className="w-full h-full rounded-full" style={{
                      ...(el.fillType === 'striped' ? stripedStyle(el.fill !== 'transparent' ? el.fill : el.stroke, el.fillOpacity) :
                        el.fillType === 'solid' ? { backgroundColor: el.fill } : { backgroundColor: 'transparent' }),
                      border: `${el.strokeWidth}px ${el.strokeStyle === 'dashed' ? 'dashed' : 'solid'} ${el.stroke}`,
                    }} />
                  )}
                  {el.type === 'triangle' && (
                    <div className="w-full h-full" style={{ position: 'relative' }}>
                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <polygon points="50,5 95,95 5,95" fill={el.fillType === 'solid' ? el.fill : el.fillType === 'striped' ? (el.fill !== 'transparent' ? el.fill : el.stroke) : 'none'} fillOpacity={el.fillType === 'striped' ? (el.fillOpacity ?? 0.2) : el.fillType === 'solid' ? 1 : 0} stroke={el.stroke} strokeWidth={Math.max(1, el.strokeWidth / Math.max(el.w, el.h) * 100)} strokeDasharray={el.strokeStyle === 'dashed' ? '8 6' : undefined} />
                      </svg>
                      {el.fillType === 'striped' && (
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <defs>
                            <clipPath id={'tri-clip-' + el.id}>
                              <polygon points="50,5 95,95 5,95" />
                            </clipPath>
                          </defs>
                          <rect x="0" y="0" width="100" height="100" clipPath={'url(#tri-clip-' + el.id + ')'} fill={'url(#stripe-' + el.id + ')'} />
                          <pattern id={'stripe-' + el.id} patternUnits="userSpaceOnUse" width="28.28" height="28.28" patternTransform="rotate(45)">
                            <rect width="28.28" height="28.28" fill="transparent" />
                            <line x1="0" y1="0" x2="0" y2="28.28" stroke={el.fill !== 'transparent' ? el.fill : el.stroke} strokeWidth="10" opacity={el.fillOpacity ?? 0.2} />
                            <line x1="14.14" y1="0" x2="14.14" y2="28.28" stroke={el.fill !== 'transparent' ? el.fill : el.stroke} strokeWidth="10" opacity={(el.fillOpacity ?? 0.2) * 0.5} />
                          </pattern>
                        </svg>
                      )}
                    </div>
                  )}
                  {el.type === 'text' && (
                    editingTextId === el.id ? (
                      <textarea autoFocus className="w-full h-full outline-none resize-none bg-transparent border-0" style={{ fontSize: el.fontSize, color: el.color, fontWeight: el.fontWeight, lineHeight: 1.2, padding: el.padding || 4, textAlign: el.textAlign || 'left' }} value={el.text} onChange={(e) => updateSelected({ text: e.target.value })} onBlur={() => setEditingTextId(null)} onMouseDown={(e) => e.stopPropagation()} />
                    ) : (
                      <div className="w-full h-full flex items-center pointer-events-none" style={{
                        fontSize: el.fontSize, color: el.color, fontWeight: el.fontWeight, lineHeight: 1.2,
                        backgroundColor: el.bgColor || 'transparent', padding: el.padding || 4,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word', textAlign: el.textAlign || 'left',
                        justifyContent: el.textAlign === 'center' ? 'center' : el.textAlign === 'right' ? 'flex-end' : 'flex-start',
                        ...(el.noStroke ? {} : { border: `${el.strokeWidth}px solid ${el.stroke}`, borderRadius: 4 }),
                      }}>
                        {el.text}
                      </div>
                    )
                  )}
                  {el.type === 'number' && (
                    <div className="w-full h-full rounded-full flex items-center justify-center pointer-events-none" style={{
                      ...(el.bgColor !== 'transparent' ? { backgroundColor: el.bgColor } : {}),
                      ...(el.noStroke ? {} : { border: `${el.strokeWidth}px solid ${el.stroke}` }),
                    }}>
                      <span style={{ fontSize: el.fontSize, color: el.numberColor, fontWeight: el.fontWeight, lineHeight: 1 }}>
                        {el.number}
                      </span>
                    </div>
                  )}

                  {isSelected && el.type !== 'field' && el.type !== 'arrow' && (
                    <>
                      <div className="absolute inset-0" style={{ transform: `rotate(${-(el.rotation || 0)}deg)`, transformOrigin: 'center center' }}>
                        {['nw','ne','sw','se'].map(h => (
                          <div key={h} className="absolute w-3 h-3 bg-teal-500 border border-white rounded-full z-20" style={{ top: h.includes('n') ? -6 : 'auto', bottom: h.includes('s') ? -6 : 'auto', left: h.includes('w') ? -6 : 'auto', right: h.includes('e') ? -6 : 'auto', cursor: h === 'nw' || h === 'se' ? 'nwse-resize' : 'nesw-resize' }} onMouseDown={(e) => onMouseDownResize(e, h)} />
                        ))}
                        <div className="absolute left-1/2 -translate-x-1/2 -top-5 w-4 h-4 bg-amber-500 border border-white rounded-full cursor-grab z-20 flex items-center justify-center" onMouseDown={onMouseDownRotate}>
                          <RotateCw size={10} className="text-white" />
                        </div>
                        <div className="absolute left-1/2 -translate-x-1/2 -top-5 w-0.5 h-4 bg-amber-500 -z-10" />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
            {selectBox && (
              <div
                className="absolute border border-teal-400 bg-teal-400/10 pointer-events-none"
                style={{
                  left: Math.min(selectBox.startX, selectBox.currentX),
                  top: Math.min(selectBox.startY, selectBox.currentY),
                  width: Math.abs(selectBox.currentX - selectBox.startX),
                  height: Math.abs(selectBox.currentY - selectBox.startY),
                  zIndex: 9999,
                }}
              />
            )}
          </div>
        </div>

        <div className="w-64 bg-slate-800 rounded-xl border border-slate-700 flex flex-col overflow-hidden shrink-0">
          <div className="px-4 py-3 border-b border-slate-700 font-medium text-sm text-slate-200">
            {selectedEls.length > 1 ? `${selectedEls.length} seleccionados` : 'Propiedades'}
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {selectedEls.length === 0 && <div className="text-xs text-slate-500 text-center py-4">Selecciona un elemento</div>}

            {selectedEls.length > 1 && (
              <>
                <div className="flex gap-2">
                  <button onClick={alignHorizontal} className="flex-1 p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg flex items-center justify-center gap-1 transition-colors" title="Alinear horizontalmente"><AlignHorizontalSpaceAround size={14} className="text-slate-300" /></button>
                  <button onClick={alignVertical} className="flex-1 p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg flex items-center justify-center gap-1 transition-colors" title="Alinear verticalmente"><AlignVerticalSpaceAround size={14} className="text-slate-300" /></button>
                </div>
                <div className="flex gap-2">
                  <button onClick={bringForward} className="flex-1 p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors" title="Traer al frente"><ChevronUp size={14} className="mx-auto text-slate-300" /></button>
                  <button onClick={sendBackward} className="flex-1 p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors" title="Enviar atrás"><ChevronDown size={14} className="mx-auto text-slate-300" /></button>
                  <button onClick={deleteSelected} className="flex-1 p-2 bg-red-900/30 hover:bg-red-900/50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={14} className="mx-auto text-red-400" /></button>
                </div>
              </>
            )}

            {selectedEls.length === 1 && primarySelected && primarySelected.type !== 'field' && (
              <>
                <div className="flex gap-2">
                  <button onClick={bringForward} className="flex-1 p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors" title="Traer al frente"><ChevronUp size={14} className="mx-auto text-slate-300" /></button>
                  <button onClick={sendBackward} className="flex-1 p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors" title="Enviar atrás"><ChevronDown size={14} className="mx-auto text-slate-300" /></button>
                  <button onClick={deleteSelected} className="flex-1 p-2 bg-red-900/30 hover:bg-red-900/50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={14} className="mx-auto text-red-400" /></button>
                </div>

                {primarySelected.type !== 'arrow' && primarySelected.type !== 'number' && primarySelected.type !== 'text' && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Tamaño</label>
                    <input type="number" min="10" value={Math.round(primarySelected.w)} onChange={e => { const newW = Math.max(10, Number(e.target.value)); const ratio = primarySelected.h / primarySelected.w; updateSelected({ w: newW, h: Math.round(newW * ratio) }); }} className="w-full px-2.5 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-teal-500/50" />
                  </div>
                )}

                <button onClick={duplicateSelected} className="w-full px-3 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-xs text-slate-200 flex items-center justify-center gap-2 transition-colors"><Square size={13} /> Duplicar</button>

                {primarySelected.type !== 'arrow' && (
                  <>
                    <div className="pt-2">
                      <label className="block text-xs text-slate-400 mb-1.5">Rotación ({Math.round(primarySelected.rotation || 0)}°)</label>
                      <input type="range" min="-180" max="180" value={primarySelected.rotation || 0} onChange={e => updateSelected({ rotation: Number(e.target.value) })} className="w-full accent-teal-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Opacidad</label>
                      <input type="range" min="0.1" max="1" step="0.05" value={primarySelected.opacity ?? 1} onChange={e => updateSelected({ opacity: Number(e.target.value) })} className="w-full accent-teal-500" />
                    </div>
                  </>
                )}

                {(primarySelected.type === 'rect' || primarySelected.type === 'circle' || primarySelected.type === 'triangle') && (
                  <>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Borde</label>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={primarySelected.stroke} onChange={e => updateSelected({ stroke: e.target.value })} className="w-9 h-9 rounded-lg cursor-pointer shrink-0 border-0 bg-transparent" />
                        <input type="number" min="1" max="20" value={primarySelected.strokeWidth} onChange={e => updateSelected({ strokeWidth: Number(e.target.value) })} className="w-14 px-2 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-xs text-slate-100 text-center focus:outline-none focus:border-teal-500/50" />
                        <div className="flex gap-1.5 flex-1">
                          {['solid','dashed'].map(ss => (
                            <button key={ss} onClick={() => updateSelected({ strokeStyle: ss })} className={`flex-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${primarySelected.strokeStyle === ss ? 'bg-teal-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'}`}>{ss === 'solid' ? '─' : '┅'}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Relleno</label>
                      <div className="flex gap-1.5 mb-2">
                        {['transparent','solid','striped'].map(ft => (
                          <button key={ft} onClick={() => updateSelected({ fillType: ft })} className={`flex-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${primarySelected.fillType === ft ? 'bg-teal-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'}`}>{ft === 'transparent' ? 'Vacío' : ft === 'solid' ? 'Sólido' : 'Rayado'}</button>
                        ))}
                      </div>
                      {primarySelected.fillType === 'solid' && (
                        <input type="color" value={primarySelected.fill === 'transparent' ? '#000000' : primarySelected.fill} onChange={e => updateSelected({ fill: e.target.value })} className="w-full h-9 rounded-lg cursor-pointer border-0 bg-transparent" />
                      )}
                      {primarySelected.fillType === 'striped' && (
                        <>
                          <input type="color" value={primarySelected.fill === 'transparent' ? primarySelected.stroke : primarySelected.fill} onChange={e => updateSelected({ fill: e.target.value })} className="w-full h-9 rounded-lg cursor-pointer mb-2 border-0 bg-transparent" />
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-1">Opacidad ({Math.round((primarySelected.fillOpacity ?? 0.2) * 100)}%)</label>
                            <input type="range" min="0.05" max="1" step="0.05" value={primarySelected.fillOpacity ?? 0.2} onChange={e => updateSelected({ fillOpacity: Number(e.target.value) })} className="w-full accent-teal-500" />
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}

                {primarySelected.type === 'arrow' && (
                  <>
                    <div className="border-t border-slate-700/50 pt-3 mt-1">
                      <label className="block text-xs text-slate-400 mb-1.5">Línea</label>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={primarySelected.stroke} onChange={e => updateSelected({ stroke: e.target.value })} className="w-9 h-9 rounded-lg cursor-pointer shrink-0 border-0 bg-transparent" />
                        <input type="number" min="1" max="20" value={primarySelected.strokeWidth} onChange={e => updateSelected({ strokeWidth: Number(e.target.value) })} className="w-14 px-2 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-xs text-slate-100 text-center focus:outline-none focus:border-teal-500/50" />
                        <div className="flex gap-1.5 flex-1">
                          {['solid','dashed'].map(ss => (
                            <button key={ss} onClick={() => updateSelected({ strokeStyle: ss })} className={`flex-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${primarySelected.strokeStyle === ss ? 'bg-teal-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'}`}>{ss === 'solid' ? '─' : '┅'}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Punta</label>
                      <div className="flex gap-1.5 mb-2">
                        {['standard','round'].map(hs => (
                          <button key={hs} onClick={() => updateSelected({ headStyle: hs })} className={`flex-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${primarySelected.headStyle === hs ? 'bg-teal-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'}`}>{hs === 'standard' ? 'Triangular' : 'Redonda'}</button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateSelected({ doubleHead: !primarySelected.doubleHead })} className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors ${primarySelected.doubleHead ? 'bg-teal-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'}`}>{primarySelected.doubleHead ? 'Doble' : 'Simple'}</button>
                        <label className="text-[10px] text-slate-500">Tamaño ({primarySelected.headSize || 4})</label>
                      </div>
                      <input type="range" min="1" max="6" value={primarySelected.headSize || 4} onChange={e => updateSelected({ headSize: Number(e.target.value) })} className="w-full mt-1.5 accent-teal-500" />
                    </div>
                  </>
                )}

                {primarySelected.type === 'text' && (
                  <>
                    <button onClick={() => setEditingTextId(primarySelected.id)} className="w-full px-3 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-xs text-white flex items-center justify-center gap-2 transition-colors"><Type size={13} /> Editar texto</button>
                    <div className="flex gap-2 items-center">
                      <label className="text-xs text-slate-400 shrink-0 w-10">Color</label>
                      <input type="color" value={primarySelected.color} onChange={e => updateSelected({ color: e.target.value })} className="w-9 h-9 rounded-lg cursor-pointer shrink-0 border-0 bg-transparent" />
                      <input type="number" min="8" max="120" value={primarySelected.fontSize} onChange={e => updateSelected({ fontSize: Number(e.target.value) })} className="w-14 px-2 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-xs text-slate-100 text-center focus:outline-none focus:border-teal-500/50" />
                      <select value={primarySelected.fontWeight} onChange={e => updateSelected({ fontWeight: e.target.value })} className="flex-1 px-2 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-teal-500/50"><option value="normal">Normal</option><option value="bold">Negrita</option></select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Tamaño caja ({Math.round(primarySelected.w)}x{Math.round(primarySelected.h)})</label>
                      <input type="range" min="20" max="300" value={Math.round(primarySelected.w)} onChange={e => { const newW = Number(e.target.value); const ratio = newW / primarySelected.w; updateSelected({ w: newW, h: Math.round(primarySelected.h * ratio) }); }} className="w-full accent-teal-500" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="text-xs text-slate-400 shrink-0 w-10">Fondo</label>
                      <input type="color" value={primarySelected.bgColor === 'transparent' ? '#000000' : primarySelected.bgColor} onChange={e => updateSelected({ bgColor: e.target.value })} className="w-9 h-9 rounded-lg cursor-pointer shrink-0 border-0 bg-transparent" />
                      <button onClick={() => updateSelected({ bgColor: 'transparent' })} className={`flex-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${primarySelected.bgColor === 'transparent' ? 'bg-teal-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'}`}>Sin fondo</button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="text-xs text-slate-400 shrink-0 w-10">Borde</label>
                      <input type="color" value={primarySelected.stroke} onChange={e => updateSelected({ stroke: e.target.value })} className="w-9 h-9 rounded-lg cursor-pointer shrink-0 border-0 bg-transparent" />
                      <input type="number" min="0" max="20" value={primarySelected.strokeWidth} onChange={e => updateSelected({ strokeWidth: Number(e.target.value) })} className="w-14 px-2 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-xs text-slate-100 text-center focus:outline-none focus:border-teal-500/50" />
                      <button onClick={() => updateSelected({ noStroke: !primarySelected.noStroke })} className={`flex-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${primarySelected.noStroke ? 'bg-teal-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'}`}>{primarySelected.noStroke ? 'Con borde' : 'Sin borde'}</button>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Alineación</label>
                      <div className="flex gap-1.5">
                        {['left','center','right'].map(ta => {
                          const isActive = primarySelected.textAlign === ta || (!primarySelected.textAlign && ta === 'left');
                          return (
                            <button key={ta} onClick={() => updateSelected({ textAlign: ta })} className={`flex-1 px-2 py-2 rounded-lg text-xs transition-colors ${isActive ? 'bg-teal-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'}`}>
                              {ta === 'left' ? <AlignLeft size={14} className="mx-auto" /> : ta === 'center' ? <AlignCenter size={14} className="mx-auto" /> : <AlignRight size={14} className="mx-auto" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {primarySelected.type === 'number' && (
                  <>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400 shrink-0 w-8">Nº</label>
                      <button onClick={() => updateSelected({ number: Math.max(1, (primarySelected.number || 1) - 1) })} className="w-10 h-10 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-lg text-slate-200 flex items-center justify-center transition-colors">-</button>
                      <input type="number" min="1" value={primarySelected.number || 1} onChange={e => updateSelected({ number: Math.max(1, Number(e.target.value)) })} className="w-14 h-10 px-1 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-slate-100 text-center focus:outline-none focus:border-teal-500/50" />
                      <button onClick={() => updateSelected({ number: (primarySelected.number || 1) + 1 })} className="w-10 h-10 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-lg text-slate-200 flex items-center justify-center transition-colors">+</button>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Tamaño ({Math.round(primarySelected.w)}px)</label>
                      <input type="range" min="20" max="200" value={Math.round(primarySelected.w)} onChange={e => { const newSize = Number(e.target.value); const ratio = newSize / primarySelected.w; updateSelected({ w: newSize, h: newSize, fontSize: Math.round(primarySelected.fontSize * ratio) }); }} className="w-full accent-teal-500" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="text-xs text-slate-400 shrink-0 w-14">Color nº</label>
                      <input type="color" value={primarySelected.numberColor} onChange={e => updateSelected({ numberColor: e.target.value })} className="w-9 h-9 rounded-lg cursor-pointer border-0 bg-transparent" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="text-xs text-slate-400 shrink-0 w-14">Borde</label>
                      <input type="color" value={primarySelected.stroke} onChange={e => updateSelected({ stroke: e.target.value })} className="w-9 h-9 rounded-lg cursor-pointer shrink-0 border-0 bg-transparent" />
                      <input type="number" min="0" max="20" value={primarySelected.strokeWidth} onChange={e => updateSelected({ strokeWidth: Number(e.target.value) })} className="w-14 px-2 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-xs text-slate-100 text-center focus:outline-none focus:border-teal-500/50" />
                      <button onClick={() => updateSelected({ noStroke: !primarySelected.noStroke })} className={`flex-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${primarySelected.noStroke ? 'bg-teal-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'}`}>{primarySelected.noStroke ? 'Con borde' : 'Sin borde'}</button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="text-xs text-slate-400 shrink-0 w-14">Fondo</label>
                      <input type="color" value={primarySelected.bgColor === 'transparent' ? '#ffffff' : primarySelected.bgColor} onChange={e => updateSelected({ bgColor: e.target.value })} className="w-9 h-9 rounded-lg cursor-pointer border-0 bg-transparent" />
                      <button onClick={() => updateSelected({ bgColor: 'transparent' })} className={`flex-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${primarySelected.bgColor === 'transparent' ? 'bg-teal-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'}`}>Sin fondo</button>
                    </div>
                  </>
                )}

                {(primarySelected.type === 'rect' || primarySelected.type === 'circle' || primarySelected.type === 'triangle') && (
                  <div className="border-t border-slate-700/50 pt-3 mt-1">
                    <label className="block text-xs text-slate-400 mb-2">Presets</label>
                    {(shapePresets[primarySelected.type] || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(shapePresets[primarySelected.type] || []).map(p => (
                          <div key={p.id} className="flex items-center gap-1">
                            <button onClick={() => loadShapePreset(p)} className="px-2 py-1 bg-slate-700/50 hover:bg-slate-700 rounded-md text-xs text-slate-200 truncate max-w-[80px] transition-colors" title={p.name}>{p.name}</button>
                            <button onClick={() => deleteShapePreset(p.id)} className="text-red-400 hover:text-red-300 text-xs transition-colors">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {showPresetName ? (
                      <div className="flex gap-1.5">
                        <input type="text" value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="Nombre" className="flex-1 px-2.5 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-teal-500/50" autoFocus onKeyDown={e => { if (e.key === 'Enter') saveShapePreset(); if (e.key === 'Escape') { setShowPresetName(false); setPresetName(''); } }} />
                        <button onClick={saveShapePreset} className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-xs text-white transition-colors"><Save size={12} /></button>
                        <button onClick={() => { setShowPresetName(false); setPresetName(''); }} className="px-2.5 py-1.5 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-xs text-slate-300 transition-colors">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowPresetName(true)} className="w-full px-3 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-xs text-slate-200 flex items-center justify-center gap-2 transition-colors"><Star size={12} /> Guardar preset</button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

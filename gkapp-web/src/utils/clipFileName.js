export function sanitizeFileName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

export function buildClipFileName(displayId, category, ext = 'mp4') {
  const base = [sanitizeFileName(displayId), sanitizeFileName(category)]
    .filter(Boolean)
    .join('_')
    .replace(/^_+|_+$/g, '');
  const extension = String(ext || 'mp4').replace(/^\./, '').toLowerCase();
  return base ? `${base}.${extension}` : `clip.${extension}`;
}

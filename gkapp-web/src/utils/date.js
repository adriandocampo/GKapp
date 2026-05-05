export function formatDateDDMMYY(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

/** Normalize any date-like value to timestamp ms */
export function getTimestampMs(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  if (typeof value === 'number') return value;
  if (value.toDate && typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }
  return 0;
}

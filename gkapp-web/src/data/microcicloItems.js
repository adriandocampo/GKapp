export const MICROCICLO_DIMENSIONS = [
  {
    id: 'defensa-porteria',
    name: 'DEFENSA DE PORTERÍA',
    situations: [
      'TIRO CERCANO',
      'TIRO LEJANO',
      '1C1',
      'REMATE TRAS CENTRO',
      'DESPLAZAMIENTO + POS. BÁSICA',
    ],
    categories: [
      'AGARRES',
      'DESVÍOS',
      'UBICACIÓN-REUBICACIÓN',
      'INCORPORACIÓN',
      'IMPULSO',
      'REDUCCIÓN DE ESPACIOS',
      'EQUILIBRIO CORPORAL',
      'COOPERACIÓN CON DEFENSOR',
    ],
  },
  {
    id: 'defensa-espacio',
    name: 'DEFENSA DE ESPACIO',
    situations: [
      'CENTRO LATERAL',
      'CENTRO LATERAL CERCANO',
      'ALTURA EN RELACIÓN CON DEF',
      'PASE AL ESPACIO',
    ],
    categories: [
      'AGARRE AÉREO',
      'DESPEJE DE PUÑOS',
      'PROLONGACIÓN',
      'ENTRADA ESPECÍFICA',
      'COBERTURAS',
      'SIT. CORTAR CENTRO',
      'POSICIONAMIENTO DE ALERTA',
      'PERCIBIR/IDENTIFICAR RIVAL',
      'COMUNICACIÓN DE AMENAZAS',
    ],
  },
  {
    id: 'juego-ofensivo',
    name: 'JUEGO OFENSIVO',
    situations: [
      'REINICIOS',
      'INICIOS',
      'CONTINUIDAD DEL JUEGO',
      'PROFUNDIDAD EN EL JUEGO',
      'INTERPRETACIÓN DEL JUEGO',
    ],
    categories: [
      'PASE DE PIE CORTO',
      'PASE DE PIE LARGO',
      'SAQUE DE MANO',
      'SAQUE DE VOLEA',
      'JUEGO A 1 TOQUE',
      'APOYO/ORIENTACIÓN',
    ],
  },
  {
    id: 'fisico',
    name: 'FÍSICO',
    situations: [
      'VELOCIDAD DE REACCIÓN',
      'VELOCIDAD GESTUAL',
      'FUERZA GENERAL',
      'FUERZA EXPLOSIVA',
      'FUERZA RESISTENCIA',
      'FUERZA VELOCIDAD',
    ],
    categories: [
      'T-TEST',
      'VELOCIDAD - 15M',
    ],
  },
];

export const FISICO_TIPOS = [
  'FUERZA RESISTENCIA',
  'FUERZA EXPLOSIVA',
  'FUERZA GENERAL',
  'FUERZA VELOCIDAD',
  'VELOCIDAD DE REACCIÓN',
  'VELOCIDAD GESTUAL',
  'T-TEST',
  'VELOCIDAD - 15M',
];

export const DIM_ABBREV = {
  'DEFENSA DE PORTERÍA': 'DP',
  'DEFENSA DE ESPACIO': 'DE',
  'JUEGO OFENSIVO': 'JO',
  'FÍSICO': 'F',
  'Defensa de portería': 'DP',
  'Defensa de espacio': 'DE',
  'Juego ofensivo': 'JO',
  'Físico': 'F',
};

export const DIAS_NOMBRES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const DIAS_ABREV = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
export const DIAS_LETRA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function getInclusiveDayCount(dateStart, dateEnd) {
  if (!dateStart || !dateEnd) return 0;
  const start = new Date(`${dateStart}T00:00:00Z`);
  const end = new Date(`${dateEnd}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

export function isValidMicrocycleRange(dateStart, dateEnd) {
  const days = getInclusiveDayCount(dateStart, dateEnd);
  return days >= 3 && days <= 14;
}

function parseLocalDate(dateString) {
  const [year, month, day] = String(dateString || '').split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatLocalDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getDimensionById(id) {
  return MICROCICLO_DIMENSIONS.find(d => d.id === id);
}

export function generateDays(dateStart, dateEnd) {
  const start = parseLocalDate(dateStart);
  const end = parseLocalDate(dateEnd);
  const days = [];
  let current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    days.push({
      dayName: DIAS_NOMBRES[adjustedDay],
      date: formatLocalDate(current),
      dayIndex: days.length,
      isRestDay: false,
      foco1: '', foco2: '',
      objetivo1: '', objetivo2: '', objetivo3: '',
      grid: {
        dimension: [],
        situacion: [],
        categoria: [],
        fisico: { tipo: '', repes: '', tt: '', rpe: '', customFields: [] },
      },
      match: { hasMatch: false, jornada: '', rival: '', location: 'home', hora: '' },
      sessionId: null,
    });
    current.setDate(current.getDate() + 1);
  }
  return days;
}

export function createDefaultDay() {
  return {
    dayName: '', date: '', dayIndex: 0,
    isRestDay: false,
    foco1: '', foco2: '',
    objetivo1: '', objetivo2: '', objetivo3: '',
    grid: {
      dimension: [],
      situacion: [],
      categoria: [],
      fisico: { tipo: '', repes: '', tt: '', rpe: '', customFields: [] },
    },
    match: { hasMatch: false, jornada: '', rival: '', location: 'home', hora: '' },
    sessionId: null,
  };
}

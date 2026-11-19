export type ExpenseCategory =
  | 'Alimentación'
  | 'Transporte'
  | 'Servicios públicos'
  | 'Ropa y compras personales'
  | 'Entretenimiento y ocio';

export type IncomeCategory =
  | 'Salario'
  | 'Trabajo independiente'
  | 'Negocio'
  | 'Inversiones'
  | 'Regalo'
  | 'Bonificación'
  | 'Reembolso'
  | 'Otro';

export type PaymentMethod =
  | 'Efectivo'
  | 'Cuenta bancaria'
  | 'Nequi'
  | 'Daviplata'
  | 'Tarjeta'
  | 'Otro';

export interface ExpenseRecord {
  id: string;
  kind?: 'expense';
  day: number;
  dateLabel: string;
  fullDateLabel: string;
  timeLabel: string;
  category: ExpenseCategory;
  concept: string;
  notes?: string;
  amount: number;
  createdAt?: number;
}

export interface IncomeRecord {
  id: string;
  kind: 'income';
  day: number;
  isoDate: string;
  dateLabel: string;
  fullDateLabel: string;
  timeLabel: string;
  category: IncomeCategory;
  concept: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  amount: number;
  createdAt: number;
}

export type MovementRecord =
  | (ExpenseRecord & { kind: 'expense' })
  | IncomeRecord;

export interface MonthlyBudgetDataset {
  id: string;
  monthLabel: string;
  year: number;
  totalDays: number;
  currentDay: number;
  monthlyBudget: number;
  expenses: ExpenseRecord[];
  incomes: IncomeRecord[];
}

export interface CategoryMeta {
  label: ExpenseCategory;
  shortLabel: string;
  accentColor: string;
  iconBgClass: string;
  iconTextClass: string;
  barColorClass: string;
}

export const CATEGORY_LIST: ExpenseCategory[] = [
  'Alimentación',
  'Transporte',
  'Servicios públicos',
  'Ropa y compras personales',
  'Entretenimiento y ocio',
];

export const INCOME_CATEGORIES: IncomeCategory[] = [
  'Salario',
  'Trabajo independiente',
  'Negocio',
  'Inversiones',
  'Regalo',
  'Bonificación',
  'Reembolso',
  'Otro',
];

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Efectivo',
  'Cuenta bancaria',
  'Nequi',
  'Daviplata',
  'Tarjeta',
  'Otro',
];

export const CATEGORY_META: Record<ExpenseCategory, CategoryMeta> = {
  'Alimentación': {
    label: 'Alimentación',
    shortLabel: 'Alimentación',
    accentColor: '#D97706',
    iconBgClass: 'bg-amber-50',
    iconTextClass: 'text-amber-700',
    barColorClass: 'bg-amber-500',
  },
  'Transporte': {
    label: 'Transporte',
    shortLabel: 'Transporte',
    accentColor: '#2563EB',
    iconBgClass: 'bg-blue-50',
    iconTextClass: 'text-blue-700',
    barColorClass: 'bg-blue-600',
  },
  'Servicios públicos': {
    label: 'Servicios públicos',
    shortLabel: 'Servicios',
    accentColor: '#0D9488',
    iconBgClass: 'bg-teal-50',
    iconTextClass: 'text-teal-700',
    barColorClass: 'bg-teal-600',
  },
  'Ropa y compras personales': {
    label: 'Ropa y compras personales',
    shortLabel: 'Compras',
    accentColor: '#4F46E5',
    iconBgClass: 'bg-indigo-50',
    iconTextClass: 'text-indigo-700',
    barColorClass: 'bg-indigo-600',
  },
  'Entretenimiento y ocio': {
    label: 'Entretenimiento y ocio',
    shortLabel: 'Ocio',
    accentColor: '#E11D48',
    iconBgClass: 'bg-rose-50',
    iconTextClass: 'text-rose-700',
    barColorClass: 'bg-rose-600',
  },
};

export function formatCOP(amount: number): string {
  const isNegative = amount < 0;
  const rounded = Math.round(Math.abs(amount));
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${isNegative ? '-' : ''}$${formatted} COP`;
}

export function formatNumberDots(amount: number): string {
  const rounded = Math.round(Math.abs(amount));
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatCompactCOP(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded === 0) return '$0';
  if (rounded >= 1000000) {
    const millions = (rounded / 1000000).toFixed(1).replace('.', ',');
    return `$${millions.endsWith(',0') ? millions.slice(0, -2) : millions}M`;
  }
  if (rounded >= 1000) {
    return `$${Math.round(rounded / 1000)} mil`;
  }
  return `$${rounded}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}%`;
}

const WEEKDAYS_ES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export function buildDateLabels(
  year: number,
  monthIndexZeroBased: number,
  day: number,
  monthLabel: string
): { dateLabel: string; fullDateLabel: string } {
  const dateObj = new Date(year, monthIndexZeroBased, day);
  const weekday = WEEKDAYS_ES[dateObj.getDay()] ?? 'Día';
  const shortMonth = monthLabel.slice(0, 3).toLowerCase();
  return {
    dateLabel: `${day} ${shortMonth} ${year}`,
    fullDateLabel: `${weekday}, ${day} de ${monthLabel.toLowerCase()} de ${year}`,
  };
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatIsoDateLabels(isoDate: string): {
  day: number;
  dateLabel: string;
  fullDateLabel: string;
  isToday: boolean;
} {
  const [yStr, mStr, dStr] = isoDate.split('-');
  const year = parseInt(yStr ?? '2026', 10);
  const monthIdx = Math.max(0, Math.min(11, parseInt(mStr ?? '11', 10) - 1));
  const day = parseInt(dStr ?? '1', 10);
  const monthName = MONTHS_ES[monthIdx] ?? 'noviembre';
  const shortMonth = monthName.slice(0, 3);
  const dateObj = new Date(year, monthIdx, day);
  const weekday = WEEKDAYS_ES[dateObj.getDay()] ?? 'Día';
  const isToday = isoDate === getTodayIsoDate();

  return {
    day,
    dateLabel: isToday ? 'Hoy' : `${day} ${shortMonth} ${year}`,
    fullDateLabel: `${weekday}, ${day} de ${monthName} de ${year}`,
    isToday,
  };
}

export const MONTHLY_DATASETS: MonthlyBudgetDataset[] = [
  {
    id: '2026-11',
    monthLabel: 'Noviembre',
    year: 2026,
    totalDays: 30,
    currentDay: 17,
    monthlyBudget: 2500000,
    incomes: [],
    expenses: [],
  },
  {
    id: '2026-10',
    monthLabel: 'Octubre',
    year: 2026,
    totalDays: 31,
    currentDay: 31,
    monthlyBudget: 2500000,
    incomes: [],
    expenses: [
      {
        id: 'oct-01',
        day: 1,
        dateLabel: '1 oct 2026',
        fullDateLabel: 'Jueves, 1 de octubre de 2026',
        timeLabel: '09:30',
        category: 'Servicios públicos',
        concept: 'Internet fibra óptica hogar',
        amount: 115000,
      },
      {
        id: 'oct-02',
        day: 2,
        dateLabel: '2 oct 2026',
        fullDateLabel: 'Viernes, 2 de octubre de 2026',
        timeLabel: '18:05',
        category: 'Alimentación',
        concept: 'Mercado quincenal',
        amount: 168000,
      },
      {
        id: 'oct-03',
        day: 4,
        dateLabel: '4 oct 2026',
        fullDateLabel: 'Domingo, 4 de octubre de 2026',
        timeLabel: '14:15',
        category: 'Entretenimiento y ocio',
        concept: 'Salida a restaurante tradicional',
        amount: 96000,
      },
      {
        id: 'oct-04',
        day: 6,
        dateLabel: '6 oct 2026',
        fullDateLabel: 'Martes, 6 de octubre de 2026',
        timeLabel: '08:10',
        category: 'Transporte',
        concept: 'Recarga transporte masivo',
        amount: 45000,
      },
      {
        id: 'oct-05',
        day: 8,
        dateLabel: '8 oct 2026',
        fullDateLabel: 'Jueves, 8 de octubre de 2026',
        timeLabel: '11:00',
        category: 'Servicios públicos',
        concept: 'Factura de energía eléctrica',
        amount: 142000,
      },
      {
        id: 'oct-06',
        day: 10,
        dateLabel: '10 oct 2026',
        fullDateLabel: 'Sábado, 10 de octubre de 2026',
        timeLabel: '15:40',
        category: 'Ropa y compras personales',
        concept: 'Chaqueta impermeable',
        amount: 175000,
      },
      {
        id: 'oct-07',
        day: 12,
        dateLabel: '12 oct 2026',
        fullDateLabel: 'Lunes, 12 de octubre de 2026',
        timeLabel: '12:45',
        category: 'Alimentación',
        concept: 'Almuerzo y café de trabajo',
        amount: 28000,
      },
      {
        id: 'oct-08',
        day: 14,
        dateLabel: '14 oct 2026',
        fullDateLabel: 'Miércoles, 14 de octubre de 2026',
        timeLabel: '10:20',
        category: 'Servicios públicos',
        concept: 'Factura de acueducto y gas',
        amount: 128000,
      },
      {
        id: 'oct-09',
        day: 16,
        dateLabel: '16 oct 2026',
        fullDateLabel: 'Viernes, 16 de octubre de 2026',
        timeLabel: '17:50',
        category: 'Transporte',
        concept: 'Viajes urbanos de la semana',
        amount: 34000,
      },
      {
        id: 'oct-10',
        day: 18,
        dateLabel: '18 oct 2026',
        fullDateLabel: 'Domingo, 18 de octubre de 2026',
        timeLabel: '11:30',
        category: 'Alimentación',
        concept: 'Mercado de frutas y carnes',
        amount: 154000,
      },
      {
        id: 'oct-11',
        day: 20,
        dateLabel: '20 oct 2026',
        fullDateLabel: 'Martes, 20 de octubre de 2026',
        timeLabel: '09:15',
        category: 'Servicios públicos',
        concept: 'Plan de telefonía celular',
        amount: 55000,
      },
      {
        id: 'oct-12',
        day: 22,
        dateLabel: '22 oct 2026',
        fullDateLabel: 'Jueves, 22 de octubre de 2026',
        timeLabel: '18:35',
        category: 'Ropa y compras personales',
        concept: 'Productos de farmacia y aseo',
        amount: 62000,
      },
      {
        id: 'oct-13',
        day: 24,
        dateLabel: '24 oct 2026',
        fullDateLabel: 'Sábado, 24 de octubre de 2026',
        timeLabel: '19:45',
        category: 'Entretenimiento y ocio',
        concept: 'Teatro y cena ligera',
        amount: 112000,
      },
      {
        id: 'oct-14',
        day: 26,
        dateLabel: '26 oct 2026',
        fullDateLabel: 'Lunes, 26 de octubre de 2026',
        timeLabel: '13:20',
        category: 'Alimentación',
        concept: 'Almuerzos y onces laborales',
        amount: 84000,
      },
      {
        id: 'oct-15',
        day: 27,
        dateLabel: '27 oct 2026',
        fullDateLabel: 'Martes, 27 de octubre de 2026',
        timeLabel: '07:45',
        category: 'Transporte',
        concept: 'Recarga transporte masivo',
        amount: 36000,
      },
      {
        id: 'oct-16',
        day: 28,
        dateLabel: '28 oct 2026',
        fullDateLabel: 'Miércoles, 28 de octubre de 2026',
        timeLabel: '18:55',
        category: 'Alimentación',
        concept: 'Compra de despensa',
        amount: 145000,
      },
      {
        id: 'oct-17',
        day: 29,
        dateLabel: '29 oct 2026',
        fullDateLabel: 'Jueves, 29 de octubre de 2026',
        timeLabel: '16:10',
        category: 'Ropa y compras personales',
        concept: 'Libro y útiles de escritorio',
        amount: 58000,
      },
      {
        id: 'oct-18',
        day: 30,
        dateLabel: '30 oct 2026',
        fullDateLabel: 'Viernes, 30 de octubre de 2026',
        timeLabel: '08:25',
        category: 'Transporte',
        concept: 'Traslado al trabajo',
        amount: 19000,
      },
      {
        id: 'oct-19',
        day: 31,
        dateLabel: '31 oct 2026',
        fullDateLabel: 'Sábado, 31 de octubre de 2026',
        timeLabel: '20:10',
        category: 'Entretenimiento y ocio',
        concept: 'Salón de juegos y café',
        amount: 72000,
      },
    ],
  },
];

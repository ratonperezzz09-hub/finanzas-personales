import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Landmark,
  Pencil,
  Tag,
  Trash2,
} from 'lucide-react';
import {
  formatCOP,
  formatPercent,
  type ExpenseCategory,
  type ExpenseRecord,
  type MovementRecord,
} from '../data/budgetData';
import { CategoryIcon } from './CategoryIcon';

interface ExpenseDetailScreenProps {
  movement: MovementRecord | null;
  effectiveBudget: number;
  monthLabel: string;
  onBack: () => void;
  backLabel: string;
  onEditExpense?: (expense: ExpenseRecord & { kind: 'expense' }) => void;
  onDeleteExpense?: (expense: ExpenseRecord & { kind: 'expense' }) => void;
}

const EXPENSE_BADGE_STYLES: Record<ExpenseCategory, string> = {
  'Alimentación': 'bg-amber-100/90 text-amber-800',
  'Transporte': 'bg-sky-100/90 text-sky-800',
  'Servicios públicos': 'bg-emerald-100/90 text-emerald-800',
  'Ropa y compras personales': 'bg-indigo-100/90 text-indigo-800',
  'Entretenimiento y ocio': 'bg-rose-100/90 text-rose-700',
};

export function ExpenseDetailScreen({
  movement,
  effectiveBudget,
  monthLabel,
  onBack,
  backLabel,
  onEditExpense,
  onDeleteExpense,
}: ExpenseDetailScreenProps) {
  // Detalle vacío: Texto suave “Selecciona un gasto en Movimientos para ver el detalle”, sin botón.
  if (!movement) {
    return (
      <div className="max-w-2xl mx-auto">
        <section
          aria-label="Detalle vacío"
          className="card-mockup px-6 py-16 text-center"
        >
          <p className="text-sm text-slate-400">
            Selecciona un gasto en Movimientos para ver el detalle
          </p>
        </section>
      </div>
    );
  }

  const isIncome = movement.kind === 'income';
  const budgetSharePct =
    effectiveBudget > 0 ? (movement.amount / effectiveBudget) * 100 : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Top Action Bar: Volver + Editar / Eliminar para gastos */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200/90 text-sm font-semibold text-[#0B1739] hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{backLabel}</span>
        </button>

        {!isIncome && (
          <div className="flex items-center gap-2">
            {onEditExpense && (
              <button
                type="button"
                onClick={() => onEditExpense(movement)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200/90 hover:border-[#5B3DF5] text-sm font-semibold text-[#0B1739] hover:text-[#5B3DF5] transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Editar</span>
              </button>
            )}
            {onDeleteExpense && (
              <button
                type="button"
                onClick={() => onDeleteExpense(movement)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-50 border border-rose-200 hover:bg-rose-100 text-sm font-semibold text-rose-700 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Eliminar</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Detail Card */}
      <section
        aria-labelledby="detalle-movimiento-titulo"
        className="card-mockup overflow-hidden"
      >
        <div className="bg-[#0B1739] text-white p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-slate-300">
              {isIncome ? 'Detalle del ingreso' : 'Detalle del gasto'} ·{' '}
              {monthLabel}
            </span>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                isIncome
                  ? 'bg-emerald-100 text-emerald-800'
                  : EXPENSE_BADGE_STYLES[movement.category]
              }`}
            >
              {isIncome ? `Ingreso · ${movement.category}` : movement.category}
            </span>
          </div>

          <div className="mt-5 flex items-center gap-4">
            {isIncome ? (
              <div
                className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-2xl shrink-0"
                aria-hidden="true"
              >
                💰
              </div>
            ) : (
              <div className="shrink-0 [&>div]:rounded-2xl [&>div]:w-12 [&>div]:h-12">
                <CategoryIcon category={movement.category} />
              </div>
            )}

            <div className="min-w-0">
              <h1
                id="detalle-movimiento-titulo"
                className="text-lg sm:text-xl font-display font-semibold text-white truncate"
              >
                {movement.concept}
              </h1>
              <p
                className={`mt-1 text-3xl sm:text-4xl font-display font-bold tracking-tight tabular-cop ${
                  isIncome ? 'text-emerald-400' : 'text-amber-300'
                }`}
              >
                {isIncome
                  ? `+${formatCOP(movement.amount)}`
                  : formatCOP(movement.amount)}
              </p>
            </div>
          </div>
        </div>

        {/* All Data Fields */}
        <div className="p-6 sm:p-8 divide-y divide-slate-100">
          <div className="pb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5 text-sm text-slate-500">
              <Calendar
                className="w-4 h-4 text-slate-400 shrink-0"
                aria-hidden="true"
              />
              <span>Fecha</span>
            </div>
            <span className="text-sm font-semibold text-[#0B1739] text-right">
              {movement.fullDateLabel}
            </span>
          </div>

          <div className="py-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5 text-sm text-slate-500">
              <Clock
                className="w-4 h-4 text-slate-400 shrink-0"
                aria-hidden="true"
              />
              <span>Hora de registro</span>
            </div>
            <span className="text-sm font-semibold text-[#0B1739] tabular-cop text-right">
              {movement.timeLabel}
            </span>
          </div>

          <div className="py-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5 text-sm text-slate-500">
              <Tag
                className="w-4 h-4 text-slate-400 shrink-0"
                aria-hidden="true"
              />
              <span>Categoría</span>
            </div>
            <span className="text-sm font-semibold text-[#0B1739] text-right">
              {movement.category}
            </span>
          </div>

          {isIncome && (
            <div className="py-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5 text-sm text-slate-500">
                <Landmark
                  className="w-4 h-4 text-slate-400 shrink-0"
                  aria-hidden="true"
                />
                <span>Medio de pago</span>
              </div>
              <span className="text-sm font-semibold text-[#0B1739] text-right">
                {movement.paymentMethod}
              </span>
            </div>
          )}

          <div className="py-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5 text-sm text-slate-500">
              <FileText
                className="w-4 h-4 text-slate-400 shrink-0"
                aria-hidden="true"
              />
              <span>Observaciones</span>
            </div>
            <span className="text-sm text-[#0B1739] text-right max-w-xs">
              {movement.notes && movement.notes.trim().length > 0
                ? movement.notes
                : 'Sin observaciones adicionales'}
            </span>
          </div>

          <div className="pt-4 flex items-start justify-between gap-4">
            <span className="text-sm text-slate-500">
              {isIncome
                ? 'Aporte al presupuesto disponible'
                : 'Impacto en el presupuesto mensual'}
            </span>
            <span
              className={`text-sm font-semibold tabular-cop text-right ${
                isIncome ? 'text-emerald-700' : 'text-[#0B1739]'
              }`}
            >
              {isIncome ? '+' : ''}
              {formatPercent(budgetSharePct)} de {formatCOP(effectiveBudget)}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

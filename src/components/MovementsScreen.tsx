import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  CATEGORY_LIST,
  formatCOP,
  type ExpenseCategory,
  type ExpenseRecord,
  type MovementRecord,
} from '../data/budgetData';
import { CategoryIcon } from './CategoryIcon';

interface MovementsScreenProps {
  monthLabel: string;
  year: number;
  movements: MovementRecord[];
  hasExpenses: boolean;
  searchQuery: string;
  onSelectMovement: (movement: MovementRecord) => void;
  onEditExpense?: (expense: ExpenseRecord & { kind: 'expense' }) => void;
  onDeleteExpense?: (expense: ExpenseRecord & { kind: 'expense' }) => void;
  onBackToDashboard: () => void;
  onGoToRegisterExpense: () => void;
  onGoToRegisterIncome: () => void;
  onGoToEmptyDetail: () => void;
}

const EXPENSE_BADGE_STYLES: Record<ExpenseCategory, string> = {
  'Alimentación': 'bg-amber-100/90 text-amber-800',
  'Transporte': 'bg-sky-100/90 text-sky-800',
  'Servicios públicos': 'bg-emerald-100/90 text-emerald-800',
  'Ropa y compras personales': 'bg-indigo-100/90 text-indigo-800',
  'Entretenimiento y ocio': 'bg-rose-100/90 text-rose-700',
};

export function MovementsScreen({
  monthLabel,
  year,
  movements,
  hasExpenses,
  searchQuery,
  onSelectMovement,
  onEditExpense,
  onDeleteExpense,
  onBackToDashboard,
  onGoToRegisterExpense,
  onGoToRegisterIncome,
  onGoToEmptyDetail,
}: MovementsScreenProps) {
  const [kindFilter, setKindFilter] = useState<'todos' | 'gastos' | 'ingresos'>(
    'todos'
  );
  const [selectedCategory, setSelectedCategory] = useState<
    ExpenseCategory | 'Todas'
  >('Todas');

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredSorted = useMemo(() => {
    return [...movements]
      .sort((a, b) => {
        const aCreated = a.createdAt ?? 0;
        const bCreated = b.createdAt ?? 0;
        if (aCreated !== bCreated) return bCreated - aCreated;
        if (b.day !== a.day) return b.day - a.day;
        return b.timeLabel.localeCompare(a.timeLabel);
      })
      .filter((item) => {
        if (kindFilter === 'gastos' && item.kind !== 'expense') return false;
        if (kindFilter === 'ingresos' && item.kind !== 'income') return false;

        if (kindFilter !== 'ingresos' && selectedCategory !== 'Todas') {
          if (item.kind !== 'expense' || item.category !== selectedCategory) {
            return false;
          }
        }

        if (!normalizedQuery) return true;
        return (
          item.concept.toLowerCase().includes(normalizedQuery) ||
          item.category.toLowerCase().includes(normalizedQuery) ||
          item.dateLabel.toLowerCase().includes(normalizedQuery) ||
          (item.kind === 'income' && 'ingreso'.includes(normalizedQuery))
        );
      });
  }, [movements, kindFilter, selectedCategory, normalizedQuery]);

  const groupedByDay = useMemo(() => {
    const groups: {
      key: string;
      fullDateLabel: string;
      netDayTotal: number;
      items: MovementRecord[];
    }[] = [];

    for (const item of filteredSorted) {
      let existing = groups.find((g) => g.key === item.fullDateLabel);
      if (!existing) {
        existing = {
          key: item.fullDateLabel,
          fullDateLabel: item.fullDateLabel,
          netDayTotal: 0,
          items: [],
        };
        groups.push(existing);
      }
      existing.items.push(item);
      existing.netDayTotal +=
        item.kind === 'income' ? item.amount : -item.amount;
    }
    return groups;
  }, [filteredSorted]);

  return (
    <div className="space-y-6">
      {/* Screen Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0B1739] mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Volver al Dashboard</span>
          </button>
          <h1 className="text-2xl sm:text-[28px] font-display font-bold text-[#0B1739] tracking-tight">
            Movimientos de {monthLabel} {year}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 tabular-cop">
            Lista cronológica del mes · {filteredSorted.length} movimientos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {!hasExpenses && (
            <button
              type="button"
              onClick={onGoToEmptyDetail}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-white border border-slate-200/90 hover:bg-slate-50 text-slate-600 text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              Ver detalle
            </button>
          )}
          <button
            type="button"
            onClick={onGoToRegisterIncome}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            <TrendingUp className="w-4 h-4" strokeWidth={2.1} aria-hidden="true" />
            <span>Registrar ingreso</span>
          </button>
          <button
            type="button"
            onClick={onGoToRegisterExpense}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#5B3DF5] hover:bg-[#492CE0] text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
            <span>Registrar gasto</span>
          </button>
        </div>
      </div>

      {/* Empty State when no expenses exist */}
      {!hasExpenses && movements.length === 0 ? (
        <section className="card-mockup px-6 py-14 sm:py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-[#0B1739] flex items-center justify-center mx-auto mb-4">
            <ReceiptText className="w-6 h-6" strokeWidth={1.9} aria-hidden="true" />
          </div>
          <h2 className="text-xl font-display font-bold text-[#0B1739] tracking-tight">
            Tus gastos van a vivir aquí
          </h2>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
            cada vez que pagues algo, lo registras y aparece en esta lista
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={onGoToRegisterExpense}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#5B3DF5] hover:bg-[#492CE0] text-white text-sm font-semibold shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
              <span>Registrar gasto</span>
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* Type + Category Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center p-1 bg-white border border-slate-200/80 rounded-full mr-2">
              {(['todos', 'gastos', 'ingresos'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setKindFilter(tab);
                    if (tab === 'ingresos') setSelectedCategory('Todas');
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors cursor-pointer ${
                    kindFilter === tab
                      ? 'bg-[#0B1739] text-white'
                      : 'text-slate-600 hover:text-[#0B1739]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {kindFilter !== 'ingresos' && (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('Todas')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    selectedCategory === 'Todas'
                      ? 'bg-[#0B1739] text-white'
                      : 'bg-white text-slate-600 border border-slate-200/80 hover:text-[#0B1739]'
                  }`}
                >
                  Todas
                </button>
                {CATEGORY_LIST.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-[#0B1739] text-white'
                        : 'bg-white text-slate-600 border border-slate-200/80 hover:text-[#0B1739]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Chronological Groups */}
          <div className="card-mockup p-5 sm:p-7 space-y-6">
            {groupedByDay.length > 0 ? (
              groupedByDay.map((group) => (
                <section key={group.key} aria-label={group.fullDateLabel}>
                  <div className="flex items-center justify-between gap-4 pb-2.5 border-b border-slate-100">
                    <h2 className="text-xs font-semibold text-slate-500">
                      {group.fullDateLabel}
                    </h2>
                    <span
                      className={`text-xs font-semibold tabular-cop ${
                        group.netDayTotal > 0
                          ? 'text-emerald-600'
                          : 'text-[#0B1739]'
                      }`}
                    >
                      Balance del día:{' '}
                      {group.netDayTotal > 0
                        ? `+${formatCOP(group.netDayTotal)}`
                        : formatCOP(group.netDayTotal)}
                    </span>
                  </div>

                  <ul className="divide-y divide-slate-100">
                    {group.items.map((movement) => {
                      const isIncome = movement.kind === 'income';
                      return (
                        <li
                          key={movement.id}
                          className="flex items-center justify-between gap-2 py-2"
                        >
                          <button
                            type="button"
                            onClick={() => onSelectMovement(movement)}
                            className="flex-1 min-w-0 py-1.5 px-2 -mx-2 rounded-xl flex items-center justify-between gap-4 text-left hover:bg-slate-50/90 transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              {isIncome ? (
                                <div
                                  className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-base shrink-0"
                                  aria-hidden="true"
                                >
                                  💰
                                </div>
                              ) : (
                                <div className="shrink-0 [&>div]:rounded-full">
                                  <CategoryIcon
                                    category={movement.category}
                                    size="sm"
                                  />
                                </div>
                              )}

                              <div className="min-w-0">
                                <p className="text-sm font-medium text-[#0B1739] group-hover:text-[#5B3DF5] transition-colors truncate">
                                  {movement.concept}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                                      isIncome
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : EXPENSE_BADGE_STYLES[movement.category]
                                    }`}
                                  >
                                    {isIncome
                                      ? `Ingreso · ${movement.category}`
                                      : movement.category}
                                  </span>
                                  <span className="text-xs text-slate-400 tabular-cop">
                                    {movement.timeLabel}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              <span
                                className={`text-sm font-semibold tabular-cop whitespace-nowrap ${
                                  isIncome
                                    ? 'text-emerald-600'
                                    : 'text-[#0B1739]'
                                }`}
                              >
                                {isIncome
                                  ? `+${formatCOP(movement.amount)}`
                                  : formatCOP(movement.amount)}
                              </span>
                              <ChevronRight
                                className="w-4 h-4 text-slate-300 group-hover:text-[#5B3DF5] transition-colors"
                                aria-hidden="true"
                              />
                            </div>
                          </button>

                          {!isIncome && (
                            <div className="flex items-center gap-1 shrink-0 pl-1">
                              {onEditExpense && (
                                <button
                                  type="button"
                                  onClick={() => onEditExpense(movement)}
                                  aria-label={`Editar gasto ${movement.concept}`}
                                  title="Editar gasto"
                                  className="w-8 h-8 rounded-full text-slate-400 hover:text-[#5B3DF5] hover:bg-[#5B3DF5]/10 inline-flex items-center justify-center transition-colors cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              )}
                              {onDeleteExpense && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteExpense(movement)}
                                  aria-label={`Eliminar gasto ${movement.concept}`}
                                  title="Eliminar gasto"
                                  className="w-8 h-8 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            ) : (
              <div className="py-10 text-center">
                <p className="text-sm text-slate-500">
                  No hay movimientos que coincidan con el filtro actual.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

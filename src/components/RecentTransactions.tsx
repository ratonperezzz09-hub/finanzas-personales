import { ArrowRight, Pencil, Trash2 } from 'lucide-react';
import {
  formatCOP,
  type ExpenseCategory,
  type ExpenseRecord,
  type MovementRecord,
} from '../data/budgetData';
import { CategoryIcon } from './CategoryIcon';

interface RecentTransactionsProps {
  movements: MovementRecord[];
  hasExpenses: boolean;
  monthLabel: string;
  onSelectMovement: (movement: MovementRecord) => void;
  onEditExpense?: (expense: ExpenseRecord & { kind: 'expense' }) => void;
  onDeleteExpense?: (expense: ExpenseRecord & { kind: 'expense' }) => void;
  onViewAllMovements: () => void;
  searchQuery: string;
}

const EXPENSE_BADGE_STYLES: Record<ExpenseCategory, string> = {
  'Alimentación': 'bg-amber-100/90 text-amber-800',
  'Transporte': 'bg-sky-100/90 text-sky-800',
  'Servicios públicos': 'bg-emerald-100/90 text-emerald-800',
  'Ropa y compras personales': 'bg-indigo-100/90 text-indigo-800',
  'Entretenimiento y ocio': 'bg-rose-100/90 text-rose-700',
};

export function RecentTransactions({
  movements,
  hasExpenses,
  monthLabel,
  onSelectMovement,
  onEditExpense,
  onDeleteExpense,
  onViewAllMovements,
  searchQuery,
}: RecentTransactionsProps) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Sort chronologically (newest created/day/time first)
  const sortedNewestFirst = [...movements].sort((a, b) => {
    const aCreated = a.createdAt ?? 0;
    const bCreated = b.createdAt ?? 0;
    if (aCreated !== bCreated) return bCreated - aCreated;
    if (b.day !== a.day) return b.day - a.day;
    return b.timeLabel.localeCompare(a.timeLabel);
  });

  const visibleMovements = sortedNewestFirst
    .filter((item) => {
      if (!normalizedQuery) return true;
      return (
        item.concept.toLowerCase().includes(normalizedQuery) ||
        item.category.toLowerCase().includes(normalizedQuery) ||
        item.dateLabel.toLowerCase().includes(normalizedQuery) ||
        (item.kind === 'income' && 'ingreso'.includes(normalizedQuery))
      );
    })
    .slice(0, 5);

  return (
    <section
      id="movimientos-recientes"
      aria-labelledby="ultimos-movimientos-titulo"
      className="card-mockup p-6 sm:p-7"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2
            id="ultimos-movimientos-titulo"
            className="text-lg font-display font-bold text-[#0B1739] tracking-tight"
          >
            Últimos movimientos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {!hasExpenses && movements.length === 0
              ? `Movimientos de ${monthLabel}`
              : normalizedQuery
              ? `Coincidencias en ${monthLabel}`
              : `Lista corta reciente de ${monthLabel} · Haz clic para ver el detalle`}
          </p>
        </div>

        <button
          type="button"
          onClick={onViewAllMovements}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-[#0B1739] transition-colors whitespace-nowrap cursor-pointer"
        >
          <span>
            {hasExpenses || movements.length > 0
              ? `Ver todos (${movements.length})`
              : 'Ir a Movimientos'}
          </span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Empty State: Detalle vacío soft text inside dashboard when no movements yet */}
      {movements.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-slate-400">
            Selecciona un gasto en Movimientos para ver el detalle
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table Layout */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium text-slate-400">
                  <th scope="col" className="pb-3 font-medium">
                    Concepto
                  </th>
                  <th scope="col" className="pb-3 font-medium">
                    Monto
                  </th>
                  <th scope="col" className="pb-3 font-medium">
                    Fecha
                  </th>
                  <th scope="col" className="pb-3 font-medium text-right">
                    Categoría
                  </th>
                  <th scope="col" className="pb-3 font-medium text-right w-20">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleMovements.length > 0 ? (
                  visibleMovements.map((movement) => {
                    const isIncome = movement.kind === 'income';
                    return (
                      <tr
                        key={movement.id}
                        onClick={() => onSelectMovement(movement)}
                        className="group cursor-pointer transition-colors hover:bg-slate-50/90"
                      >
                        <td className="py-3.5 pr-4">
                          <div className="flex items-center gap-3.5">
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
                              <span className="text-sm font-medium text-[#0B1739] group-hover:text-[#5B3DF5] transition-colors block truncate">
                                {movement.concept}
                              </span>
                              {isIncome && (
                                <span className="text-[11px] font-medium text-emerald-700">
                                  {movement.dateLabel} • Ingreso
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td
                          className={`py-3.5 pr-4 text-sm font-semibold tabular-cop whitespace-nowrap ${
                            isIncome ? 'text-emerald-600' : 'text-[#0B1739]'
                          }`}
                        >
                          {isIncome
                            ? `+${formatCOP(movement.amount)}`
                            : formatCOP(movement.amount)}
                        </td>
                        <td className="py-3.5 pr-4 text-sm text-slate-500 tabular-cop whitespace-nowrap">
                          {movement.dateLabel}
                        </td>
                        <td className="py-3.5 text-right whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              isIncome
                                ? 'bg-emerald-100 text-emerald-800'
                                : EXPENSE_BADGE_STYLES[movement.category]
                            }`}
                          >
                            {isIncome
                              ? `Ingreso · ${movement.category}`
                              : movement.category}
                          </span>
                        </td>
                        <td className="py-3.5 pl-3 text-right whitespace-nowrap">
                          {!isIncome ? (
                            <div className="inline-flex items-center justify-end gap-1">
                              {onEditExpense && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditExpense(movement);
                                  }}
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteExpense(movement);
                                  }}
                                  aria-label={`Eliminar gasto ${movement.concept}`}
                                  title="Eliminar gasto"
                                  className="w-8 h-8 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-sm text-slate-500"
                    >
                      No se encontraron movimientos que coincidan con “{searchQuery}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Clean List Layout */}
          <ul className="sm:hidden divide-y divide-slate-100">
            {visibleMovements.length > 0 ? (
              visibleMovements.map((movement) => {
                const isIncome = movement.kind === 'income';
                return (
                  <li key={movement.id} className="py-3.5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectMovement(movement)}
                      className="flex-1 min-w-0 text-left flex items-center justify-between gap-3 transition-colors hover:bg-slate-50 rounded-xl px-2 py-1 -mx-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
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
                          <p className="text-sm font-medium text-[#0B1739] truncate">
                            {movement.concept}
                          </p>
                          <p
                            className={`text-xs mt-0.5 truncate ${
                              isIncome
                                ? 'text-emerald-700 font-medium'
                                : 'text-slate-500'
                            }`}
                          >
                            {isIncome
                              ? `${movement.dateLabel} • Ingreso`
                              : `${movement.category} · ${movement.dateLabel}`}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-sm font-semibold tabular-cop whitespace-nowrap shrink-0 ${
                          isIncome ? 'text-emerald-600' : 'text-[#0B1739]'
                        }`}
                      >
                        {isIncome
                          ? `+${formatCOP(movement.amount)}`
                          : formatCOP(movement.amount)}
                      </span>
                    </button>

                    {!isIncome && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        {onEditExpense && (
                          <button
                            type="button"
                            onClick={() => onEditExpense(movement)}
                            aria-label={`Editar gasto ${movement.concept}`}
                            className="w-8 h-8 rounded-full text-slate-400 hover:text-[#5B3DF5] hover:bg-[#5B3DF5]/10 inline-flex items-center justify-center cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )}
                        {onDeleteExpense && (
                          <button
                            type="button"
                            onClick={() => onDeleteExpense(movement)}
                            aria-label={`Eliminar gasto ${movement.concept}`}
                            className="w-8 h-8 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })
            ) : (
              <li className="py-6 text-center text-sm text-slate-500">
                No se encontraron movimientos que coincidan con “{searchQuery}”.
              </li>
            )}
          </ul>
        </>
      )}
    </section>
  );
}

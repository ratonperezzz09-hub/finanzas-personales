import { useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Coins,
  Pencil,
  Wallet,
  X,
} from 'lucide-react';
import { formatCOP, formatPercent } from '../data/budgetData';

interface TopKpiRowProps {
  monthLabel: string;
  year: number;
  effectiveBudget: number;
  totalIncomes: number;
  totalSpent: number;
  onUpdateBudget: (newBudget: number) => void;
}

export function TopKpiRow({
  monthLabel,
  year,
  effectiveBudget,
  totalIncomes,
  totalSpent,
  onUpdateBudget,
}: TopKpiRowProps) {
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState('');
  const [budgetError, setBudgetError] = useState<string | null>(null);

  const availableBalance = effectiveBudget - totalSpent;
  const isNegativeBalance = availableBalance < 0;
  const spentPct =
    effectiveBudget > 0 ? (totalSpent / effectiveBudget) * 100 : 0;

  const startEditing = () => {
    setBudgetDraft(
      effectiveBudget.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    );
    setBudgetError(null);
    setIsEditingBudget(true);
  };

  const cancelEditing = () => {
    setIsEditingBudget(false);
    setBudgetError(null);
  };

  const handleDraftChange = (raw: string) => {
    const digitsOnly = raw.replace(/[^\d]/g, '');
    if (!digitsOnly) {
      setBudgetDraft('');
      setBudgetError(null);
      return;
    }
    const val = parseInt(digitsOnly, 10);
    setBudgetDraft(val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
    setBudgetError(null);
  };

  const commitBudget = () => {
    const digitsOnly = budgetDraft.replace(/[^\d]/g, '');
    const parsed = digitsOnly ? parseInt(digitsOnly, 10) : 0;
    if (!parsed || parsed <= 0) {
      setBudgetError('Ingresa un monto mayor a $0');
      return;
    }
    onUpdateBudget(parsed);
    setIsEditingBudget(false);
    setBudgetError(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    commitBudget();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  return (
    <section
      id="resumen"
      aria-labelledby="dashboard-titulo"
      className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6"
    >
      {/* Title + Account Status */}
      <div className="shrink-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1
            id="dashboard-titulo"
            className="text-2xl sm:text-[28px] font-display font-bold text-[#0B1739] tracking-tight leading-tight"
          >
            Mi Presupuesto Mensual
          </h1>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
              isNegativeBalance
                ? 'bg-rose-100 text-rose-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {isNegativeBalance ? (
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>
              {isNegativeBalance ? 'Balance negativo' : 'Balance positivo'}
            </span>
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          {monthLabel} {year}
          <span aria-hidden="true" className="mx-1.5 text-slate-300">
            ·
          </span>
          Saldo disponible = Presupuesto + Ingresos − Gastos
        </p>
      </div>

      {/* 3 Compact Horizontal KPI Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 xl:gap-6">
        {/* 1. Presupuesto disponible total (Base + Ingresos, editable inline) */}
        <div className="flex items-center gap-3.5 bg-white/80 xl:bg-transparent rounded-2xl p-3.5 xl:p-0 border border-slate-200/60 xl:border-0">
          <div className="w-11 h-11 rounded-full bg-blue-100/90 text-blue-600 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            {isEditingBudget ? (
              <form onSubmit={handleSubmit} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      $
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      value={budgetDraft}
                      onChange={(e) => handleDraftChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      aria-label="Nuevo presupuesto mensual en COP"
                      className="w-32 pl-6 pr-2 py-1 text-sm font-display font-bold text-[#0B1739] tabular-cop bg-white border border-[#0B1739]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B1739]/20"
                    />
                  </div>
                  <button
                    type="submit"
                    aria-label="Guardar presupuesto"
                    className="w-7 h-7 rounded-lg bg-[#0B1739] text-white flex items-center justify-center hover:bg-[#142557] transition-colors cursor-pointer shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    aria-label="Cancelar edición de presupuesto"
                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-500 flex items-center justify-center hover:text-[#0B1739] transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
                {budgetError ? (
                  <p className="text-[11px] font-medium text-rose-600">
                    {budgetError}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    Presupuesto mensual (COP)
                  </p>
                )}
              </form>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={startEditing}
                    title="Editar presupuesto mensual"
                    className="text-[17px] font-display font-bold text-[#0B1739] hover:text-blue-700 tabular-cop whitespace-nowrap transition-colors cursor-pointer"
                  >
                    {formatCOP(effectiveBudget)}
                  </button>
                  <button
                    type="button"
                    onClick={startEditing}
                    aria-label="Editar presupuesto mensual"
                    title="Editar presupuesto mensual"
                    className="w-6 h-6 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 whitespace-nowrap">
                  {totalIncomes > 0
                    ? `Presupuesto (+${formatCOP(totalIncomes)} ing.)`
                    : 'Presupuesto mensual'}
                </p>
              </>
            )}
          </div>
        </div>

        {/* 2. Total gastado */}
        <div className="flex items-center gap-3.5 bg-white/80 xl:bg-transparent rounded-2xl p-3.5 xl:p-0 border border-slate-200/60 xl:border-0">
          <div className="w-11 h-11 rounded-full bg-amber-100/90 text-amber-600 flex items-center justify-center shrink-0">
            <Coins className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[17px] font-display font-bold text-[#0B1739] tabular-cop whitespace-nowrap">
                {formatCOP(totalSpent)}
              </span>
              <span
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-full tabular-cop shrink-0 ${
                  isNegativeBalance
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {formatPercent(spentPct)}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 whitespace-nowrap">
              Total gastado
            </p>
          </div>
        </div>

        {/* 3. Disponible para gastar / Estado de cuenta */}
        <div className="flex items-center gap-3.5 bg-white/80 xl:bg-transparent rounded-2xl p-3.5 xl:p-0 border border-slate-200/60 xl:border-0">
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
              isNegativeBalance
                ? 'bg-rose-100 text-rose-600'
                : 'bg-emerald-100/90 text-emerald-600'
            }`}
          >
            {isNegativeBalance ? (
              <AlertTriangle className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
            ) : (
              <Wallet className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`text-[17px] font-display font-bold tabular-cop whitespace-nowrap ${
                  isNegativeBalance ? 'text-rose-600' : 'text-[#0B1739]'
                }`}
              >
                {formatCOP(availableBalance)}
              </span>
            </div>
            <p
              className={`text-xs font-medium mt-0.5 whitespace-nowrap ${
                isNegativeBalance ? 'text-rose-600' : 'text-emerald-700'
              }`}
            >
              Disponible ·{' '}
              {isNegativeBalance ? 'Balance negativo' : 'Balance positivo'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

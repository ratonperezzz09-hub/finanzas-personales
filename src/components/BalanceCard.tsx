import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatCOP, formatPercent } from '../data/budgetData';

interface BalanceCardProps {
  monthLabel: string;
  currentDay: number;
  totalDays: number;
  monthlyBudget: number;
  totalSpent: number;
  expenseCount: number;
}

export function BalanceCard({
  monthLabel,
  currentDay,
  totalDays,
  monthlyBudget,
  totalSpent,
  expenseCount,
}: BalanceCardProps) {
  const availableBalance = monthlyBudget - totalSpent;
  const isNegativeBalance = availableBalance < 0;
  const spentPct = monthlyBudget > 0 ? (totalSpent / monthlyBudget) * 100 : 0;
  const clampedBarPct = Math.min(100, Math.max(0, spentPct));
  const availablePct = Math.max(0, 100 - spentPct);
  const remainingDays = Math.max(0, totalDays - currentDay);
  const dailyAllowance =
    remainingDays > 0 && availableBalance > 0
      ? Math.round(availableBalance / remainingDays)
      : Math.max(0, availableBalance);

  return (
    <section
      aria-labelledby="balance-mensual-titulo"
      className="bg-[#0B1739] text-white rounded-[24px] p-6 flex flex-col justify-between shadow-[0_14px_34px_-12px_rgba(11,23,57,0.35)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-5">
        <h2
          id="balance-mensual-titulo"
          className="text-base font-display font-semibold text-white tracking-tight"
        >
          Estado de cuenta
        </h2>
        <span className="text-xs text-slate-300 tabular-cop">
          Día {currentDay} de {totalDays}
        </span>
      </div>

      {/* Stacked Dual-Block Visual */}
      <div className="space-y-4 flex-1 flex flex-col justify-between">
        {/* Top Block: Warm Gold — Progreso (% gastado vs disponible) */}
        <div className="rounded-2xl bg-gradient-to-br from-[#FDE047] via-[#FBBF24] to-[#F59E0B] text-[#0B1739] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold tracking-tight opacity-85">
              Porcentaje gastado
            </span>
            <span className="text-xs font-bold tabular-cop">
              {expenseCount} gastos
            </span>
          </div>

          <div className="mt-3.5">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <span className="text-2xl font-display font-bold tabular-cop leading-none">
                {formatPercent(spentPct)}
              </span>
              <span className="text-xs font-semibold tabular-cop">
                {isNegativeBalance
                  ? 'Presupuesto excedido'
                  : `${formatPercent(availablePct)} disponible`}
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div
              className="h-2.5 w-full rounded-full bg-[#0B1739]/15 overflow-hidden flex"
              role="progressbar"
              aria-label="Porcentaje gastado del presupuesto mensual"
              aria-valuenow={Math.round(clampedBarPct)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={`h-full transition-all duration-300 ease-out rounded-full ${
                  isNegativeBalance ? 'bg-rose-700' : 'bg-[#0B1739]'
                }`}
                style={{ width: `${clampedBarPct}%` }}
              />
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px] font-medium opacity-85 tabular-cop">
              <span>Gastado: {formatCOP(totalSpent)}</span>
              <span>Tope: {formatCOP(monthlyBudget)}</span>
            </div>
          </div>
        </div>

        {/* Bottom Block: Cornflower Blue (Balance positivo) or Alert Rose (Balance negativo) */}
        <div
          className={`rounded-2xl p-5 flex flex-col justify-between text-white transition-colors ${
            isNegativeBalance
              ? 'bg-gradient-to-br from-[#FB7185] via-[#F43F5E] to-[#E11D48]'
              : 'bg-gradient-to-br from-[#93B8FF] via-[#7AA7FF] to-[#5B8DEF]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold tracking-tight text-white/95">
              Disponible para gastar
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 text-[11px] font-semibold text-white whitespace-nowrap">
              {isNegativeBalance ? (
                <AlertTriangle className="w-3 h-3" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
              )}
              <span>
                {isNegativeBalance ? 'Balance negativo' : 'Balance positivo'}
              </span>
            </span>
          </div>

          <div className="mt-3">
            <p className="text-2xl sm:text-[26px] font-display font-bold tracking-tight tabular-cop leading-tight">
              {formatCOP(availableBalance)}
            </p>
            <p className="mt-2 text-xs text-white/95 tabular-cop">
              {isNegativeBalance
                ? `Has superado el presupuesto de ${monthLabel.toLowerCase()} por ${formatCOP(
                    Math.abs(availableBalance)
                  )}`
                : remainingDays > 0
                ? `Equivale a ${formatCOP(dailyAllowance)} por día restante (${remainingDays} días)`
                : 'Cierre mensual con saldo disponible'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

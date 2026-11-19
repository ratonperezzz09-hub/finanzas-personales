import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, ArrowRight, LogOut, Sparkles, Wallet } from 'lucide-react';
import { formatCOP, formatNumberDots } from '../data/budgetData';

interface BudgetOnboardingModalProps {
  userName: string;
  userEmail: string;
  onSaveInitialBudget: (amount: number) => Promise<void>;
  onSignOut: () => void;
}

const PRESET_BUDGETS = [1500000, 2500000, 3500000, 5000000];

export function BudgetOnboardingModal({
  userName,
  userEmail,
  onSaveInitialBudget,
  onSignOut,
}: BudgetOnboardingModalProps) {
  const [rawDigits, setRawDigits] = useState('2500000');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const numericAmount = parseInt(rawDigits || '0', 10) || 0;

  const handleAmountChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
    setRawDigits(digitsOnly);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (numericAmount <= 0) {
      setErrorMsg(
        'Ingresa un presupuesto mensual mayor a $0 COP para comenzar.'
      );
      return;
    }

    setErrorMsg(null);
    setIsSaving(true);
    try {
      await onSaveInitialBudget(numericAmount);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No pudimos guardar tu presupuesto inicial. Intenta nuevamente.'
      );
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F6FB] text-[#0B1739] flex flex-col justify-center items-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[480px] bg-white rounded-[28px] border border-slate-200/80 shadow-[0_18px_40px_-16px_rgba(11,23,57,0.12)] overflow-hidden"
      >
        {/* Navy Hero Header */}
        <div className="bg-[#0B1739] text-white px-7 py-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-slate-200">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span>Primera vez en tu cuenta</span>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Salir</span>
            </button>
          </div>

          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">
            ¡Bienvenido, {userName}!
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
            Tu cuenta (<span className="text-white font-medium">{userEmail}</span>)
            comienza desde cero. Antes de entrar al dashboard, cuéntanos cuál es
            tu presupuesto mensual.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-7 space-y-5">
          <div>
            <label
              htmlFor="initial-budget-input"
              className="block text-sm font-semibold text-[#0B1739] mb-2"
            >
              ¿Cuál es tu presupuesto mensual en COP?
            </label>

            <div className="relative">
              <Wallet
                className="w-5 h-5 text-[#5B3DF5] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="initial-budget-input"
                type="text"
                inputMode="numeric"
                value={numericAmount > 0 ? `$${formatNumberDots(numericAmount)}` : ''}
                onChange={(e) => handleAmountChange(e.target.value)}
                disabled={isSaving}
                placeholder="$2.500.000"
                className="w-full pl-12 pr-16 py-3.5 text-xl font-display font-bold tabular-cop bg-slate-50 border border-slate-200 rounded-2xl text-[#0B1739] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#5B3DF5]/20 focus:border-[#5B3DF5]"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                COP
              </span>
            </div>

            {/* Quick Presets */}
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESET_BUDGETS.map((preset) => {
                const isSelected = numericAmount === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setRawDigits(String(preset));
                      setErrorMsg(null);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold tabular-cop transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#5B3DF5] text-white'
                        : 'bg-slate-100 hover:bg-[#5B3DF5]/10 text-slate-700 hover:text-[#5B3DF5]'
                    }`}
                  >
                    {formatCOP(preset)}
                  </button>
                );
              })}
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-800 flex items-start gap-2"
            >
              <AlertCircle
                className="w-4 h-4 text-rose-600 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving || numericAmount <= 0}
            className="w-full h-12 rounded-full bg-[#5B3DF5] hover:bg-[#492CE0] text-white text-sm font-semibold shadow-sm hover:shadow transition-all inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>
              {isSaving
                ? 'Guardando tu presupuesto...'
                : 'Comenzar con este presupuesto'}
            </span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>

          <p className="text-[11px] text-slate-400 text-center">
            Podrás editar este monto o registrar ingresos adicionales cuando lo
            necesites desde tu Dashboard.
          </p>
        </form>
      </motion.div>
    </div>
  );
}

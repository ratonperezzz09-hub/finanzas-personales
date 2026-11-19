import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Check, TrendingUp } from 'lucide-react';
import {
  formatCOP,
  formatIsoDateLabels,
  formatNumberDots,
  getTodayIsoDate,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  type IncomeCategory,
  type IncomeRecord,
  type PaymentMethod,
} from '../data/budgetData';

interface RegisterIncomeScreenProps {
  monthLabel: string;
  year: number;
  effectiveBudget: number;
  totalSpent: number;
  onSaveIncome: (income: IncomeRecord) => void;
  onCancel: () => void;
}

const QUICK_INCOME_PRESETS = [200000, 500000, 850000, 1500000];
const QUICK_DESCRIPTIONS = [
  'Salario',
  'Freelance',
  'Venta de computador',
  'Bonificación',
  'Reembolso',
];

export function RegisterIncomeScreen({
  monthLabel,
  year,
  effectiveBudget,
  totalSpent,
  onSaveIncome,
  onCancel,
}: RegisterIncomeScreenProps) {
  const [amountInput, setAmountInput] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<IncomeCategory>('Salario');
  const [isoDate, setIsoDate] = useState<string>(getTodayIsoDate());
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('Cuenta bancaria');
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [errors, setErrors] = useState<{
    amount?: string;
    description?: string;
    isoDate?: string;
  }>({});

  const numericDigits = amountInput.replace(/[^\d]/g, '');
  const parsedAmount = numericDigits ? parseInt(numericDigits, 10) : 0;

  const currentAvailable = effectiveBudget - totalSpent;
  const projectedBudget = effectiveBudget + parsedAmount;
  const projectedAvailable = currentAvailable + parsedAmount;

  const handleAmountChange = (raw: string) => {
    const digitsOnly = raw.replace(/[^\d]/g, '');
    if (!digitsOnly) {
      setAmountInput('');
      setErrors((prev) => ({ ...prev, amount: undefined }));
      return;
    }
    const val = parseInt(digitsOnly, 10);
    setAmountInput(formatNumberDots(val));
    if (errors.amount) {
      setErrors((prev) => ({ ...prev, amount: undefined }));
    }
  };

  const handleQuickAmount = (val: number) => {
    setAmountInput(formatNumberDots(val));
    if (errors.amount) {
      setErrors((prev) => ({ ...prev, amount: undefined }));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const nextErrors: {
      amount?: string;
      description?: string;
      isoDate?: string;
    } = {};

    if (!parsedAmount || parsedAmount <= 0) {
      nextErrors.amount =
        'Por favor ingresa un valor válido mayor a $0 COP.';
    } else if (parsedAmount > 500000000) {
      nextErrors.amount = 'El valor ingresado supera el límite permitido.';
    }

    if (description.trim().length < 2) {
      nextErrors.description =
        'Ingresa una descripción breve para identificar el ingreso.';
    }

    if (!isoDate) {
      nextErrors.isoDate = 'Selecciona la fecha del ingreso.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSaving(true);

    const { day, dateLabel, fullDateLabel } = formatIsoDateLabels(isoDate);
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    const newIncome: IncomeRecord = {
      id: `inc-${Date.now()}`,
      kind: 'income',
      day,
      isoDate,
      dateLabel,
      fullDateLabel,
      timeLabel: `${hours}:${minutes}`,
      category,
      concept: description.trim(),
      paymentMethod,
      notes: notes.trim() || undefined,
      amount: parsedAmount,
      createdAt: Date.now(),
    };

    // Brief micro-feedback animation on button before returning to Dashboard
    setTimeout(() => {
      onSaveIncome(newIncome);
    }, 260);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200/90 text-sm font-semibold text-[#0B1739] hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Volver al Dashboard</span>
        </button>

        <span className="text-xs font-medium text-slate-500">
          Nuevo ingreso · {monthLabel} {year}
        </span>
      </div>

      {/* Main Form Card matching Dashboard rounded-3xl aesthetic with #5B3DF5 accent */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="card-mockup overflow-hidden"
      >
        {/* Top Navy Header Strip */}
        <div className="bg-[#0B1739] text-white p-6 sm:p-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">
              Registrar Nuevo Ingreso
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Aumenta tu presupuesto disponible y actualiza tus indicadores al instante.
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#5B3DF5]/25 border border-[#5B3DF5]/50 text-[#C4B5FD] flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" aria-hidden="true" />
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-5">
          {/* 1. Valor del ingreso (obligatorio, formato COP en tiempo real) */}
          <div>
            <label
              htmlFor="valor-ingreso"
              className="block text-xs font-semibold text-slate-600 mb-2"
            >
              Valor del ingreso (COP) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-display font-bold text-[#5B3DF5]">
                $
              </span>
              <input
                id="valor-ingreso"
                type="text"
                inputMode="numeric"
                autoFocus
                value={amountInput}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="850.000"
                className={`w-full pl-10 pr-16 py-3.5 text-2xl sm:text-3xl font-display font-bold text-[#0B1739] tabular-cop bg-slate-50/70 border rounded-2xl focus:outline-none focus:bg-white focus:ring-2 transition-all ${
                  errors.amount
                    ? 'border-rose-400 focus:ring-rose-200'
                    : 'border-slate-200 focus:ring-[#5B3DF5]/20 focus:border-[#5B3DF5]'
                }`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                COP
              </span>
            </div>

            {errors.amount && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.amount}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {QUICK_INCOME_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleQuickAmount(preset)}
                  className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-[#5B3DF5]/10 hover:text-[#5B3DF5] text-xs font-semibold text-[#0B1739] tabular-cop transition-colors cursor-pointer"
                >
                  +${formatNumberDots(preset)}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Descripción */}
          <div>
            <label
              htmlFor="descripcion-ingreso"
              className="block text-xs font-semibold text-slate-600 mb-2"
            >
              Descripción *
            </label>
            <input
              id="descripcion-ingreso"
              type="text"
              maxLength={80}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) {
                  setErrors((prev) => ({ ...prev, description: undefined }));
                }
              }}
              placeholder="Ej. Salario, Freelance, Venta de computador..."
              className={`w-full px-4 py-3 text-sm text-[#0B1739] bg-slate-50/70 border rounded-xl focus:outline-none focus:bg-white focus:ring-2 transition-all ${
                errors.description
                  ? 'border-rose-400 focus:ring-rose-200'
                  : 'border-slate-200 focus:ring-[#5B3DF5]/20 focus:border-[#5B3DF5]'
              }`}
            />
            {errors.description && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.description}
              </p>
            )}

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {QUICK_DESCRIPTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setDescription(item);
                    setErrors((prev) => ({ ...prev, description: undefined }));
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-[11px] font-medium text-slate-600 transition-colors cursor-pointer"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Categoría + Fecha del ingreso + Medio de pago */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="categoria-ingreso"
                className="block text-xs font-semibold text-slate-600 mb-2"
              >
                Categoría *
              </label>
              <select
                id="categoria-ingreso"
                value={category}
                onChange={(e) => setCategory(e.target.value as IncomeCategory)}
                className="w-full px-3.5 py-3 text-sm font-medium text-[#0B1739] bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#5B3DF5]/20 focus:border-[#5B3DF5]"
              >
                {INCOME_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="fecha-ingreso"
                className="block text-xs font-semibold text-slate-600 mb-2"
              >
                Fecha del ingreso *
              </label>
              <input
                id="fecha-ingreso"
                type="date"
                value={isoDate}
                onChange={(e) => {
                  setIsoDate(e.target.value);
                  if (errors.isoDate) {
                    setErrors((prev) => ({ ...prev, isoDate: undefined }));
                  }
                }}
                className={`w-full px-3.5 py-3 text-sm font-medium text-[#0B1739] tabular-cop bg-slate-50/70 border rounded-xl focus:outline-none focus:bg-white focus:ring-2 transition-all ${
                  errors.isoDate
                    ? 'border-rose-400 focus:ring-rose-200'
                    : 'border-slate-200 focus:ring-[#5B3DF5]/20 focus:border-[#5B3DF5]'
                }`}
              />
              {errors.isoDate && (
                <p className="mt-1 text-xs font-medium text-rose-600">
                  {errors.isoDate}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="medio-pago-ingreso"
                className="block text-xs font-semibold text-slate-600 mb-2"
              >
                Medio de pago *
              </label>
              <select
                id="medio-pago-ingreso"
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as PaymentMethod)
                }
                className="w-full px-3.5 py-3 text-sm font-medium text-[#0B1739] bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#5B3DF5]/20 focus:border-[#5B3DF5]"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Observaciones (opcional multilínea) */}
          <div>
            <label
              htmlFor="observaciones-ingreso"
              className="block text-xs font-semibold text-slate-600 mb-2"
            >
              Observaciones (opcional)
            </label>
            <textarea
              id="observaciones-ingreso"
              rows={3}
              maxLength={240}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales sobre el origen o detalle de este ingreso..."
              className="w-full px-4 py-3 text-sm text-[#0B1739] bg-slate-50/70 border border-slate-200 rounded-xl resize-none focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#5B3DF5]/20 focus:border-[#5B3DF5]"
            />
          </div>

          {/* Live Impact Preview */}
          <div className="rounded-2xl bg-emerald-50/90 border border-emerald-200/70 px-4 py-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center justify-between sm:block">
              <span className="text-slate-600 block">
                Presupuesto proyectado:
              </span>
              <span className="text-sm font-bold text-[#0B1739] tabular-cop">
                {formatCOP(projectedBudget)}
              </span>
            </div>
            <div className="flex items-center justify-between sm:block sm:text-right">
              <span className="text-emerald-800 block">
                Nuevo saldo disponible:
              </span>
              <span className="text-sm font-bold text-emerald-700 tabular-cop">
                {formatCOP(projectedAvailable)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-3 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#5B3DF5] hover:bg-[#492CE0] text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-80"
            >
              {isSaving ? (
                <>
                  <Check className="w-4 h-4" aria-hidden="true" />
                  <span>Guardando ingreso...</span>
                </>
              ) : (
                <span>Guardar ingreso</span>
              )}
            </motion.button>
          </div>
        </div>
      </form>
    </div>
  );
}

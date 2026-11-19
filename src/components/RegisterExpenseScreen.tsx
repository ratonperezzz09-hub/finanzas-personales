import { useState, type FormEvent } from 'react';
import { ArrowLeft, Check, Trash2 } from 'lucide-react';
import {
  buildDateLabels,
  CATEGORY_LIST,
  formatCOP,
  type ExpenseCategory,
  type ExpenseRecord,
} from '../data/budgetData';
import { CategoryIcon } from './CategoryIcon';

interface RegisterExpenseScreenProps {
  monthId: string;
  monthLabel: string;
  year: number;
  currentDay: number;
  totalDays: number;
  monthlyBudget: number;
  totalSpent: number;
  editingExpense?: ExpenseRecord;
  onSaveExpense: (newExpense: ExpenseRecord) => void;
  onDeleteExpense?: (expense: ExpenseRecord) => void;
  onCancel: () => void;
  cancelLabel?: string;
}

const QUICK_AMOUNTS = [10000, 20000, 50000, 100000];

function formatDotDigits(amount: number): string {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function RegisterExpenseScreen({
  monthId,
  monthLabel,
  year,
  currentDay,
  totalDays,
  monthlyBudget,
  totalSpent,
  editingExpense,
  onSaveExpense,
  onDeleteExpense,
  onCancel,
  cancelLabel,
}: RegisterExpenseScreenProps) {
  const isEditing = Boolean(editingExpense);

  const [amountInput, setAmountInput] = useState<string>(() =>
    editingExpense ? formatDotDigits(editingExpense.amount) : ''
  );
  const [category, setCategory] = useState<ExpenseCategory>(
    () => editingExpense?.category ?? 'Alimentación'
  );
  const [concept, setConcept] = useState<string>(
    () => editingExpense?.concept ?? ''
  );
  const [day, setDay] = useState<number>(
    () => editingExpense?.day ?? currentDay
  );
  const [notes, setNotes] = useState<string>(
    () => editingExpense?.notes ?? ''
  );
  const [errors, setErrors] = useState<{
    amount?: string;
    concept?: string;
    day?: string;
  }>({});

  // Parse digits cleanly (allows typing e.g. "45000" or "45.000")
  const numericDigits = amountInput.replace(/[^\d]/g, '');
  const parsedAmount = numericDigits ? parseInt(numericDigits, 10) : 0;

  const baseSpent = isEditing && editingExpense
    ? Math.max(0, totalSpent - editingExpense.amount)
    : totalSpent;
  const currentAvailable = monthlyBudget - baseSpent;
  const projectedAvailable = currentAvailable - parsedAmount;

  const handleAmountChange = (raw: string) => {
    const digitsOnly = raw.replace(/[^\d]/g, '');
    if (!digitsOnly) {
      setAmountInput('');
      return;
    }
    const val = parseInt(digitsOnly, 10);
    setAmountInput(val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
    if (errors.amount) {
      setErrors((prev) => ({ ...prev, amount: undefined }));
    }
  };

  const handleQuickAmount = (val: number) => {
    setAmountInput(val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
    if (errors.amount) {
      setErrors((prev) => ({ ...prev, amount: undefined }));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const nextErrors: { amount?: string; concept?: string; day?: string } = {};

    if (!parsedAmount || parsedAmount <= 0) {
      nextErrors.amount = 'Ingresa un monto válido mayor a $0 COP.';
    } else if (parsedAmount > 50000000) {
      nextErrors.amount = 'El monto ingresado supera el límite permitido.';
    }

    if (concept.trim().length < 2) {
      nextErrors.concept =
        'Escribe una descripción breve (mínimo 2 caracteres).';
    }

    if (day < 1 || day > totalDays) {
      nextErrors.day = `El día debe estar entre 1 y ${totalDays}.`;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    // Build deterministic month index from monthId (e.g. '2026-11' -> 10)
    const monthPart = parseInt(monthId.split('-')[1] ?? '11', 10) - 1;
    const { dateLabel, fullDateLabel } = buildDateLabels(
      year,
      monthPart,
      day,
      monthLabel
    );

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    const savedExpense: ExpenseRecord = {
      id: editingExpense ? editingExpense.id : `exp-${Date.now()}`,
      day,
      dateLabel,
      fullDateLabel,
      timeLabel: editingExpense ? editingExpense.timeLabel : `${hours}:${minutes}`,
      category,
      concept: concept.trim(),
      notes: notes.trim() || undefined,
      amount: parsedAmount,
    };

    onSaveExpense(savedExpense);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Top Back Button */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200/90 text-sm font-semibold text-[#0B1739] hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{cancelLabel ?? 'Volver al Dashboard'}</span>
        </button>

        <span className="text-xs font-medium text-slate-500">
          {isEditing ? 'Edición rápida' : 'Registro rápido'} · {monthLabel} {year}
        </span>
      </div>

      {/* Quick Entry Form Card */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="card-mockup p-6 sm:p-8 space-y-6"
      >
        <div>
          <h1 className="text-2xl font-display font-bold text-[#0B1739] tracking-tight">
            {isEditing ? 'Editar gasto' : 'Registrar nuevo gasto'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isEditing
              ? 'Actualiza el monto, categoría, concepto o fecha y tu presupuesto se recalculará al instante.'
              : 'Completa monto, categoría y concepto para actualizar tu saldo al instante.'}
          </p>
        </div>

        {/* 1. Monto (COP) + Quick Presets */}
        <div>
          <label
            htmlFor="monto-gasto"
            className="block text-xs font-semibold text-slate-600 mb-2"
          >
            Monto pagado (COP)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-display font-bold text-slate-400">
              $
            </span>
            <input
              id="monto-gasto"
              type="text"
              inputMode="numeric"
              autoFocus
              value={amountInput}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0"
              className={`w-full pl-10 pr-16 py-3.5 text-2xl sm:text-3xl font-display font-bold text-[#0B1739] tabular-cop bg-slate-50/70 border rounded-2xl focus:outline-none focus:bg-white focus:ring-2 transition-all ${
                errors.amount
                  ? 'border-rose-400 focus:ring-rose-200'
                  : 'border-slate-200 focus:ring-[#0B1739]/15 focus:border-[#0B1739]'
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

          {/* One-tap quick amount chips */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {QUICK_AMOUNTS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleQuickAmount(preset)}
                className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 text-xs font-semibold text-[#0B1739] tabular-cop transition-colors cursor-pointer"
              >
                +{formatCOP(preset)}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Categoría (1-tap grid for <30s entry) */}
        <div>
          <span className="block text-xs font-semibold text-slate-600 mb-2">
            Categoría
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {CATEGORY_LIST.map((cat) => {
              const isSelected = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`flex items-center justify-between gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#0B1739] bg-[#0B1739]/5 ring-1 ring-[#0B1739]'
                      : 'border-slate-200/90 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CategoryIcon category={cat} size="sm" />
                    <span className="text-sm font-medium text-[#0B1739] truncate">
                      {cat}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-[#0B1739] text-white flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" strokeWidth={2.5} aria-hidden="true" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Concepto + Día del mes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label
              htmlFor="concepto-gasto"
              className="block text-xs font-semibold text-slate-600 mb-2"
            >
              Concepto o comercio
            </label>
            <input
              id="concepto-gasto"
              type="text"
              maxLength={60}
              value={concept}
              onChange={(e) => {
                setConcept(e.target.value);
                if (errors.concept) {
                  setErrors((prev) => ({ ...prev, concept: undefined }));
                }
              }}
              placeholder="Ej. Almuerzo ejecutivo, Recarga transporte..."
              className={`w-full px-4 py-3 text-sm text-[#0B1739] bg-slate-50/70 border rounded-xl focus:outline-none focus:bg-white focus:ring-2 transition-all ${
                errors.concept
                  ? 'border-rose-400 focus:ring-rose-200'
                  : 'border-slate-200 focus:ring-[#0B1739]/15 focus:border-[#0B1739]'
              }`}
            />
            {errors.concept && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.concept}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="dia-gasto"
              className="block text-xs font-semibold text-slate-600 mb-2"
            >
              Día de {monthLabel.toLowerCase()}
            </label>
            <select
              id="dia-gasto"
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
              className="w-full px-3.5 py-3 text-sm font-medium text-[#0B1739] tabular-cop bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0B1739]/15 focus:border-[#0B1739]"
            >
              {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d} de {monthLabel.toLowerCase()}
                </option>
              ))}
            </select>
            {errors.day && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.day}
              </p>
            )}
          </div>
        </div>

        {/* 4. Nota opcional */}
        <div>
          <label
            htmlFor="nota-gasto"
            className="block text-xs font-semibold text-slate-600 mb-2"
          >
            Nota adicional (opcional)
          </label>
          <input
            id="nota-gasto"
            type="text"
            maxLength={100}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detalle corto para recordar este pago"
            className="w-full px-4 py-2.5 text-sm text-[#0B1739] bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0B1739]/15 focus:border-[#0B1739]"
          />
        </div>

        {/* Live Balance Preview Strip */}
        <div className="rounded-2xl bg-[#EEF3FC] px-4 py-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-600">
            Saldo disponible después de guardar:
          </span>
          <span
            className={`text-sm font-bold tabular-cop ${
              projectedAvailable < 0 ? 'text-rose-600' : 'text-[#0B1739]'
            }`}
          >
            {formatCOP(projectedAvailable)}
          </span>
        </div>

        {/* Submit, Delete & Cancel Actions */}
        <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          {isEditing && editingExpense && onDeleteExpense ? (
            <button
              type="button"
              onClick={() => onDeleteExpense(editingExpense)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 text-sm font-semibold text-rose-700 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              <span>Eliminar gasto</span>
            </button>
          ) : (
            <div className="hidden sm:block" />
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-3 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-600 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-6 py-3 rounded-full bg-[#5B3DF5] hover:bg-[#492CE0] text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer"
            >
              {isEditing ? 'Guardar cambios' : 'Guardar gasto'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

import { AnimatePresence, motion } from 'motion/react';
import { Trash2, X } from 'lucide-react';
import { formatCOP, type ExpenseRecord } from '../data/budgetData';

interface DeleteExpenseModalProps {
  expense: (ExpenseRecord & { kind: 'expense' }) | null;
  onCancel: () => void;
  onConfirm: (expense: ExpenseRecord & { kind: 'expense' }) => void;
}

export function DeleteExpenseModal({
  expense,
  onCancel,
  onConfirm,
}: DeleteExpenseModalProps) {
  return (
    <AnimatePresence>
      {expense && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="eliminar-gasto-titulo"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onCancel}
            className="fixed inset-0 bg-[#0B1739]/40 backdrop-blur-[2px]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md bg-white rounded-[28px] border border-slate-200/80 shadow-2xl p-6 sm:p-7 space-y-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" aria-hidden="true" />
              </div>
              <button
                type="button"
                onClick={onCancel}
                aria-label="Cerrar confirmación"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div>
              <h2
                id="eliminar-gasto-titulo"
                className="text-lg font-display font-bold text-[#0B1739] tracking-tight"
              >
                ¿Eliminar este gasto?
              </h2>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Esta acción quitará el registro de tu presupuesto mensual y
                recalculará tu saldo disponible automáticamente.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200/80 px-4 py-3.5 space-y-1">
              <p className="text-sm font-semibold text-[#0B1739] truncate">
                {expense.concept}
              </p>
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  {expense.category} · {expense.dateLabel}
                </span>
                <span className="font-bold text-rose-700 tabular-cop">
                  {formatCOP(expense.amount)}
                </span>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="h-11 px-5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-600 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => onConfirm(expense)}
                className="h-11 px-5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-sm transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <span>Sí, eliminar gasto</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

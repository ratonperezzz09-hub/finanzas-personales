import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bot,
  CheckCircle2,
  Loader2,
  LogOut,
  Plus,
  Search,
  TrendingUp,
  User as UserIcon,
  Wallet,
  X,
} from 'lucide-react';
import {
  AssistantDrawer,
  type ChatMessage,
} from './components/AssistantDrawer';
import { AuthScreen } from './components/AuthScreen';
import { BalanceCard } from './components/BalanceCard';
import { BudgetOnboardingModal } from './components/BudgetOnboardingModal';
import { DailyExpensesChart } from './components/DailyExpensesChart';
import { DeleteExpenseModal } from './components/DeleteExpenseModal';
import { ExpenseDetailScreen } from './components/ExpenseDetailScreen';
import { MovementsScreen } from './components/MovementsScreen';
import { RecentTransactions } from './components/RecentTransactions';
import { RegisterExpenseScreen } from './components/RegisterExpenseScreen';
import { RegisterIncomeScreen } from './components/RegisterIncomeScreen';
import { TopKpiRow } from './components/TopKpiRow';
import {
  formatCOP,
  type ExpenseRecord,
  type IncomeRecord,
  type MonthlyBudgetDataset,
  type MovementRecord,
} from './data/budgetData';
import { auth } from './firebase';
import {
  buildUserDatasets,
  completeUserOnboarding,
  deleteMovementDoc,
  deriveUserDisplayName,
  EMPTY_MONTH_TEMPLATES,
  ensureUserProfile,
  persistMonthlyBudget,
  persistMovement,
  subscribeToUserBudgetData,
  updateExpenseMovement,
  type MonthlyBudgetDoc,
  type StoredMovementDoc,
  type UserProfileDoc,
} from './services/budgetPersistence';

type AppScreen =
  | 'dashboard'
  | 'movimientos'
  | 'detalle'
  | 'registrar'
  | 'editar'
  | 'registrar-ingreso';

function createWelcomeMessage(name: string): ChatMessage {
  return {
    id: 'msg-welcome',
    role: 'assistant',
    text: `¡Hola, ${name}! Soy tu asistente financiero. Puedes escribirme un gasto, subir la foto de un recibo o ticket, o enviarme una nota de voz para registrarlo al instante. También puedes pedirme que consulte, edite o elimine cualquiera de tus gastos.`,
  };
}

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfileDoc | null>(null);
  const [monthsMap, setMonthsMap] = useState<Record<string, MonthlyBudgetDoc>>(
    {}
  );
  const [storedMovements, setStoredMovements] = useState<StoredMovementDoc[]>(
    []
  );
  const [dataReady, setDataReady] = useState(false);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const [selectedMonthId, setSelectedMonthId] = useState<string>(
    EMPTY_MONTH_TEMPLATES[0].id
  );
  const [activeScreen, setActiveScreen] = useState<AppScreen>('dashboard');
  const [returnScreen, setReturnScreen] = useState<'dashboard' | 'movimientos'>(
    'dashboard'
  );
  const [selectedMovement, setSelectedMovement] =
    useState<MovementRecord | null>(null);
  const [editingExpense, setEditingExpense] = useState<
    (ExpenseRecord & { kind: 'expense' }) | null
  >(null);
  const [editReturnScreen, setEditReturnScreen] = useState<
    'dashboard' | 'movimientos' | 'detalle'
  >('dashboard');
  const [expensePendingDelete, setExpensePendingDelete] = useState<
    (ExpenseRecord & { kind: 'expense' }) | null
  >(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedNotice, setSavedNotice] = useState<{
    kind: 'expense' | 'income';
    message: string;
  } | null>(null);
  const [userNameOverride, setUserNameOverride] = useState<string | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<ChatMessage[]>([]);
  const lastUidRef = useRef<string | null>(null);
  const pendingDisplayNameRef = useRef<string>('');

  if (fatalError) {
    throw fatalError;
  }

  useEffect(() => {
    let unsubData: (() => void) | null = null;
    let isCancelled = false;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubData) {
        unsubData();
        unsubData = null;
      }

      if (!user) {
        lastUidRef.current = null;
        setAuthUser(null);
        setUserProfile(null);
        setMonthsMap({});
        setStoredMovements([]);
        setDataReady(false);
        setUserNameOverride(null);
        setAssistantMessages([]);
        setActiveScreen('dashboard');
        setSelectedMovement(null);
        setEditingExpense(null);
        setExpensePendingDelete(null);
        setSelectedDay(null);
        setSearchQuery('');
        setSavedNotice(null);
        setIsAssistantOpen(false);
        setAuthReady(true);
        return;
      }

      setAuthUser(user);
      setAuthReady(true);
      setDataReady(false);

      if (lastUidRef.current !== user.uid) {
        lastUidRef.current = user.uid;
        const pendingName = pendingDisplayNameRef.current.trim();
        pendingDisplayNameRef.current = '';
        const resolvedName = pendingName || deriveUserDisplayName(user);
        setUserNameOverride(pendingName || null);
        setSelectedMonthId(EMPTY_MONTH_TEMPLATES[0].id);
        setActiveScreen('dashboard');
        setSelectedMovement(null);
        setEditingExpense(null);
        setExpensePendingDelete(null);
        setSelectedDay(null);
        setSearchQuery('');
        setSavedNotice(null);
        setIsAssistantOpen(false);
        setAssistantMessages([createWelcomeMessage(resolvedName)]);
      }

      try {
        const ensured = await ensureUserProfile(user);
        if (isCancelled) return;
        setUserProfile(ensured);

        let profileLoaded = false;
        let monthsLoaded = false;
        let movementsLoaded = false;

        const markReadyIfAllLoaded = () => {
          if (profileLoaded && monthsLoaded && movementsLoaded) {
            setDataReady(true);
          }
        };

        try {
          unsubData = subscribeToUserBudgetData(
            user.uid,
            (profile) => {
              if (profile) {
                setUserProfile(profile);
              }
              profileLoaded = true;
              markReadyIfAllLoaded();
            },
            (months) => {
              setMonthsMap(months);
              monthsLoaded = true;
              markReadyIfAllLoaded();
            },
            (movements) => {
              setStoredMovements(movements);
              movementsLoaded = true;
              markReadyIfAllLoaded();
            }
          );
        } catch (err) {
          setFatalError(
            err instanceof Error ? err : new Error(String(err))
          );
        }
      } catch (err) {
        if (!isCancelled) {
          setFatalError(
            err instanceof Error ? err : new Error(String(err))
          );
        }
      }
    });

    return () => {
      isCancelled = true;
      unsubAuth();
      if (unsubData) {
        unsubData();
      }
    };
  }, []);

  const datasets = useMemo<MonthlyBudgetDataset[]>(() => {
    const baseBudget = userProfile?.defaultMonthlyBudget ?? 0;
    return buildUserDatasets(baseBudget, monthsMap, storedMovements);
  }, [userProfile, monthsMap, storedMovements]);

  const activeDataset = useMemo(
    () => datasets.find((m) => m.id === selectedMonthId) ?? datasets[0],
    [datasets, selectedMonthId]
  );

  const totalSpent = useMemo(
    () =>
      activeDataset.expenses.reduce((sum, expense) => sum + expense.amount, 0),
    [activeDataset]
  );

  const totalIncomes = useMemo(
    () =>
      activeDataset.incomes.reduce((sum, income) => sum + income.amount, 0),
    [activeDataset]
  );

  const effectiveBudget = activeDataset.monthlyBudget + totalIncomes;

  const allMovements = useMemo<MovementRecord[]>(() => {
    const expenseMovements: MovementRecord[] = activeDataset.expenses.map(
      (exp, index) => ({
        ...exp,
        kind: 'expense',
        createdAt: exp.createdAt ?? index + 1,
      })
    );
    return [...expenseMovements, ...activeDataset.incomes];
  }, [activeDataset]);

  const activeUserName =
    userNameOverride ??
    userProfile?.displayName ??
    (authUser ? deriveUserDisplayName(authUser) : 'Usuario');

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const handleCompleteOnboarding = async (initialBudget: number) => {
    if (!authUser) return;
    await completeUserOnboarding(
      authUser.uid,
      activeUserName,
      authUser.email || userProfile?.email || 'usuario@correo.com',
      initialBudget
    );
  };

  const handleMonthChange = (monthId: string) => {
    setSelectedMonthId(monthId);
    setSelectedDay(null);
    setSelectedMovement(null);
    setSavedNotice(null);
    if (activeScreen === 'detalle') {
      setActiveScreen('dashboard');
    }
  };

  const handleNavigate = (
    screen: 'dashboard' | 'movimientos' | 'registrar' | 'registrar-ingreso'
  ) => {
    setActiveScreen(screen);
    if (screen !== 'dashboard') {
      setSavedNotice(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenDetail = (
    movement: MovementRecord,
    from: 'dashboard' | 'movimientos'
  ) => {
    setSelectedMovement(movement);
    setReturnScreen(from);
    setActiveScreen('detalle');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveExpense = (newExpense: ExpenseRecord) => {
    if (!authUser) return;
    const stampedExpense: ExpenseRecord & { kind: 'expense' } = {
      ...newExpense,
      kind: 'expense',
      createdAt: Date.now(),
    };

    void persistMovement(authUser.uid, activeDataset, stampedExpense).catch(
      (err) => {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      }
    );

    setSelectedDay(stampedExpense.day);
    setSavedNotice({
      kind: 'expense',
      message: `Gasto guardado: ${stampedExpense.concept} (${formatCOP(
        stampedExpense.amount
      )}). Tu saldo del mes fue actualizado.`,
    });
    setActiveScreen('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveIncome = (newIncome: IncomeRecord) => {
    if (!authUser) return;

    void persistMovement(authUser.uid, activeDataset, newIncome).catch(
      (err) => {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      }
    );

    setSavedNotice({
      kind: 'income',
      message: `✅ Ingreso registrado correctamente. (${newIncome.concept}: +${formatCOP(
        newIncome.amount
      )})`,
    });
    setActiveScreen('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateBudget = (newDisplayedBudget: number) => {
    if (!authUser) return;
    const baseAdjusted = Math.max(0, newDisplayedBudget - totalIncomes);
    void persistMonthlyBudget(
      authUser.uid,
      activeDataset,
      baseAdjusted
    ).catch((err) => {
      setFatalError(err instanceof Error ? err : new Error(String(err)));
    });
  };

  const handleStartEditExpense = (
    expense: ExpenseRecord & { kind: 'expense' },
    from: 'dashboard' | 'movimientos' | 'detalle'
  ) => {
    setEditingExpense(expense);
    setEditReturnScreen(from);
    setSavedNotice(null);
    setActiveScreen('editar');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateExpense = (updatedExpense: ExpenseRecord) => {
    if (!authUser) return;
    const stampedExpense: ExpenseRecord & { kind: 'expense' } = {
      ...updatedExpense,
      kind: 'expense',
      createdAt: updatedExpense.createdAt ?? Date.now(),
    };

    void updateExpenseMovement(
      authUser.uid,
      activeDataset,
      stampedExpense
    ).catch((err) => {
      setFatalError(err instanceof Error ? err : new Error(String(err)));
    });

    if (selectedMovement?.id === stampedExpense.id) {
      setSelectedMovement(stampedExpense);
    }
    setSelectedDay(stampedExpense.day);
    setEditingExpense(null);
    setSavedNotice({
      kind: 'expense',
      message: `Gasto actualizado: ${stampedExpense.concept} (${formatCOP(
        stampedExpense.amount
      )}). Tu saldo del mes fue recalculado.`,
    });
    setActiveScreen(
      editReturnScreen === 'detalle' ? 'detalle' : editReturnScreen
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConfirmDeleteExpense = (
    expense: ExpenseRecord & { kind: 'expense' }
  ) => {
    if (!authUser) return;
    setExpensePendingDelete(null);

    void deleteMovementDoc(authUser.uid, expense.id).catch((err) => {
      setFatalError(err instanceof Error ? err : new Error(String(err)));
    });

    if (selectedMovement?.id === expense.id) {
      setSelectedMovement(null);
    }
    if (editingExpense?.id === expense.id) {
      setEditingExpense(null);
    }
    if (selectedDay === expense.day) {
      const remainingOnDay = activeDataset.expenses.some(
        (e) => e.id !== expense.id && e.day === expense.day
      );
      if (!remainingOnDay) {
        setSelectedDay(null);
      }
    }

    setSavedNotice({
      kind: 'expense',
      message: `Gasto eliminado: ${expense.concept} (${formatCOP(
        expense.amount
      )}). Tu saldo disponible fue actualizado.`,
    });

    if (activeScreen === 'detalle' || activeScreen === 'editar') {
      setActiveScreen(returnScreen);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleRegisterExpenseFromAssistant = (newExpense: ExpenseRecord) => {
    if (!authUser) return;
    const stampedExpense: ExpenseRecord & { kind: 'expense' } = {
      ...newExpense,
      kind: 'expense',
      createdAt: newExpense.createdAt ?? Date.now(),
    };

    void persistMovement(authUser.uid, activeDataset, stampedExpense).catch(
      (err) => {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      }
    );

    setSelectedDay(stampedExpense.day);
  };

  const handleUpdateExpenseFromAssistant = (updatedExpense: ExpenseRecord) => {
    if (!authUser) return;
    const stampedExpense: ExpenseRecord & { kind: 'expense' } = {
      ...updatedExpense,
      kind: 'expense',
      createdAt: updatedExpense.createdAt ?? Date.now(),
    };

    void updateExpenseMovement(
      authUser.uid,
      activeDataset,
      stampedExpense
    ).catch((err) => {
      setFatalError(err instanceof Error ? err : new Error(String(err)));
    });

    if (selectedMovement?.id === stampedExpense.id) {
      setSelectedMovement(stampedExpense);
    }
    if (editingExpense?.id === stampedExpense.id) {
      setEditingExpense(stampedExpense);
    }
    setSelectedDay(stampedExpense.day);
    setSavedNotice({
      kind: 'expense',
      message: `Gasto actualizado por el asistente: ${stampedExpense.concept} (${formatCOP(
        stampedExpense.amount
      )}).`,
    });
  };

  const handleDeleteExpenseFromAssistant = (expense: ExpenseRecord) => {
    if (!authUser) return;

    void deleteMovementDoc(authUser.uid, expense.id).catch((err) => {
      setFatalError(err instanceof Error ? err : new Error(String(err)));
    });

    if (selectedMovement?.id === expense.id) {
      setSelectedMovement(null);
    }
    if (editingExpense?.id === expense.id) {
      setEditingExpense(null);
    }
    if (expensePendingDelete?.id === expense.id) {
      setExpensePendingDelete(null);
    }
    if (selectedDay === expense.day) {
      const remainingOnDay = activeDataset.expenses.some(
        (e) => e.id !== expense.id && e.day === expense.day
      );
      if (!remainingOnDay) {
        setSelectedDay(null);
      }
    }

    if (
      (activeScreen === 'detalle' && selectedMovement?.id === expense.id) ||
      (activeScreen === 'editar' && editingExpense?.id === expense.id)
    ) {
      setActiveScreen(returnScreen);
    }

    setSavedNotice({
      kind: 'expense',
      message: `Gasto eliminado por el asistente: ${expense.concept} (${formatCOP(
        expense.amount
      )}).`,
    });
  };

  // Gate 1: Auth loading
  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F3F6FB] text-[#0B1739] flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-slate-200/80 px-8 py-7 shadow-sm flex items-center gap-3">
          <Loader2
            className="w-5 h-5 text-[#5B3DF5] animate-spin"
            aria-hidden="true"
          />
          <span className="text-sm font-semibold">
            Verificando tu sesión...
          </span>
        </div>
      </div>
    );
  }

  // Gate 2: Sign-in / Sign-up Screen
  if (!authUser) {
    return (
      <AuthScreen
        onPendingName={(name) => {
          pendingDisplayNameRef.current = name;
        }}
      />
    );
  }

  // Gate 3: Loading user's isolated Firestore data
  if (!dataReady || !userProfile) {
    return (
      <div className="min-h-screen bg-[#F3F6FB] text-[#0B1739] flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-slate-200/80 px-8 py-7 shadow-sm flex items-center gap-3">
          <Loader2
            className="w-5 h-5 text-[#5B3DF5] animate-spin"
            aria-hidden="true"
          />
          <span className="text-sm font-semibold">
            Cargando tu presupuesto personal...
          </span>
        </div>
      </div>
    );
  }

  // Gate 4: First-time account budget prompt
  if (!userProfile.hasCompletedOnboarding) {
    return (
      <BudgetOnboardingModal
        userName={activeUserName}
        userEmail={authUser.email || userProfile.email}
        onSaveInitialBudget={handleCompleteOnboarding}
        onSignOut={() => void handleSignOut()}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F6FB] text-[#0B1739] flex flex-col">
      {/* Top Bar */}
      <header className="w-full max-w-[1220px] mx-auto px-4 sm:px-8 pt-5 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Brand Mark */}
          <button
            type="button"
            onClick={() => handleNavigate('dashboard')}
            className="flex items-center gap-2.5 shrink-0 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-[#0B1739] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Wallet
                className="w-[18px] h-[18px]"
                strokeWidth={2}
                aria-hidden="true"
              />
            </div>
            <span className="font-display font-bold text-base sm:text-[17px] text-[#0B1739] whitespace-nowrap tracking-tight">
              Mi Presupuesto
            </span>
          </button>

          {/* Search Input (visible on Dashboard & Movimientos) */}
          {activeScreen === 'dashboard' || activeScreen === 'movimientos' ? (
            <div className="relative w-full sm:w-64 md:w-72 order-3 lg:order-2">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar movimiento..."
                aria-label="Buscar movimiento o categoría"
                className="w-full pl-10 pr-9 py-2.5 text-sm bg-white border border-slate-200/80 rounded-full text-[#0B1739] placeholder:text-slate-400 shadow-[0_2px_10px_-4px_rgba(11,23,57,0.06)] focus:outline-none focus:ring-2 focus:ring-[#0B1739]/15"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0B1739] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : null}

          {/* Right Controls: Month Switcher + Authenticated Account Pill */}
          <div className="flex items-center gap-2.5 order-2 lg:order-3">
            <div
              className="inline-flex items-center p-1 bg-white border border-slate-200/90 rounded-full shadow-[0_2px_10px_-4px_rgba(11,23,57,0.05)]"
              role="group"
              aria-label="Seleccionar mes"
            >
              {datasets.map((dataset) => {
                const isActive = dataset.id === activeDataset.id;
                return (
                  <button
                    key={dataset.id}
                    type="button"
                    onClick={() => handleMonthChange(dataset.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-slate-100 text-[#0B1739]'
                        : 'text-slate-500 hover:text-[#0B1739]'
                    }`}
                  >
                    <span className="sm:hidden">
                      {dataset.monthLabel.slice(0, 3)}
                    </span>
                    <span className="hidden sm:inline">
                      {dataset.monthLabel} {dataset.year}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="inline-flex items-center gap-2 pl-2.5 pr-1.5 py-1 bg-white border border-slate-200/90 rounded-full shadow-[0_2px_10px_-4px_rgba(11,23,57,0.05)]">
              <div
                className="flex items-center gap-1.5 max-w-[120px]"
                title={authUser.email || activeUserName}
              >
                <UserIcon
                  className="w-3.5 h-3.5 text-[#5B3DF5] shrink-0"
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold text-[#0B1739] truncate hidden md:inline">
                  {activeUserName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="h-7 px-2.5 rounded-full bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Active Screen Viewport with Smooth Transitions */}
      <main className="flex-1 w-full max-w-[1220px] mx-auto px-4 sm:px-8 py-5 sm:py-6">
        <AnimatePresence mode="wait">
          {/* SCREEN 1: DASHBOARD */}
          {activeScreen === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              {savedNotice && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="status"
                  className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CheckCircle2
                      className="w-5 h-5 text-emerald-600 shrink-0"
                      aria-hidden="true"
                    />
                    <p className="font-medium truncate">{savedNotice.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSavedNotice(null)}
                    aria-label="Cerrar confirmación"
                    className="text-emerald-700 hover:text-emerald-950 shrink-0 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              <TopKpiRow
                monthLabel={activeDataset.monthLabel}
                year={activeDataset.year}
                effectiveBudget={effectiveBudget}
                totalIncomes={totalIncomes}
                totalSpent={totalSpent}
                onUpdateBudget={handleUpdateBudget}
              />

              {/* Centered Acciones rápidas container positioned 28px below the top KPI summary */}
              <section
                aria-labelledby="acciones-rapidas-titulo"
                className="!mt-7 !mb-7 w-full max-w-[560px] mx-auto bg-white/95 border border-slate-200/80 rounded-[22px] px-5 sm:px-6 py-4 shadow-[0_8px_24px_-10px_rgba(11,23,57,0.06)]"
              >
                <h2
                  id="acciones-rapidas-titulo"
                  className="text-xs font-semibold text-slate-500 text-center mb-3 tracking-tight"
                >
                  Acciones rápidas
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleNavigate('registrar-ingreso')}
                    className="w-full h-11 px-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm hover:shadow hover:-translate-y-0.5 transition-all duration-150 inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <TrendingUp
                      className="w-4 h-4 shrink-0"
                      strokeWidth={2.1}
                      aria-hidden="true"
                    />
                    <span>Registrar ingreso</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavigate('registrar')}
                    className="w-full h-11 px-5 rounded-full bg-[#5B3DF5] hover:bg-[#492CE0] text-white text-sm font-semibold shadow-sm hover:shadow hover:-translate-y-0.5 transition-all duration-150 inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <Plus
                      className="w-4 h-4 shrink-0"
                      strokeWidth={2.2}
                      aria-hidden="true"
                    />
                    <span>Registrar gasto</span>
                  </button>
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <div className="lg:col-span-8 flex flex-col [&>section]:flex-1">
                  <DailyExpensesChart
                    monthLabel={activeDataset.monthLabel}
                    currentDay={activeDataset.currentDay}
                    monthlyBudget={effectiveBudget}
                    totalSpent={totalSpent}
                    expenses={activeDataset.expenses}
                    selectedDay={selectedDay}
                    onSelectDay={setSelectedDay}
                    onRegisterFirstExpense={() => handleNavigate('registrar')}
                  />
                </div>

                <div className="lg:col-span-4 flex flex-col [&>section]:flex-1">
                  <BalanceCard
                    monthLabel={activeDataset.monthLabel}
                    currentDay={activeDataset.currentDay}
                    totalDays={activeDataset.totalDays}
                    monthlyBudget={effectiveBudget}
                    totalSpent={totalSpent}
                    expenseCount={activeDataset.expenses.length}
                  />
                </div>
              </div>

              <RecentTransactions
                movements={allMovements}
                hasExpenses={activeDataset.expenses.length > 0}
                monthLabel={activeDataset.monthLabel}
                onSelectMovement={(movement) =>
                  handleOpenDetail(movement, 'dashboard')
                }
                onEditExpense={(expense) =>
                  handleStartEditExpense(expense, 'dashboard')
                }
                onDeleteExpense={(expense) => setExpensePendingDelete(expense)}
                onViewAllMovements={() => handleNavigate('movimientos')}
                searchQuery={searchQuery}
              />
            </motion.div>
          )}

          {/* SCREEN 2: MOVIMIENTOS */}
          {activeScreen === 'movimientos' && (
            <motion.div
              key="movimientos"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {savedNotice && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="status"
                  className="mb-5 flex items-center justify-between gap-4 px-5 py-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CheckCircle2
                      className="w-5 h-5 text-emerald-600 shrink-0"
                      aria-hidden="true"
                    />
                    <p className="font-medium truncate">{savedNotice.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSavedNotice(null)}
                    aria-label="Cerrar confirmación"
                    className="text-emerald-700 hover:text-emerald-950 shrink-0 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              <MovementsScreen
                monthLabel={activeDataset.monthLabel}
                year={activeDataset.year}
                movements={allMovements}
                hasExpenses={activeDataset.expenses.length > 0}
                searchQuery={searchQuery}
                onSelectMovement={(movement) =>
                  handleOpenDetail(movement, 'movimientos')
                }
                onEditExpense={(expense) =>
                  handleStartEditExpense(expense, 'movimientos')
                }
                onDeleteExpense={(expense) => setExpensePendingDelete(expense)}
                onBackToDashboard={() => handleNavigate('dashboard')}
                onGoToRegisterExpense={() => handleNavigate('registrar')}
                onGoToRegisterIncome={() => handleNavigate('registrar-ingreso')}
                onGoToEmptyDetail={() => {
                  setSelectedMovement(null);
                  setReturnScreen('movimientos');
                  setActiveScreen('detalle');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </motion.div>
          )}

          {/* SCREEN 3: DETALLE */}
          {activeScreen === 'detalle' && (
            <motion.div
              key="detalle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {savedNotice && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="status"
                  className="max-w-2xl mx-auto mb-5 flex items-center justify-between gap-4 px-5 py-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CheckCircle2
                      className="w-5 h-5 text-emerald-600 shrink-0"
                      aria-hidden="true"
                    />
                    <p className="font-medium truncate">{savedNotice.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSavedNotice(null)}
                    aria-label="Cerrar confirmación"
                    className="text-emerald-700 hover:text-emerald-950 shrink-0 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              <ExpenseDetailScreen
                movement={selectedMovement}
                effectiveBudget={effectiveBudget}
                monthLabel={activeDataset.monthLabel}
                onBack={() => setActiveScreen(returnScreen)}
                backLabel={
                  returnScreen === 'movimientos'
                    ? 'Volver a Movimientos'
                    : 'Volver al Dashboard'
                }
                onEditExpense={(expense) =>
                  handleStartEditExpense(expense, 'detalle')
                }
                onDeleteExpense={(expense) => setExpensePendingDelete(expense)}
              />
            </motion.div>
          )}

          {/* SCREEN 4: REGISTRAR NUEVO GASTO */}
          {activeScreen === 'registrar' && (
            <motion.div
              key="registrar"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <RegisterExpenseScreen
                monthId={activeDataset.id}
                monthLabel={activeDataset.monthLabel}
                year={activeDataset.year}
                currentDay={activeDataset.currentDay}
                totalDays={activeDataset.totalDays}
                monthlyBudget={effectiveBudget}
                totalSpent={totalSpent}
                onSaveExpense={handleSaveExpense}
                onCancel={() => handleNavigate('dashboard')}
              />
            </motion.div>
          )}

          {/* SCREEN 4B: EDITAR GASTO */}
          {activeScreen === 'editar' && editingExpense && (
            <motion.div
              key={`editar-${editingExpense.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <RegisterExpenseScreen
                monthId={activeDataset.id}
                monthLabel={activeDataset.monthLabel}
                year={activeDataset.year}
                currentDay={activeDataset.currentDay}
                totalDays={activeDataset.totalDays}
                monthlyBudget={effectiveBudget}
                totalSpent={totalSpent}
                editingExpense={editingExpense}
                onSaveExpense={handleUpdateExpense}
                onDeleteExpense={(expense) =>
                  setExpensePendingDelete({ ...expense, kind: 'expense' })
                }
                onCancel={() => {
                  setEditingExpense(null);
                  setActiveScreen(editReturnScreen);
                }}
                cancelLabel={
                  editReturnScreen === 'detalle'
                    ? 'Volver al detalle'
                    : editReturnScreen === 'movimientos'
                    ? 'Volver a Movimientos'
                    : 'Volver al Dashboard'
                }
              />
            </motion.div>
          )}

          {/* SCREEN 5: REGISTRAR NUEVO INGRESO */}
          {activeScreen === 'registrar-ingreso' && (
            <motion.div
              key="registrar-ingreso"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <RegisterIncomeScreen
                monthLabel={activeDataset.monthLabel}
                year={activeDataset.year}
                effectiveBudget={effectiveBudget}
                totalSpent={totalSpent}
                onSaveIncome={handleSaveIncome}
                onCancel={() => handleNavigate('dashboard')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Assistant Trigger Button */}
      <button
        type="button"
        onClick={() => setIsAssistantOpen(true)}
        aria-label="Abrir asistente financiero"
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2.5 h-12 px-5 rounded-full bg-[#0B1739] hover:bg-[#5B3DF5] text-white text-sm font-semibold shadow-[0_12px_28px_-6px_rgba(11,23,57,0.35)] hover:shadow-[0_14px_30px_-6px_rgba(91,61,245,0.45)] transition-all duration-200 cursor-pointer"
      >
        <Bot className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Asistente</span>
      </button>

      {/* Intelligent Budget Assistant Drawer */}
      <AssistantDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        userName={activeUserName}
        onChangeUserName={(name) => setUserNameOverride(name)}
        messages={assistantMessages}
        onUpdateMessages={setAssistantMessages}
        budgetContext={{
          monthId: activeDataset.id,
          monthLabel: activeDataset.monthLabel,
          year: activeDataset.year,
          totalDays: activeDataset.totalDays,
          effectiveBudget,
          totalSpent,
          availableBalance: effectiveBudget - totalSpent,
          expenseCount: activeDataset.expenses.length,
        }}
        expenses={activeDataset.expenses}
        onRegisterExpense={handleRegisterExpenseFromAssistant}
        onUpdateExpense={handleUpdateExpenseFromAssistant}
        onDeleteExpense={handleDeleteExpenseFromAssistant}
      />

      {/* Delete Expense Confirmation Modal */}
      <DeleteExpenseModal
        expense={expensePendingDelete}
        onCancel={() => setExpensePendingDelete(null)}
        onConfirm={handleConfirmDeleteExpense}
      />
    </div>
  );
}

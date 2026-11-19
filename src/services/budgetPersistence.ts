import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  ExpenseRecord,
  IncomeRecord,
  MonthlyBudgetDataset,
  MovementRecord,
} from '../data/budgetData';
import { db, handleFirestoreError, OperationType } from '../firebase';

export interface UserProfileDoc {
  uid: string;
  displayName: string;
  email: string;
  hasCompletedOnboarding: boolean;
  defaultMonthlyBudget: number;
}

export interface MonthlyBudgetDoc {
  uid: string;
  id: string;
  monthLabel: string;
  year: number;
  totalDays: number;
  currentDay: number;
  monthlyBudget: number;
}

export interface StoredMovementDoc {
  uid: string;
  id: string;
  monthId: string;
  kind: 'expense' | 'income';
  day: number;
  dateLabel: string;
  fullDateLabel: string;
  timeLabel: string;
  category: string;
  concept: string;
  amount: number;
  createdAtMs: number;
  notes?: string;
  isoDate?: string;
  paymentMethod?: string;
}

export interface MonthTemplate {
  id: string;
  monthLabel: string;
  year: number;
  totalDays: number;
  currentDay: number;
}

export const EMPTY_MONTH_TEMPLATES: MonthTemplate[] = [
  {
    id: '2026-11',
    monthLabel: 'Noviembre',
    year: 2026,
    totalDays: 30,
    currentDay: 17,
  },
  {
    id: '2026-10',
    monthLabel: 'Octubre',
    year: 2026,
    totalDays: 31,
    currentDay: 31,
  },
];

function sanitizeStr(value: unknown, maxLen: number, fallback = ''): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  const nonEmpty = raw.length > 0 ? raw : fallback;
  return nonEmpty.slice(0, maxLen);
}

function sanitizeId(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  return cleaned.length > 0 ? cleaned : `id-${Date.now()}`;
}

export function deriveUserDisplayName(user: User): string {
  if (user.displayName && user.displayName.trim().length > 0) {
    return sanitizeStr(user.displayName, 80, 'Usuario');
  }
  if (user.email && user.email.includes('@')) {
    const prefix = user.email.split('@')[0] ?? 'Usuario';
    const capitalized = prefix.charAt(0).toUpperCase() + prefix.slice(1);
    return sanitizeStr(capitalized, 80, 'Usuario');
  }
  return 'Usuario';
}

export async function ensureUserProfile(user: User): Promise<UserProfileDoc> {
  const uid = sanitizeId(user.uid);
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data() as Partial<UserProfileDoc>;
      return {
        uid,
        displayName: sanitizeStr(
          data.displayName,
          80,
          deriveUserDisplayName(user)
        ),
        email: sanitizeStr(data.email, 160, user.email || 'usuario@correo.com'),
        hasCompletedOnboarding: Boolean(data.hasCompletedOnboarding),
        defaultMonthlyBudget: Number(data.defaultMonthlyBudget ?? 0),
      };
    }

    const initialProfile: UserProfileDoc = {
      uid,
      displayName: deriveUserDisplayName(user),
      email: sanitizeStr(user.email, 160, 'usuario@correo.com'),
      hasCompletedOnboarding: false,
      defaultMonthlyBudget: 0,
    };

    await setDoc(userRef, {
      ...initialProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return initialProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function completeUserOnboarding(
  uid: string,
  displayName: string,
  email: string,
  initialBudget: number
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const safeBudget = Math.max(1, Math.min(1000000000, Math.round(initialBudget)));
  const userPath = `users/${safeUid}`;
  const userRef = doc(db, 'users', safeUid);

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      await updateDoc(userRef, {
        hasCompletedOnboarding: true,
        defaultMonthlyBudget: safeBudget,
        displayName: sanitizeStr(displayName, 80, 'Usuario'),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(userRef, {
        uid: safeUid,
        displayName: sanitizeStr(displayName, 80, 'Usuario'),
        email: sanitizeStr(email, 160, 'usuario@correo.com'),
        hasCompletedOnboarding: true,
        defaultMonthlyBudget: safeBudget,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }

  for (const tpl of EMPTY_MONTH_TEMPLATES) {
    const monthPath = `users/${safeUid}/months/${tpl.id}`;
    const monthRef = doc(db, 'users', safeUid, 'months', tpl.id);
    try {
      const existingSnap = await getDoc(monthRef);
      if (existingSnap.exists()) {
        await updateDoc(monthRef, {
          monthlyBudget: safeBudget,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(monthRef, {
          uid: safeUid,
          id: tpl.id,
          monthLabel: tpl.monthLabel,
          year: tpl.year,
          totalDays: tpl.totalDays,
          currentDay: tpl.currentDay,
          monthlyBudget: safeBudget,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, monthPath);
    }
  }
}

export function subscribeToUserBudgetData(
  uid: string,
  onProfile: (profile: UserProfileDoc | null) => void,
  onMonths: (months: Record<string, MonthlyBudgetDoc>) => void,
  onMovements: (movements: StoredMovementDoc[]) => void
): Unsubscribe {
  const safeUid = sanitizeId(uid);

  const userPath = `users/${safeUid}`;
  const unsubProfile = onSnapshot(
    doc(db, 'users', safeUid),
    (snapshot) => {
      if (!snapshot.exists()) {
        onProfile(null);
        return;
      }
      const data = snapshot.data() as Partial<UserProfileDoc>;
      onProfile({
        uid: safeUid,
        displayName: sanitizeStr(data.displayName, 80, 'Usuario'),
        email: sanitizeStr(data.email, 160, 'usuario@correo.com'),
        hasCompletedOnboarding: Boolean(data.hasCompletedOnboarding),
        defaultMonthlyBudget: Number(data.defaultMonthlyBudget ?? 0),
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, userPath);
    }
  );

  const monthsPath = `users/${safeUid}/months`;
  const monthsQuery = query(
    collection(db, 'users', safeUid, 'months'),
    where('uid', '==', safeUid)
  );
  const unsubMonths = onSnapshot(
    monthsQuery,
    (snapshot) => {
      const map: Record<string, MonthlyBudgetDoc> = {};
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as MonthlyBudgetDoc;
        map[d.id] = d;
      });
      onMonths(map);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, monthsPath);
    }
  );

  const movementsPath = `users/${safeUid}/movements`;
  const movementsQuery = query(
    collection(db, 'users', safeUid, 'movements'),
    where('uid', '==', safeUid)
  );
  const unsubMovements = onSnapshot(
    movementsQuery,
    (snapshot) => {
      const items: StoredMovementDoc[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as StoredMovementDoc);
      });
      onMovements(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, movementsPath);
    }
  );

  return () => {
    unsubProfile();
    unsubMonths();
    unsubMovements();
  };
}

export async function persistMonthlyBudget(
  uid: string,
  dataset: MonthlyBudgetDataset,
  newBaseBudget: number,
  nextCurrentDay?: number
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const safeMonthId = sanitizeId(dataset.id);
  const safeBudget = Math.max(0, Math.min(1000000000, Math.round(newBaseBudget)));
  const safeDay = Math.max(
    1,
    Math.min(dataset.totalDays, Math.round(nextCurrentDay ?? dataset.currentDay))
  );
  const monthPath = `users/${safeUid}/months/${safeMonthId}`;
  const monthRef = doc(db, 'users', safeUid, 'months', safeMonthId);

  try {
    const snap = await getDoc(monthRef);
    if (snap.exists()) {
      await updateDoc(monthRef, {
        monthlyBudget: safeBudget,
        currentDay: safeDay,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(monthRef, {
        uid: safeUid,
        id: safeMonthId,
        monthLabel: sanitizeStr(dataset.monthLabel, 20, 'Mes'),
        year: dataset.year,
        totalDays: dataset.totalDays,
        currentDay: safeDay,
        monthlyBudget: safeBudget,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, monthPath);
  }
}

export async function persistMovement(
  uid: string,
  dataset: MonthlyBudgetDataset,
  movement: MovementRecord
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const safeMonthId = sanitizeId(dataset.id);
  const safeMovementId = sanitizeId(movement.id);
  const movementPath = `users/${safeUid}/movements/${safeMovementId}`;
  const movementRef = doc(db, 'users', safeUid, 'movements', safeMovementId);

  const safeAmount = Math.max(1, Math.min(1000000000, Math.round(movement.amount)));
  const safeDay = Math.max(1, Math.min(31, Math.round(movement.day)));

  const payload: Record<string, unknown> = {
    uid: safeUid,
    id: safeMovementId,
    monthId: safeMonthId,
    kind: movement.kind,
    day: safeDay,
    dateLabel: sanitizeStr(movement.dateLabel, 40, 'Hoy'),
    fullDateLabel: sanitizeStr(movement.fullDateLabel, 80, 'Hoy'),
    timeLabel: sanitizeStr(movement.timeLabel, 10, '12:00'),
    category: sanitizeStr(movement.category, 60, 'Alimentación'),
    concept: sanitizeStr(movement.concept, 140, 'Movimiento'),
    amount: safeAmount,
    createdAtMs: Number(movement.createdAt || Date.now()),
    createdAt: serverTimestamp(),
  };

  if (movement.notes && movement.notes.trim().length > 0) {
    payload.notes = sanitizeStr(movement.notes, 500);
  }
  if (movement.kind === 'income') {
    if (movement.isoDate) {
      payload.isoDate = sanitizeStr(movement.isoDate, 20);
    }
    if (movement.paymentMethod) {
      payload.paymentMethod = sanitizeStr(movement.paymentMethod, 40);
    }
  }

  try {
    await setDoc(movementRef, payload);

    if (movement.kind === 'expense' && safeDay > dataset.currentDay) {
      await persistMonthlyBudget(uid, dataset, dataset.monthlyBudget, safeDay);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, movementPath);
  }
}

export async function updateExpenseMovement(
  uid: string,
  dataset: MonthlyBudgetDataset,
  expense: ExpenseRecord
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const safeMovementId = sanitizeId(expense.id);
  const movementPath = `users/${safeUid}/movements/${safeMovementId}`;
  const movementRef = doc(db, 'users', safeUid, 'movements', safeMovementId);

  const safeAmount = Math.max(1, Math.min(1000000000, Math.round(expense.amount)));
  const safeDay = Math.max(1, Math.min(31, Math.round(expense.day)));

  const payload: Record<string, unknown> = {
    amount: safeAmount,
    category: sanitizeStr(expense.category, 60, 'Alimentación'),
    concept: sanitizeStr(expense.concept, 140, 'Gasto'),
    day: safeDay,
    dateLabel: sanitizeStr(expense.dateLabel, 40, 'Hoy'),
    fullDateLabel: sanitizeStr(expense.fullDateLabel, 80, 'Hoy'),
    notes: expense.notes ? sanitizeStr(expense.notes, 500) : '',
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(movementRef, payload);

    if (safeDay > dataset.currentDay) {
      await persistMonthlyBudget(uid, dataset, dataset.monthlyBudget, safeDay);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, movementPath);
  }
}

export async function deleteMovementDoc(
  uid: string,
  movementId: string
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const safeMovementId = sanitizeId(movementId);
  const movementPath = `users/${safeUid}/movements/${safeMovementId}`;
  const movementRef = doc(db, 'users', safeUid, 'movements', safeMovementId);

  try {
    await deleteDoc(movementRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, movementPath);
  }
}

export function buildUserDatasets(
  defaultBudget: number,
  monthsMap: Record<string, MonthlyBudgetDoc>,
  storedMovements: StoredMovementDoc[]
): MonthlyBudgetDataset[] {
  return EMPTY_MONTH_TEMPLATES.map((tpl) => {
    const savedMonth = monthsMap[tpl.id];
    const monthMovements = storedMovements.filter((m) => m.monthId === tpl.id);

    const expenses: ExpenseRecord[] = monthMovements
      .filter((m) => m.kind === 'expense')
      .map((m) => ({
        id: m.id,
        kind: 'expense',
        day: m.day,
        dateLabel: m.dateLabel,
        fullDateLabel: m.fullDateLabel,
        timeLabel: m.timeLabel,
        category: m.category as ExpenseRecord['category'],
        concept: m.concept,
        notes: m.notes && m.notes.trim().length > 0 ? m.notes : undefined,
        amount: m.amount,
        createdAt: m.createdAtMs,
      }));

    const incomes: IncomeRecord[] = monthMovements
      .filter((m) => m.kind === 'income')
      .map((m) => ({
        id: m.id,
        kind: 'income',
        day: m.day,
        isoDate: m.isoDate || `${tpl.year}-${tpl.id.slice(5)}-${String(m.day).padStart(2, '0')}`,
        dateLabel: m.dateLabel,
        fullDateLabel: m.fullDateLabel,
        timeLabel: m.timeLabel,
        category: m.category as IncomeRecord['category'],
        concept: m.concept,
        paymentMethod: (m.paymentMethod || 'Otro') as IncomeRecord['paymentMethod'],
        notes: m.notes,
        amount: m.amount,
        createdAt: m.createdAtMs,
      }));

    return {
      id: tpl.id,
      monthLabel: tpl.monthLabel,
      year: tpl.year,
      totalDays: tpl.totalDays,
      currentDay: savedMonth?.currentDay ?? tpl.currentDay,
      monthlyBudget: savedMonth?.monthlyBudget ?? defaultBudget,
      expenses,
      incomes,
    };
  });
}

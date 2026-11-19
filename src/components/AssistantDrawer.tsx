import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  FileAudio,
  ImagePlus,
  Mic,
  Pencil,
  Send,
  Sparkles,
  Square,
  Trash2,
  User,
  Volume2,
  X,
} from 'lucide-react';
import {
  CATEGORY_LIST,
  formatCOP,
  formatIsoDateLabels,
  getTodayIsoDate,
  type ExpenseCategory,
  type ExpenseRecord,
} from '../data/budgetData';

export interface AssistantRegisteredExpenseSummary {
  amount: number;
  date: string;
  description: string;
  category: ExpenseCategory;
}

export interface AssistantExpenseActionSummary {
  type: 'registered' | 'updated' | 'deleted';
  id?: string;
  amount: number;
  date: string;
  description: string;
  category: ExpenseCategory;
  previousAmount?: number;
  previousDescription?: string;
}

export interface ChatMediaAttachment {
  kind: 'image' | 'audio';
  mimeType: string;
  data: string;
  previewUrl: string;
  fileName?: string;
  durationLabel?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isError?: boolean;
  media?: ChatMediaAttachment;
  transcript?: string;
  registeredExpense?: AssistantRegisteredExpenseSummary;
  expenseActions?: AssistantExpenseActionSummary[];
}

interface AssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  onChangeUserName: (name: string) => void;
  messages: ChatMessage[];
  onUpdateMessages: (
    updater: (prev: ChatMessage[]) => ChatMessage[]
  ) => void;
  budgetContext: {
    monthId: string;
    monthLabel: string;
    year: number;
    totalDays: number;
    effectiveBudget: number;
    totalSpent: number;
    availableBalance: number;
    expenseCount: number;
  };
  expenses: ExpenseRecord[];
  onRegisterExpense: (expense: ExpenseRecord) => void;
  onUpdateExpense: (expense: ExpenseRecord) => void;
  onDeleteExpense: (expense: ExpenseRecord) => void;
}

interface ServerFunctionCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

const MAX_MEDIA_BYTES = 10 * 1024 * 1024; // 10 MB

function normalizeExpenseCategory(rawCategory: unknown): ExpenseCategory {
  if (typeof rawCategory !== 'string') return 'Alimentación';
  const normalized = rawCategory.trim().toLowerCase();

  for (const valid of CATEGORY_LIST) {
    if (valid.toLowerCase() === normalized) return valid;
  }

  if (
    /comida|almuerzo|desayuno|cena|mercado|restaurante|caf[eé]|aliment/i.test(
      normalized
    )
  ) {
    return 'Alimentación';
  }
  if (/bus|taxi|uber|transporte|pasaje|metro|gasolina/i.test(normalized)) {
    return 'Transporte';
  }
  if (/luz|agua|gas|internet|telefon|servicio|factura/i.test(normalized)) {
    return 'Servicios públicos';
  }
  if (/ropa|camisa|zapato|farmacia|compra|personal/i.test(normalized)) {
    return 'Ropa y compras personales';
  }
  if (/cine|ocio|entretenimiento|juego|teatro|concierto|salida/i.test(normalized)) {
    return 'Entretenimiento y ocio';
  }

  return 'Alimentación';
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('No se pudo leer el archivo multimedia.'));
      }
    };
    reader.onerror = () =>
      reject(new Error('Error al procesar el archivo seleccionado.'));
    reader.readAsDataURL(blob);
  });
}

function stripDataUrlPrefix(dataUrl: string): string {
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

const SUGGESTED_PROMPTS = [
  'Gasté 25.000 en almuerzo hoy',
  '¿Cuánto saldo me queda este mes?',
  'Lista mis gastos del mes',
  'Cambia el monto de un gasto',
];

export function AssistantDrawer({
  isOpen,
  onClose,
  userName,
  onChangeUserName,
  messages,
  onUpdateMessages,
  budgetContext,
  expenses,
  onRegisterExpense,
  onUpdateExpense,
  onDeleteExpense,
}: AssistantDrawerProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<ChatMediaAttachment | null>(
    null
  );
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(userName);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef<boolean>(false);
  const recordingSecondsRef = useRef<number>(0);

  useEffect(() => {
    setDraftName(userName);
  }, [userName]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen, pendingMedia]);

  useEffect(() => {
    if (!isRecording) return;
    const interval = window.setInterval(() => {
      setRecordingSeconds((prev) => {
        const next = prev + 1;
        recordingSecondsRef.current = next;
        return next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRecording]);

  const stopMediaStream = () => {
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen && isRecording) {
      discardRecordingRef.current = true;
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      stopMediaStream();
    }
  }, [isOpen, isRecording]);

  useEffect(() => {
    return () => {
      discardRecordingRef.current = true;
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        mediaRecorderRef.current.stop();
      }
      stopMediaStream();
    };
  }, []);

  const handleSaveName = () => {
    const cleaned = draftName.trim();
    if (cleaned) {
      onChangeUserName(cleaned);
    } else {
      setDraftName(userName);
    }
    setIsEditingName(false);
  };

  const handleFileSelected = async (
    e: ChangeEvent<HTMLInputElement>,
    kind: 'image' | 'audio'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setMediaError(null);

    if (file.size > MAX_MEDIA_BYTES) {
      setMediaError(
        'El archivo supera el límite de 10 MB. Intenta con uno más liviano.'
      );
      return;
    }

    const mimeType =
      file.type || (kind === 'image' ? 'image/jpeg' : 'audio/mpeg');
    if (kind === 'image' && !mimeType.startsWith('image/')) {
      setMediaError('Por favor selecciona un archivo de imagen válido.');
      return;
    }
    if (kind === 'audio' && !mimeType.startsWith('audio/')) {
      setMediaError('Por favor selecciona un archivo de audio válido.');
      return;
    }

    try {
      const dataUrl = await readBlobAsDataUrl(file);
      const base64Data = stripDataUrlPrefix(dataUrl);
      setPendingMedia({
        kind,
        mimeType,
        data: base64Data,
        previewUrl: dataUrl,
        fileName: file.name,
      });
    } catch (err) {
      setMediaError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el archivo seleccionado.'
      );
    }
  };

  const startRecording = async () => {
    setMediaError(null);

    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function' ||
      typeof MediaRecorder === 'undefined'
    ) {
      setMediaError(
        'Tu navegador no admite grabación de audio. Puedes subir un archivo de audio usando el botón de archivo.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const candidateMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const supportedMime = candidateMimeTypes.find((type) =>
        MediaRecorder.isTypeSupported(type)
      );

      const recorder = supportedMime
        ? new MediaRecorder(stream, { mimeType: supportedMime })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      discardRecordingRef.current = false;
      recordingSecondsRef.current = 0;
      setRecordingSeconds(0);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stopMediaStream();
        setIsRecording(false);

        if (discardRecordingRef.current) {
          audioChunksRef.current = [];
          return;
        }

        const chunks = audioChunksRef.current;
        if (chunks.length === 0) {
          setMediaError('No se capturó audio en la grabación.');
          return;
        }

        const rawMime = recorder.mimeType || supportedMime || 'audio/webm';
        const blob = new Blob(chunks, { type: rawMime });

        if (blob.size > MAX_MEDIA_BYTES) {
          setMediaError(
            'La nota de voz supera los 10 MB. Graba un mensaje más corto.'
          );
          return;
        }

        try {
          const dataUrl = await readBlobAsDataUrl(blob);
          const base64Data = stripDataUrlPrefix(dataUrl);
          setPendingMedia({
            kind: 'audio',
            mimeType: rawMime,
            data: base64Data,
            previewUrl: dataUrl,
            fileName: 'Nota de voz',
            durationLabel: formatDuration(
              Math.max(1, recordingSecondsRef.current)
            ),
          });
        } catch (err) {
          setMediaError(
            err instanceof Error
              ? err.message
              : 'No se pudo procesar la nota de voz.'
          );
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      stopMediaStream();
      const msg =
        err instanceof Error &&
        /Permission|NotAllowed|denied/i.test(err.name + ' ' + err.message)
          ? 'Permiso de micrófono denegado. Habilita el micrófono o sube un archivo de audio.'
          : 'No se pudo acceder al micrófono. Verifica tu dispositivo o sube un archivo de audio.';
      setMediaError(msg);
    }
  };

  const stopRecording = (discard: boolean) => {
    discardRecordingRef.current = discard;
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    } else {
      stopMediaStream();
      setIsRecording(false);
    }
  };

  const sendMessage = async (
    textToSend: string,
    overrideMedia?: ChatMediaAttachment | null
  ) => {
    const trimmed = textToSend.trim();
    const mediaToSend =
      overrideMedia !== undefined ? overrideMedia : pendingMedia;

    if ((!trimmed && !mediaToSend) || isLoading || isRecording) return;

    setMediaError(null);

    const userMsg: ChatMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      media: mediaToSend ?? undefined,
    };

    const historyForApi = messages
      .filter((m) => !m.isError)
      .slice(-8)
      .map((m) => ({
        role: m.role,
        text:
          m.text.trim() ||
          (m.media?.kind === 'image'
            ? '[Recibo o imagen de gasto adjunta]'
            : '[Nota de voz adjunta]'),
      }));

    onUpdateMessages((prev) => [...prev, userMsg]);
    setInput('');
    if (overrideMedia === undefined) {
      setPendingMedia(null);
    }
    setIsLoading(true);

    try {
      const sortedExpenses = [...expenses]
        .sort(
          (a, b) =>
            b.day - a.day || (b.createdAt ?? 0) - (a.createdAt ?? 0)
        )
        .slice(0, 80)
        .map((exp) => ({
          id: exp.id,
          concept: exp.concept,
          amount: exp.amount,
          category: exp.category,
          day: exp.day,
          dateIso: `${budgetContext.monthId}-${String(exp.day).padStart(
            2,
            '0'
          )}`,
          dateLabel: exp.dateLabel,
          notes: exp.notes,
        }));

      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: historyForApi,
          budgetContext: {
            ...budgetContext,
            expenses: sortedExpenses,
            userName: userName.trim() || 'Carlos',
            currentDateIso: getTodayIsoDate(),
          },
          media: mediaToSend
            ? {
                kind: mediaToSend.kind,
                mimeType: mediaToSend.mimeType,
                data: mediaToSend.data,
                fileName: mediaToSend.fileName,
              }
            : undefined,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        text?: string;
        functionCalls?: ServerFunctionCall[];
        transcript?: string;
        error?: string;
        status?: number;
      };

      if (!response.ok) {
        const statusCode = data.status ?? response.status;
        let friendlyError: string;

        if (statusCode === 503) {
          friendlyError =
            'El asistente está muy solicitado en este momento. Por favor, intenta de nuevo en un minuto.';
        } else if (statusCode === 429) {
          friendlyError =
            'He alcanzado mi límite de mensajes por ahora. Intenta de nuevo más tarde.';
        } else {
          friendlyError =
            data.error ||
            `Error del servidor (${statusCode}) al procesar la solicitud.`;
        }

        onUpdateMessages((prev) => [
          ...prev,
          {
            id: `msg-err-${Date.now()}`,
            role: 'assistant',
            text: friendlyError,
            isError: true,
          },
        ]);
        return;
      }

      let registeredSummary: AssistantRegisteredExpenseSummary | undefined;
      const expenseActions: AssistantExpenseActionSummary[] = [];
      let workingExpenses = [...expenses];
      let hadUnmatchedTarget = false;

      if (Array.isArray(data.functionCalls) && data.functionCalls.length > 0) {
        for (const fc of data.functionCalls) {
          if (fc.name === 'registerExpense' && fc.args) {
            const rawAmount = Number(fc.args.amount);
            const amount =
              Number.isFinite(rawAmount) && rawAmount > 0
                ? Math.round(rawAmount)
                : 0;
            const dateStr =
              typeof fc.args.date === 'string' &&
              /^\d{4}-\d{2}-\d{2}$/.test(fc.args.date)
                ? fc.args.date
                : getTodayIsoDate();
            const description =
              typeof fc.args.description === 'string' &&
              fc.args.description.trim().length > 0
                ? fc.args.description.trim()
                : 'Gasto registrado';
            const category = normalizeExpenseCategory(fc.args.category);

            if (amount > 0) {
              const { day, dateLabel, fullDateLabel } =
                formatIsoDateLabels(dateStr);
              const clampedDay = Math.max(
                1,
                Math.min(budgetContext.totalDays, day)
              );
              const now = new Date();
              const hours = String(now.getHours()).padStart(2, '0');
              const minutes = String(now.getMinutes()).padStart(2, '0');

              const newExpense: ExpenseRecord = {
                id: `ai-exp-${Date.now()}-${expenseActions.length}`,
                kind: 'expense',
                day: clampedDay,
                dateLabel,
                fullDateLabel,
                timeLabel: `${hours}:${minutes}`,
                category,
                concept: description,
                notes: 'Registrado mediante asistente inteligente',
                amount,
                createdAt: Date.now(),
              };

              onRegisterExpense(newExpense);
              workingExpenses = [newExpense, ...workingExpenses];
              registeredSummary = {
                amount,
                date: dateStr,
                description,
                category,
              };
              expenseActions.push({
                type: 'registered',
                id: newExpense.id,
                amount,
                date: dateStr,
                description,
                category,
              });
            }
          } else if (fc.name === 'updateExpense' && fc.args) {
            const targetId =
              typeof fc.args.expenseId === 'string'
                ? fc.args.expenseId.trim()
                : '';
            const target = workingExpenses.find((e) => e.id === targetId);

            if (!target) {
              hadUnmatchedTarget = true;
              continue;
            }

            const rawAmount = Number(fc.args.amount);
            const nextAmount =
              Number.isFinite(rawAmount) && rawAmount > 0
                ? Math.round(rawAmount)
                : target.amount;

            const nextConcept =
              typeof fc.args.description === 'string' &&
              fc.args.description.trim().length > 0
                ? fc.args.description.trim()
                : target.concept;

            const nextCategory =
              typeof fc.args.category === 'string' &&
              fc.args.category.trim().length > 0
                ? normalizeExpenseCategory(fc.args.category)
                : target.category;

            const nextNotes =
              typeof fc.args.notes === 'string'
                ? fc.args.notes.trim() || undefined
                : target.notes;

            let nextDay = target.day;
            let nextDateLabel = target.dateLabel;
            let nextFullDateLabel = target.fullDateLabel;
            let nextDateIso = `${budgetContext.monthId}-${String(
              target.day
            ).padStart(2, '0')}`;

            if (
              typeof fc.args.date === 'string' &&
              /^\d{4}-\d{2}-\d{2}$/.test(fc.args.date)
            ) {
              const parsed = formatIsoDateLabels(fc.args.date);
              nextDay = Math.max(
                1,
                Math.min(budgetContext.totalDays, parsed.day)
              );
              const clampedIso = `${fc.args.date.slice(0, 8)}${String(
                nextDay
              ).padStart(2, '0')}`;
              const rebuilt = formatIsoDateLabels(clampedIso);
              nextDateLabel = rebuilt.dateLabel;
              nextFullDateLabel = rebuilt.fullDateLabel;
              nextDateIso = clampedIso;
            }

            const updatedExpense: ExpenseRecord = {
              ...target,
              kind: 'expense',
              amount: nextAmount,
              concept: nextConcept,
              category: nextCategory,
              notes: nextNotes,
              day: nextDay,
              dateLabel: nextDateLabel,
              fullDateLabel: nextFullDateLabel,
            };

            onUpdateExpense(updatedExpense);
            workingExpenses = workingExpenses.map((item) =>
              item.id === updatedExpense.id ? updatedExpense : item
            );
            expenseActions.push({
              type: 'updated',
              id: updatedExpense.id,
              amount: nextAmount,
              date: nextDateIso,
              description: nextConcept,
              category: nextCategory,
              previousAmount: target.amount,
              previousDescription: target.concept,
            });
          } else if (fc.name === 'deleteExpense' && fc.args) {
            const targetId =
              typeof fc.args.expenseId === 'string'
                ? fc.args.expenseId.trim()
                : '';
            const target = workingExpenses.find((e) => e.id === targetId);

            if (!target) {
              hadUnmatchedTarget = true;
              continue;
            }

            const targetDateIso = `${budgetContext.monthId}-${String(
              target.day
            ).padStart(2, '0')}`;

            onDeleteExpense(target);
            workingExpenses = workingExpenses.filter(
              (item) => item.id !== target.id
            );
            expenseActions.push({
              type: 'deleted',
              id: target.id,
              amount: target.amount,
              date: targetDateIso,
              description: target.concept,
              category: target.category,
            });
          }
        }
      }

      const activeName = userName.trim() || 'Carlos';
      const primaryAction = expenseActions[0];
      let assistantText = data.text ? data.text.trim() : '';

      if (hadUnmatchedTarget && expenseActions.length === 0) {
        assistantText = `Lo siento, ${activeName}, no encontré ese gasto en el mes activo (${budgetContext.monthLabel} ${budgetContext.year}). ¿Puedes indicarme cuál gasto de la lista deseas modificar o eliminar?`;
      } else if (!assistantText && primaryAction) {
        if (primaryAction.type === 'registered') {
          assistantText = `¡Listo, ${activeName}! He guardado tu gasto de ${
            primaryAction.description
          } por ${formatCOP(primaryAction.amount)}.`;
        } else if (primaryAction.type === 'updated') {
          assistantText = `¡Listo, ${activeName}! He actualizado el gasto "${
            primaryAction.description
          }" a ${formatCOP(primaryAction.amount)}.`;
        } else if (primaryAction.type === 'deleted') {
          assistantText = `¡Listo, ${activeName}! He eliminado el gasto "${
            primaryAction.description
          }" por ${formatCOP(primaryAction.amount)}.`;
        }
      } else if (!assistantText) {
        assistantText = 'No recibí contenido de respuesta.';
      }

      onUpdateMessages((prev) => [
        ...prev,
        {
          id: `msg-a-${Date.now()}`,
          role: 'assistant',
          text: assistantText,
          transcript: data.transcript,
          registeredExpense: registeredSummary,
          expenseActions:
            expenseActions.length > 0 ? expenseActions : undefined,
        },
      ]);
    } catch (err) {
      const technicalMsg =
        err instanceof Error
          ? err.message
          : 'Error de red al conectar con el servidor.';
      onUpdateMessages((prev) => [
        ...prev,
        {
          id: `msg-net-${Date.now()}`,
          role: 'assistant',
          text: technicalMsg,
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="asistente-titulo"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0B1739]/35 backdrop-blur-[2px]"
          />

          {/* Slide-over Drawer Panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md bg-white h-full flex flex-col shadow-2xl border-l border-slate-200/80"
          >
            {/* Header */}
            <div className="bg-[#0B1739] text-white px-6 py-4 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#5B3DF5] text-white flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="asistente-titulo"
                    className="text-base font-display font-bold tracking-tight truncate"
                  >
                    Asistente Financiero
                  </h2>
                  <p className="text-xs text-slate-300 truncate tabular-cop">
                    Disponible: {formatCOP(budgetContext.availableBalance)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar asistente"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Dynamic Context Bar: User Name & Current Date */}
            <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between gap-2 text-xs text-slate-600 shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <User
                  className="w-3.5 h-3.5 text-[#5B3DF5] shrink-0"
                  aria-hidden="true"
                />
                {isEditingName ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveName();
                        } else if (e.key === 'Escape') {
                          setDraftName(userName);
                          setIsEditingName(false);
                        }
                      }}
                      autoFocus
                      maxLength={30}
                      aria-label="Tu nombre"
                      className="w-28 px-2 py-0.5 text-xs bg-white border border-[#5B3DF5] rounded-md text-[#0B1739] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveName}
                      aria-label="Guardar nombre"
                      className="p-1 rounded-md bg-[#5B3DF5] text-white hover:bg-[#492CE0] cursor-pointer"
                    >
                      <Check className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingName(true)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B1739] hover:text-[#5B3DF5] transition-colors cursor-pointer truncate"
                    title="Cambiar nombre"
                  >
                    <span className="truncate">{userName}</span>
                    <Pencil className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                  </button>
                )}
              </div>

              <span className="text-[11px] text-slate-500 tabular-cop shrink-0">
                Hoy: {getTodayIsoDate()}
              </span>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-[#F3F6FB]/70">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      isUser ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${
                        isUser
                          ? 'bg-[#5B3DF5] text-white rounded-br-md'
                          : msg.isError
                          ? 'bg-rose-50 border border-rose-200 text-rose-800 rounded-bl-md'
                          : 'bg-white border border-slate-200/80 text-[#0B1739] rounded-bl-md'
                      }`}
                    >
                      {msg.isError && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 mb-1">
                          <AlertCircle
                            className="w-3.5 h-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          <span>Aviso del servicio</span>
                        </div>
                      )}

                      {/* Attached Image in User Bubble */}
                      {msg.media?.kind === 'image' && (
                        <div className="mb-2 overflow-hidden rounded-xl border border-white/20 bg-black/10">
                          <img
                            src={msg.media.previewUrl}
                            alt={msg.media.fileName || 'Recibo o captura'}
                            className="max-h-48 w-full object-cover"
                          />
                        </div>
                      )}

                      {/* Attached Audio in User Bubble */}
                      {msg.media?.kind === 'audio' && (
                        <div className="mb-2 rounded-xl bg-white/15 px-3 py-2 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-white/95">
                            <Volume2
                              className="w-3.5 h-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span className="truncate">
                              {msg.media.fileName || 'Nota de voz'}
                              {msg.media.durationLabel
                                ? ` · ${msg.media.durationLabel}`
                                : ''}
                            </span>
                          </div>
                          <audio
                            controls
                            src={msg.media.previewUrl}
                            className="h-8 w-full max-w-[230px]"
                          />
                        </div>
                      )}

                      {/* Voice Note Transcription Badge in Assistant Reply */}
                      {msg.transcript && (
                        <div className="mb-2.5 rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2 text-xs text-slate-600">
                          <span className="font-semibold text-[#0B1739]">
                            Transcripción:{' '}
                          </span>
                          <span className="italic">“{msg.transcript}”</span>
                        </div>
                      )}

                      {msg.text && (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      )}

                      {msg.expenseActions && msg.expenseActions.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {msg.expenseActions.map((action, idx) => {
                            if (action.type === 'updated') {
                              return (
                                <div
                                  key={`${action.id ?? 'upd'}-${idx}`}
                                  className="rounded-xl bg-[#5B3DF5]/8 border border-[#5B3DF5]/25 p-3 text-[#0B1739]"
                                >
                                  <div className="flex items-center gap-2 text-xs font-bold text-[#5B3DF5]">
                                    <Pencil
                                      className="w-3.5 h-3.5 shrink-0"
                                      aria-hidden="true"
                                    />
                                    <span>Gasto actualizado en tu dashboard</span>
                                  </div>
                                  <div className="mt-1.5 text-xs space-y-0.5 tabular-cop text-[#0B1739]">
                                    <p className="font-semibold">
                                      {action.description} ·{' '}
                                      {formatCOP(action.amount)}
                                    </p>
                                    <p className="text-slate-600">
                                      {action.category} · {action.date}
                                    </p>
                                  </div>
                                </div>
                              );
                            }

                            if (action.type === 'deleted') {
                              return (
                                <div
                                  key={`${action.id ?? 'del'}-${idx}`}
                                  className="rounded-xl bg-rose-50 border border-rose-200/80 p-3 text-rose-950"
                                >
                                  <div className="flex items-center gap-2 text-xs font-bold text-rose-700">
                                    <Trash2
                                      className="w-3.5 h-3.5 text-rose-600 shrink-0"
                                      aria-hidden="true"
                                    />
                                    <span>Gasto eliminado de tu dashboard</span>
                                  </div>
                                  <div className="mt-1.5 text-xs space-y-0.5 tabular-cop text-rose-900">
                                    <p className="font-semibold line-through">
                                      {action.description} ·{' '}
                                      {formatCOP(action.amount)}
                                    </p>
                                    <p className="text-rose-700">
                                      {action.category} · {action.date}
                                    </p>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={`${action.id ?? 'reg'}-${idx}`}
                                className="rounded-xl bg-emerald-50 border border-emerald-200/80 p-3 text-emerald-950"
                              >
                                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                                  <CheckCircle2
                                    className="w-4 h-4 text-emerald-600 shrink-0"
                                    aria-hidden="true"
                                  />
                                  <span>Gasto registrado en tu dashboard</span>
                                </div>
                                <div className="mt-1.5 text-xs space-y-0.5 tabular-cop text-emerald-900">
                                  <p className="font-semibold">
                                    {action.description} ·{' '}
                                    {formatCOP(action.amount)}
                                  </p>
                                  <p className="text-emerald-700">
                                    {action.category} · {action.date}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        msg.registeredExpense && (
                          <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200/80 p-3 text-emerald-950">
                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                              <CheckCircle2
                                className="w-4 h-4 text-emerald-600 shrink-0"
                                aria-hidden="true"
                              />
                              <span>Gasto registrado en tu dashboard</span>
                            </div>
                            <div className="mt-1.5 text-xs space-y-0.5 tabular-cop text-emerald-900">
                              <p className="font-semibold">
                                {msg.registeredExpense.description} ·{' '}
                                {formatCOP(msg.registeredExpense.amount)}
                              </p>
                              <p className="text-emerald-700">
                                {msg.registeredExpense.category} ·{' '}
                                {msg.registeredExpense.date}
                              </p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Typing / Cascading Models Indicator */}
              {isLoading && (
                <div className="flex items-start">
                  <div className="bg-white border border-slate-200/80 rounded-2xl rounded-bl-md px-4 py-3 shadow-xs flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">
                      escribiendo
                    </span>
                    <span
                      className="inline-flex items-center gap-1"
                      aria-hidden="true"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5B3DF5] animate-bounce [animation-delay:-0.25s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5B3DF5] animate-bounce [animation-delay:-0.12s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5B3DF5] animate-bounce" />
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestion Chips */}
            <div className="px-5 pt-3 pb-2 bg-white border-t border-slate-100 flex flex-wrap gap-1.5 shrink-0">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={isLoading || isRecording}
                  onClick={() => void sendMessage(prompt, null)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-[#5B3DF5]/10 hover:text-[#5B3DF5] text-[11px] font-medium text-slate-600 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>{prompt}</span>
                </button>
              ))}
            </div>

            {/* Media Error Banner */}
            {mediaError && (
              <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AlertCircle
                    className="w-3.5 h-3.5 text-rose-600 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="truncate">{mediaError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMediaError(null)}
                  aria-label="Cerrar aviso"
                  className="text-rose-600 hover:text-rose-900 shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Pending Media Attachment Preview */}
            {pendingMedia && !isRecording && (
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
                {pendingMedia.kind === 'image' ? (
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={pendingMedia.previewUrl}
                      alt="Vista previa del recibo"
                      className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#0B1739] truncate">
                        {pendingMedia.fileName || 'Imagen adjunta'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Ticket / recibo listo para analizar
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-lg bg-[#5B3DF5]/10 text-[#5B3DF5] flex items-center justify-center shrink-0">
                      <Volume2 className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-[#0B1739] truncate">
                        {pendingMedia.fileName || 'Audio adjunto'}
                        {pendingMedia.durationLabel
                          ? ` · ${pendingMedia.durationLabel}`
                          : ''}
                      </p>
                      <audio
                        controls
                        src={pendingMedia.previewUrl}
                        className="h-7 w-full max-w-[230px] mt-0.5"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setPendingMedia(null)}
                  aria-label="Quitar archivo adjunto"
                  className="w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-rose-600 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Hidden File Inputs */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleFileSelected(e, 'image')}
            />
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => void handleFileSelected(e, 'audio')}
            />

            {/* Input Form or Live Recording Controls */}
            {isRecording ? (
              <div className="p-4 bg-rose-50/70 border-t border-rose-200/80 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse shrink-0" />
                  <span className="text-xs font-semibold text-rose-900">
                    Grabando nota de voz...
                  </span>
                  <span className="text-xs font-mono font-bold text-rose-700 tabular-cop">
                    {formatDuration(recordingSeconds)}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => stopRecording(true)}
                    aria-label="Cancelar grabación"
                    className="h-9 px-3 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => stopRecording(false)}
                    aria-label="Detener grabación"
                    className="h-9 px-3.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Square className="w-3 h-3 fill-current" aria-hidden="true" />
                    <span>Listo</span>
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="p-3.5 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0"
              >
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => imageInputRef.current?.click()}
                    title="Subir recibo, ticket o imagen"
                    aria-label="Subir recibo, ticket o imagen"
                    className="w-9 h-9 rounded-full bg-slate-100 hover:bg-[#5B3DF5]/10 text-slate-600 hover:text-[#5B3DF5] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <ImagePlus className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => audioInputRef.current?.click()}
                    title="Subir nota de voz o audio"
                    aria-label="Subir nota de voz o audio"
                    className="w-9 h-9 rounded-full bg-slate-100 hover:bg-[#5B3DF5]/10 text-slate-600 hover:text-[#5B3DF5] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <FileAudio className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => void startRecording()}
                    title="Grabar nota de voz"
                    aria-label="Grabar nota de voz"
                    className="w-9 h-9 rounded-full bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <Mic className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isLoading}
                  placeholder={
                    pendingMedia
                      ? 'Agrega un comentario opcional...'
                      : 'Escribe, sube foto o graba voz...'
                  }
                  aria-label="Escribe tu gasto o consulta"
                  className="flex-1 min-w-0 px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-full text-[#0B1739] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#5B3DF5]/20 focus:border-[#5B3DF5] disabled:opacity-60"
                />

                <button
                  type="submit"
                  disabled={isLoading || (!input.trim() && !pendingMedia)}
                  aria-label="Enviar mensaje"
                  className="w-9 h-9 rounded-full bg-[#5B3DF5] hover:bg-[#492CE0] text-white flex items-center justify-center shadow-sm transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                </button>
              </form>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

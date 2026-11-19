import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  FunctionDeclaration,
  GoogleGenAI,
  Type,
  type Content,
  type GenerateContentResponse,
} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

// Prioritized active models cascade (skipping deprecated models)
const MODEL_CASCADE: string[] = [
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
];

const registerExpenseDeclaration: FunctionDeclaration = {
  name: 'registerExpense',
  description:
    'Registra un gasto personal en pesos colombianos (COP) dentro del presupuesto mensual del usuario.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      amount: {
        type: Type.NUMBER,
        description:
          'Valor numérico del gasto en pesos colombianos (COP), mayor que cero. Ejemplo: 25000 o 500.',
      },
      date: {
        type: Type.STRING,
        description:
          'Fecha del gasto en formato estricto YYYY-MM-DD. Si el usuario dice "hoy", usa la fecha actual indicada en el contexto.',
      },
      description: {
        type: Type.STRING,
        description:
          'Descripción breve y clara del gasto o comercio. Ejemplo: "Almuerzo", "Comida", "Taxi", "Factura de luz".',
      },
      category: {
        type: Type.STRING,
        description:
          'Categoría del gasto. Debe ser exactamente una de: "Alimentación", "Transporte", "Servicios públicos", "Ropa y compras personales", "Entretenimiento y ocio".',
      },
    },
    required: ['amount', 'date', 'description', 'category'],
  },
};

const updateExpenseDeclaration: FunctionDeclaration = {
  name: 'updateExpense',
  description:
    'Edita o actualiza un gasto existente del mes activo en pesos colombianos (COP). Debes usar exactamente el expenseId de un gasto presente en la lista del contexto.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      expenseId: {
        type: Type.STRING,
        description:
          'ID exacto del gasto existente a modificar, obtenido de la lista de gastos del contexto.',
      },
      amount: {
        type: Type.NUMBER,
        description:
          'Nuevo valor numérico del gasto en COP mayor que cero (inclúyelo solo si se modifica).',
      },
      date: {
        type: Type.STRING,
        description:
          'Nueva fecha del gasto en formato estricto YYYY-MM-DD (inclúyela solo si se modifica).',
      },
      description: {
        type: Type.STRING,
        description:
          'Nueva descripción o concepto del gasto (inclúyela solo si se modifica).',
      },
      category: {
        type: Type.STRING,
        description:
          'Nueva categoría del gasto. Debe ser exactamente una de: "Alimentación", "Transporte", "Servicios públicos", "Ropa y compras personales", "Entretenimiento y ocio" (inclúyela solo si se modifica).',
      },
      notes: {
        type: Type.STRING,
        description:
          'Nueva nota u observación adicional del gasto. Pasa "" para borrar la nota actual (inclúyela solo si se modifica).',
      },
    },
    required: ['expenseId'],
  },
};

const deleteExpenseDeclaration: FunctionDeclaration = {
  name: 'deleteExpense',
  description:
    'Elimina un gasto existente del presupuesto del mes activo. Debes usar exactamente el expenseId de un gasto presente en la lista del contexto.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      expenseId: {
        type: Type.STRING,
        description:
          'ID exacto del gasto existente a eliminar, obtenido de la lista de gastos del contexto.',
      },
      description: {
        type: Type.STRING,
        description: 'Concepto del gasto eliminado para confirmar al usuario.',
      },
      amount: {
        type: Type.NUMBER,
        description: 'Monto en COP del gasto eliminado para confirmar al usuario.',
      },
    },
    required: ['expenseId'],
  },
};

interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface ExpenseSummaryContext {
  id: string;
  concept: string;
  amount: number;
  category: string;
  day: number;
  dateIso: string;
  dateLabel: string;
  notes?: string;
}

interface BudgetContextPayload {
  userName?: string;
  monthId?: string;
  monthLabel?: string;
  year?: number;
  totalDays?: number;
  currentDateIso?: string;
  effectiveBudget?: number;
  totalSpent?: number;
  availableBalance?: number;
  expenseCount?: number;
  expenses?: ExpenseSummaryContext[];
}

interface MediaPayload {
  kind: 'image' | 'audio';
  mimeType: string;
  data: string;
  fileName?: string;
}

interface ExtractedFunctionCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

function extractHttpStatus(err: unknown): number {
  if (!err || typeof err !== 'object') return 500;
  const record = err as Record<string, unknown>;

  for (const key of ['status', 'statusCode', 'code']) {
    const val = record[key];
    if (typeof val === 'number' && val >= 400 && val < 600) {
      return val;
    }
    if (typeof val === 'string') {
      const parsed = parseInt(val, 10);
      if (!Number.isNaN(parsed) && parsed >= 400 && parsed < 600) {
        return parsed;
      }
    }
  }

  const msg = typeof record.message === 'string' ? record.message : '';
  if (/\b429\b|RESOURCE_EXHAUSTED|quota/i.test(msg)) return 429;
  if (/\b503\b|UNAVAILABLE|overloaded|high demand/i.test(msg)) return 503;
  if (/\b404\b|NOT_FOUND/i.test(msg)) return 404;
  if (/\b403\b|PERMISSION_DENIED/i.test(msg)) return 403;
  if (/\b400\b|INVALID_ARGUMENT|API_KEY_INVALID/i.test(msg)) return 400;

  return 500;
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string') return err;
  return 'Error desconocido al consultar el servicio de IA.';
}

function extractPartsFromResponse(response: GenerateContentResponse): {
  text: string;
  functionCalls: ExtractedFunctionCall[];
} {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const textSegments: string[] = [];
  const functionCalls: ExtractedFunctionCall[] = [];

  for (const part of parts) {
    const p = part as unknown as {
      text?: string;
      thought?: boolean;
      functionCall?: {
        id?: string;
        name?: string;
        args?: Record<string, unknown>;
      };
    };

    if (typeof p.text === 'string' && !p.thought) {
      textSegments.push(p.text);
    }

    if (p.functionCall && typeof p.functionCall.name === 'string') {
      functionCalls.push({
        id: p.functionCall.id,
        name: p.functionCall.name,
        args: p.functionCall.args ?? {},
      });
    }
  }

  return {
    text: textSegments.join('').trim(),
    functionCalls,
  };
}

function formatCopServer(amount: number): string {
  const rounded = Math.round(Math.abs(amount));
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$${formatted} COP`;
}

function buildSystemInstruction(ctx: BudgetContextPayload): string {
  const userName =
    typeof ctx.userName === 'string' && ctx.userName.trim().length > 0
      ? ctx.userName.trim()
      : 'Usuario';
  const todayIso = ctx.currentDateIso || '2026-11-17';
  const monthLabel = ctx.monthLabel || 'Noviembre';
  const year = ctx.year || 2026;
  const budget = ctx.effectiveBudget ?? 2500000;
  const spent = ctx.totalSpent ?? 0;
  const available = ctx.availableBalance ?? budget - spent;
  const count = ctx.expenseCount ?? 0;
  const expensesList = Array.isArray(ctx.expenses) ? ctx.expenses : [];

  const formattedExpenses =
    expensesList.length > 0
      ? expensesList
          .slice(0, 80)
          .map(
            (exp) =>
              `  * id="${exp.id}" | fecha=${exp.dateIso} (${exp.dateLabel}) | concepto="${exp.concept}" | categoria="${exp.category}" | monto=${formatCopServer(
                exp.amount
              )}${exp.notes ? ` | nota="${exp.notes}"` : ''}`
          )
          .join('\n')
      : '  * (No hay gastos registrados en este mes todavía.)';

  return [
    'Eres el asistente financiero integrado en "Mi Presupuesto Mensual".',
    'Sé breve, amable, claro y experto en finanzas personales en pesos colombianos (COP).',
    `Fecha actual de referencia: ${todayIso}. Mes activo en el dashboard: ${monthLabel} ${year}.`,
    `Estado actual del presupuesto del usuario: Presupuesto total = ${formatCopServer(
      budget
    )}, Total gastado = ${formatCopServer(
      spent
    )} (${count} gastos), Saldo disponible = ${formatCopServer(available)}.`,
    'Reglas de uso de herramientas:',
    '- Cuando el usuario indique que gastó o pagó dinero (por ejemplo: "Gasté 500 en comida hoy" o "Pagué 18.000 de taxi"), llama inmediatamente a la función registerExpense con los parámetros exactos: amount (número), date (YYYY-MM-DD), description (string) y category (una de: "Alimentación", "Transporte", "Servicios públicos", "Ropa y compras personales", "Entretenimiento y ocio").',
    '- Si el usuario pregunta cuánto le queda disponible o pide consejo sobre su presupuesto, responde con base en los montos reales entregados arriba.',
    '- Después de invocar registerExpense (o junto con la llamada), confirma brevemente los datos registrados (monto, descripción, categoría y fecha).',
    'Extensiones multimodales y reglas adicionales:',
    `- Nombre del usuario actual: ${userName}.`,
    '- Contexto Dinámico: Siempre utiliza la fecha actual, el nombre del usuario y el saldo disponible proporcionados en cada mensaje.',
    '- Imagen (ticket, recibo, captura de compra o apunte de gasto): Extrae monto, fecha y descripción. Si la imagen es borrosa, algún dato no se ve, está dudoso o falta información, pregunta al usuario antes de guardar; NO inventes datos ni información.',
    '- Audio (nota de voz grabada o cargada): Transcribe el audio y extrae monto, fecha y descripción. Si falta algún dato o no está claro, pregunta al usuario y solicita aclaración antes de guardar; NO inventes datos.',
    '- Validación de dominio: Si la imagen, el audio o el archivo no tiene que ver con gastos o finanzas personales, indica claramente que no puedes procesarlo.',
    '- Reglas de registro y respuesta:',
    '  * Usa siempre la herramienta registerExpense para guardar datos confirmados (nunca guardes si falta un dato obligatorio como monto o descripción, o si la fecha es dudosa).',
    `  * Al finalizar un registro, dirígete al usuario por su nombre (ej: "¡Listo, ${userName}! He guardado tu gasto...").`,
    `  * Para consultas de compras, compara el gasto solicitado con el saldo disponible actual (${formatCopServer(
      available
    )}) e indica si le alcanza y cuánto saldo quedaría.`,
    'Gestión (edición y eliminación) de gastos registrados:',
    `- Gastos registrados actualmente en ${monthLabel} ${year}:`,
    formattedExpenses,
    '- Cuando el usuario pida editar, corregir o actualizar un gasto existente (monto, concepto, categoría, fecha o nota), identifica el gasto en la lista anterior y llama a updateExpense usando exactamente su `id` como `expenseId`, enviando los campos que deban actualizarse.',
    '- Cuando el usuario pida borrar o eliminar un gasto existente, identifica el gasto en la lista anterior y llama a deleteExpense usando exactamente su `id` como `expenseId`.',
    '- Nunca inventes ni supongas un `expenseId`. Si no existe ningún gasto coincidente en la lista, infórmaselo amablemente al usuario. Si existen varios gastos parecidos y hay ambigüedad (por ejemplo, dos gastos con el mismo concepto en distintas fechas o montos), enumera las opciones (concepto, monto y fecha) y pregúntale al usuario cuál desea editar o eliminar antes de ejecutar el cambio.',
    '- Si el usuario pregunta cuáles gastos tiene registrados este mes, lístalos de forma clara y amigable (concepto, monto, categoría y fecha) sin mostrar identificadores internos técnicos.',
    `- Tras ejecutar updateExpense o deleteExpense, confirma brevemente al usuario por su nombre (${userName}) el resultado y cómo queda su presupuesto.`,
  ].join('\n');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.post('/api/assistant/chat', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(500).json({
        error:
          'GEMINI_API_KEY no está configurada en el servidor. Configúrala en Settings > Secrets.',
        status: 500,
      });
      return;
    }

    const body = (req.body ?? {}) as {
      message?: string;
      history?: ChatHistoryMessage[];
      budgetContext?: BudgetContextPayload;
      media?: MediaPayload;
    };

    const userMessage =
      typeof body.message === 'string' ? body.message.trim() : '';
    const rawMedia = body.media;
    const hasValidMedia =
      rawMedia &&
      (rawMedia.kind === 'image' || rawMedia.kind === 'audio') &&
      typeof rawMedia.mimeType === 'string' &&
      rawMedia.mimeType.trim().length > 0 &&
      typeof rawMedia.data === 'string' &&
      rawMedia.data.trim().length > 0;

    if (!userMessage && !hasValidMedia) {
      res.status(400).json({
        error: 'El mensaje o archivo multimedia no puede estar vacío.',
        status: 400,
      });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const ctx = body.budgetContext ?? {};
    const userName =
      typeof ctx.userName === 'string' && ctx.userName.trim().length > 0
        ? ctx.userName.trim()
        : 'Usuario';
    const todayIso = ctx.currentDateIso || '2026-11-17';
    const available =
      typeof ctx.availableBalance === 'number'
        ? ctx.availableBalance
        : (ctx.effectiveBudget ?? 2500000) - (ctx.totalSpent ?? 0);

    const historyItems = Array.isArray(body.history)
      ? body.history.slice(-10)
      : [];

    const userParts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [];

    let audioTranscript: string | undefined;

    if (hasValidMedia && rawMedia) {
      const cleanBase64 = rawMedia.data
        .replace(/^data:[^;]+;base64,/, '')
        .trim();
      const cleanMimeType = rawMedia.mimeType.split(';')[0].trim();

      if (rawMedia.kind === 'image') {
        userParts.push({
          inlineData: {
            mimeType: cleanMimeType,
            data: cleanBase64,
          },
        });
        userParts.push({
          text:
            userMessage ||
            'Analiza esta imagen (ticket, recibo, captura de compra o apunte de gasto). Extrae monto, fecha y descripción. Si falta algún dato o está borroso, pregúntame antes de guardar. Si no es sobre gastos o finanzas, indícamelo.',
        });
      } else if (rawMedia.kind === 'audio') {
        try {
          const transcribeRes = await ai.models.generateContent({
            model: 'gemini-3.5-transcribe',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType: cleanMimeType,
                      data: cleanBase64,
                    },
                  },
                  {
                    text: 'Transcribe literalmente en español el contenido hablado de este audio. Si no contiene voz clara o trata de sonidos sin relación con finanzas, descríbelo brevemente.',
                  },
                ],
              },
            ],
          });
          const transcribed = extractPartsFromResponse(transcribeRes).text;
          if (transcribed) {
            audioTranscript = transcribed;
          }
        } catch (transcribeErr) {
          console.warn(
            '[Assistant] gemini-3.5-transcribe falló, usando audio inline en la cascada:',
            extractErrorMessage(transcribeErr)
          );
        }

        if (audioTranscript) {
          userParts.push({
            text: `Nota de voz transcrita: "${audioTranscript}"${
              userMessage ? `\nMensaje adicional del usuario: ${userMessage}` : ''
            }\nExtrae monto, fecha y descripción del gasto si aplica. Si falta algún dato o no está claro, pregunta antes de guardar. Si el audio no tiene que ver con gastos o finanzas, indica que no puedes procesarlo.`,
          });
        } else {
          userParts.push({
            inlineData: {
              mimeType: cleanMimeType,
              data: cleanBase64,
            },
          });
          userParts.push({
            text:
              userMessage ||
              'Transcribe esta nota de voz y extrae monto, fecha y descripción del gasto. Si falta algún dato o no está claro, pregunta antes de guardar. Si no trata sobre gastos o finanzas, indica que no puedes procesarlo.',
          });
        }
      }
    } else {
      userParts.push({ text: userMessage });
    }

    userParts.push({
      text: `[Contexto dinámico del turno -> Usuario: ${userName} | Fecha actual: ${todayIso} | Saldo disponible: ${formatCopServer(
        available
      )}]`,
    });

    const contents: Content[] = [
      ...historyItems.map((item) => ({
        role: item.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [
          {
            text:
              typeof item.text === 'string' && item.text.trim().length > 0
                ? item.text
                : '[Archivo multimedia adjunto]',
          },
        ],
      })),
      {
        role: 'user',
        parts: userParts,
      },
    ];

    const systemInstruction = buildSystemInstruction(ctx);

    let lastStatus = 500;
    let lastErrorMessage = 'No se pudo obtener respuesta del asistente.';
    const attemptedModels: string[] = [];

    for (const modelName of MODEL_CASCADE) {
      attemptedModels.push(modelName);
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            tools: [
              {
                functionDeclarations: [
                  registerExpenseDeclaration,
                  updateExpenseDeclaration,
                  deleteExpenseDeclaration,
                ],
              },
            ],
          },
        });

        const extracted = extractPartsFromResponse(response);

        let replyText = extracted.text;
        if (!replyText && extracted.functionCalls.length > 0) {
          const fc = extracted.functionCalls[0];
          const expensesList = Array.isArray(ctx.expenses) ? ctx.expenses : [];
          if (fc.name === 'registerExpense') {
            const amt = Number(fc.args.amount ?? 0);
            const desc = String(fc.args.description ?? 'Gasto');
            const cat = String(fc.args.category ?? 'Alimentación');
            const dt = String(fc.args.date ?? '');
            replyText = `¡Listo, ${userName}! He guardado tu gasto de ${formatCopServer(
              amt
            )} en "${desc}" (${cat}) para el ${dt}.`;
          } else if (fc.name === 'updateExpense') {
            const targetId = String(fc.args.expenseId ?? '');
            const target = expensesList.find((e) => e.id === targetId);
            const nextDesc =
              typeof fc.args.description === 'string' &&
              fc.args.description.trim()
                ? fc.args.description.trim()
                : target?.concept ?? 'Gasto';
            const nextAmt =
              typeof fc.args.amount === 'number' && fc.args.amount > 0
                ? fc.args.amount
                : target?.amount ?? 0;
            replyText = `¡Listo, ${userName}! He actualizado el gasto "${nextDesc}" a ${formatCopServer(
              nextAmt
            )}.`;
          } else if (fc.name === 'deleteExpense') {
            const targetId = String(fc.args.expenseId ?? '');
            const target = expensesList.find((e) => e.id === targetId);
            const desc =
              target?.concept ??
              (typeof fc.args.description === 'string'
                ? fc.args.description
                : 'Gasto');
            const amt =
              target?.amount ??
              (typeof fc.args.amount === 'number' ? fc.args.amount : 0);
            replyText =
              amt > 0
                ? `¡Listo, ${userName}! He eliminado el gasto "${desc}" por ${formatCopServer(
                    amt
                  )}.`
                : `¡Listo, ${userName}! He eliminado el gasto "${desc}".`;
          }
        }

        if (!replyText && extracted.functionCalls.length === 0) {
          replyText =
            'Recibí tu solicitud, pero no pude generar una respuesta clara. ¿Podrías darme más detalles?';
        }

        res.json({
          text: replyText,
          functionCalls: extracted.functionCalls,
          modelUsed: modelName,
          transcript: audioTranscript,
        });
        return;
      } catch (err) {
        const status = extractHttpStatus(err);
        const message = extractErrorMessage(err);
        lastStatus = status;
        lastErrorMessage = message;

        const isCascadeable = status === 429 || status === 503 || status === 404;
        if (isCascadeable) {
          console.warn(
            `[Assistant] Modelo ${modelName} falló con ${status}. Saltando al siguiente modelo...`
          );
          continue;
        }

        // Non-cascadeable error (e.g., 400 / 403 invalid key)
        res.status(status).json({
          error: message,
          status,
          attemptedModels,
        });
        return;
      }
    }

    // All models in cascade exhausted
    const finalStatus =
      lastStatus === 429 || lastStatus === 503 ? lastStatus : 500;
    res.status(finalStatus).json({
      error: lastErrorMessage,
      status: finalStatus,
      attemptedModels,
    });
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: {
          server: httpServer,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Mi Presupuesto Mensual server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

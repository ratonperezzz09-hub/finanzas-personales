import { useMemo, useState } from 'react';
import { BarChart3, ChevronDown, Plus } from 'lucide-react';
import {
  formatCompactCOP,
  formatCOP,
  formatPercent,
  type ExpenseRecord,
} from '../data/budgetData';

interface DailyExpensesChartProps {
  monthLabel: string;
  currentDay: number;
  monthlyBudget: number;
  totalSpent: number;
  expenses: ExpenseRecord[];
  selectedDay: number | null;
  onSelectDay: (day: number | null) => void;
  onRegisterFirstExpense: () => void;
}

type ChartMode = 'curve' | 'bars';

interface DayPoint {
  day: number;
  total: number;
  rollingAvg: number;
  items: ExpenseRecord[];
  fullDateLabel: string;
}

function buildSmoothCurvePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const tension = 0.22;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(
      1
    )} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

export function DailyExpensesChart({
  monthLabel,
  currentDay,
  monthlyBudget,
  totalSpent,
  expenses,
  selectedDay,
  onSelectDay,
  onRegisterFirstExpense,
}: DailyExpensesChartProps) {
  const [chartMode, setChartMode] = useState<ChartMode>('curve');
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const dailyPoints = useMemo<DayPoint[]>(() => {
    const grouped = new Map<number, ExpenseRecord[]>();
    for (const item of expenses) {
      const list = grouped.get(item.day) ?? [];
      list.push(item);
      grouped.set(item.day, list);
    }

    const rawTotals: number[] = [];
    for (let d = 1; d <= currentDay; d++) {
      const items = grouped.get(d) ?? [];
      rawTotals.push(items.reduce((sum, i) => sum + i.amount, 0));
    }

    const result: DayPoint[] = [];
    for (let d = 1; d <= currentDay; d++) {
      const items = grouped.get(d) ?? [];
      const total = rawTotals[d - 1];
      const windowStart = Math.max(0, d - 3);
      const windowSlice = rawTotals.slice(windowStart, d);
      const rollingAvg = Math.round(
        windowSlice.reduce((a, b) => a + b, 0) / windowSlice.length
      );
      result.push({
        day: d,
        total,
        rollingAvg,
        items,
        fullDateLabel:
          items[0]?.fullDateLabel ?? `${d} de ${monthLabel.toLowerCase()}`,
      });
    }
    return result;
  }, [expenses, currentDay, monthLabel]);

  const peakDay = useMemo(() => {
    return dailyPoints.reduce(
      (max, curr) => (curr.total > max.total ? curr : max),
      dailyPoints[0] ?? { day: 1, total: 0, rollingAvg: 0, items: [], fullDateLabel: '' }
    );
  }, [dailyPoints]);

  // Default focus point on chart when not hovering/selecting (last active day)
  const focusedDayNum =
    hoveredDay ?? selectedDay ?? dailyPoints[dailyPoints.length - 1]?.day ?? 1;
  const focusedPoint =
    dailyPoints.find((d) => d.day === focusedDayNum) ?? dailyPoints[0];

  const spentPct = monthlyBudget > 0 ? (totalSpent / monthlyBudget) * 100 : 0;

  // SVG layout
  const svgWidth = 640;
  const svgHeight = 235;
  const margin = { top: 34, right: 22, bottom: 32, left: 58 };
  const plotWidth = svgWidth - margin.left - margin.right;
  const plotHeight = svgHeight - margin.top - margin.bottom;

  const yMax = useMemo(() => {
    const rawMax = Math.max(...dailyPoints.map((d) => d.total), 50000);
    return Math.ceil(rawMax / 50000) * 50000;
  }, [dailyPoints]);

  const yTicks = useMemo(() => [0, yMax / 2, yMax], [yMax]);

  const getY = (val: number) =>
    margin.top + plotHeight - Math.min(1, Math.max(0, val / yMax)) * plotHeight;

  const getX = (day: number) => {
    if (dailyPoints.length <= 1) return margin.left + plotWidth / 2;
    return (
      margin.left + ((day - 1) / (dailyPoints.length - 1)) * plotWidth
    );
  };

  const primaryCoords = useMemo(
    () =>
      dailyPoints.map((d) => ({
        x: getX(d.day),
        y: getY(d.total),
      })),
    [dailyPoints, yMax]
  );

  const avgCoords = useMemo(
    () =>
      dailyPoints.map((d) => ({
        x: getX(d.day),
        y: getY(d.rollingAvg),
      })),
    [dailyPoints, yMax]
  );

  const primaryPath = useMemo(
    () => buildSmoothCurvePath(primaryCoords),
    [primaryCoords]
  );
  const avgPath = useMemo(
    () => buildSmoothCurvePath(avgCoords),
    [avgCoords]
  );

  const xTicks = useMemo(() => {
    if (currentDay <= 17) {
      return [1, 4, 7, 10, 13, 17];
    }
    return [1, 6, 12, 18, 24, currentDay];
  }, [currentDay]);

  const slotWidth = plotWidth / Math.max(1, dailyPoints.length);
  const barWidth = Math.max(8, Math.min(18, slotWidth * 0.6));

  // Tooltip coordinates for focused point
  const tooltipX = focusedPoint ? getX(focusedPoint.day) : margin.left;
  const tooltipY = focusedPoint ? getY(focusedPoint.total) : margin.top;
  const clampedTooltipX = Math.min(
    svgWidth - margin.right - 56,
    Math.max(margin.left + 56, tooltipX)
  );

  if (expenses.length === 0) {
    return (
      <section
        id="grafico"
        aria-labelledby="dashboard-vacio-titulo"
        className="card-mockup p-6 sm:p-8 flex flex-col items-center justify-center text-center min-h-[300px]"
      >
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-[#0B1739] flex items-center justify-center mb-4">
          <BarChart3 className="w-6 h-6" strokeWidth={1.9} aria-hidden="true" />
        </div>
        <h2
          id="dashboard-vacio-titulo"
          className="text-xl font-display font-bold text-[#0B1739] tracking-tight"
        >
          Aún no hay gastos este mes
        </h2>
        <p className="text-sm text-slate-500 mt-2 max-w-sm">
          Registra el primero y empieza a ver en qué se va la plata
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={onRegisterFirstExpense}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#5B3DF5] hover:bg-[#492CE0] text-white text-sm font-semibold shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
            <span>Registrar tu primer gasto</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      id="grafico"
      aria-labelledby="grafico-gastos-titulo"
      className="card-mockup p-6 sm:p-7 flex flex-col justify-between"
    >
      {/* Top Row matching the mockup's Revenue card header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2
            id="grafico-gastos-titulo"
            className="text-sm font-medium text-slate-500"
          >
            Gastos diarios
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <span className="text-2xl sm:text-[28px] font-display font-bold text-[#0B1739] tracking-tight tabular-cop leading-none">
              {formatCOP(totalSpent)}
            </span>
            {/* Mini green sparkline matching mockup */}
            <svg
              width="34"
              height="18"
              viewBox="0 0 34 18"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 15L10 9L17 12L26 3L32 6"
                stroke="#16A34A"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 tabular-cop">
              {formatPercent(spentPct)} del mes
            </span>
          </div>
        </div>

        {/* Right Controls: Mode toggle pill + 2-dot Legend */}
        <div className="flex flex-col sm:items-end gap-2.5">
          <button
            type="button"
            onClick={() =>
              setChartMode((prev) => (prev === 'curve' ? 'bars' : 'curve'))
            }
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-[#0B1739] transition-colors self-start sm:self-end cursor-pointer whitespace-nowrap"
          >
            <span>
              {chartMode === 'curve' ? 'Vista: Curva diaria' : 'Vista: Barras'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          </button>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full bg-[#0B1739]"
                aria-hidden="true"
              />
              Gasto diario
            </span>
            {chartMode === 'curve' && (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full bg-[#7AA7FF]"
                  aria-hidden="true"
                />
                Tendencia (3 días)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Interactive SVG Chart */}
      <div className="mt-4 w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto select-none"
          role="img"
          aria-label={`Gráfico de gastos diarios de ${monthLabel}`}
        >
          {/* Horizontal Dashed Gridlines */}
          {yTicks.map((tickVal) => {
            const y = getY(tickVal);
            return (
              <g key={tickVal}>
                <line
                  x1={margin.left}
                  y1={y}
                  x2={svgWidth - margin.right}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
                <text
                  x={margin.left - 12}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-400 text-[11px] font-medium tabular-cop"
                >
                  {formatCompactCOP(tickVal)}
                </text>
              </g>
            );
          })}

          {/* Curve Mode (Mockup Signature Smooth Dual-Spline) */}
          {chartMode === 'curve' && (
            <g>
              {/* Secondary Periwinkle Curve (Rolling Average) */}
              <path
                d={avgPath}
                fill="none"
                stroke="#8AAEF9"
                strokeWidth={2.2}
                strokeLinecap="round"
              />

              {/* Primary Dark Navy Curve (Daily Expenses) */}
              <path
                d={primaryPath}
                fill="none"
                stroke="#0B1739"
                strokeWidth={2.4}
                strokeLinecap="round"
              />

              {/* Focused Marker & Floating Value Pill */}
              {focusedPoint && (
                <g>
                  <circle
                    cx={tooltipX}
                    cy={tooltipY}
                    r={5.5}
                    fill="#0B1739"
                    stroke="#FFFFFF"
                    strokeWidth={2.5}
                  />
                  {/* Floating Pill Tooltip matching $1,790 in mockup */}
                  <g
                    transform={`translate(${clampedTooltipX}, ${Math.max(
                      16,
                      tooltipY - 26
                    )})`}
                  >
                    <rect
                      x={-54}
                      y={-12}
                      width={108}
                      height={24}
                      rx={12}
                      fill="#EDF2FC"
                      stroke="#DCE6F9"
                      strokeWidth={1}
                    />
                    <text
                      x={0}
                      y={4}
                      textAnchor="middle"
                      className="fill-[#0B1739] text-[11px] font-bold tabular-cop"
                    >
                      {formatCOP(focusedPoint.total)}
                    </text>
                  </g>
                </g>
              )}

              {/* Invisible interactive hit columns */}
              {dailyPoints.map((d) => {
                const cx = getX(d.day);
                return (
                  <rect
                    key={d.day}
                    x={cx - slotWidth / 2}
                    y={margin.top}
                    width={slotWidth}
                    height={plotHeight + 16}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredDay(d.day)}
                    onMouseLeave={() => setHoveredDay(null)}
                    onClick={() =>
                      onSelectDay(selectedDay === d.day ? null : d.day)
                    }
                  />
                );
              })}
            </g>
          )}

          {/* Bars Mode */}
          {chartMode === 'bars' &&
            dailyPoints.map((d) => {
              const cx =
                margin.left +
                ((d.day - 0.5) / Math.max(1, dailyPoints.length)) * plotWidth;
              const isHighlighted = focusedDayNum === d.day;
              const barHeight =
                d.total > 0
                  ? Math.max(4, (d.total / yMax) * plotHeight)
                  : 2;
              const barY = margin.top + plotHeight - barHeight;

              return (
                <g key={d.day}>
                  <rect
                    x={cx - barWidth / 2}
                    y={barY}
                    width={barWidth}
                    height={barHeight}
                    rx={4}
                    fill={isHighlighted ? '#2563EB' : '#0B1739'}
                    opacity={isHighlighted ? 1 : 0.85}
                    className="transition-opacity duration-150"
                  />
                  <rect
                    x={cx - slotWidth / 2}
                    y={margin.top}
                    width={slotWidth}
                    height={plotHeight + 16}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredDay(d.day)}
                    onMouseLeave={() => setHoveredDay(null)}
                    onClick={() =>
                      onSelectDay(selectedDay === d.day ? null : d.day)
                    }
                  />
                </g>
              );
            })}

          {/* X-axis Day Labels */}
          {xTicks.map((day) => {
            const x =
              chartMode === 'curve'
                ? getX(day)
                : margin.left +
                  ((day - 0.5) / Math.max(1, dailyPoints.length)) * plotWidth;
            const isFocused = focusedDayNum === day;
            return (
              <text
                key={day}
                x={x}
                y={svgHeight - 8}
                textAnchor="middle"
                className={`text-[11px] tabular-cop ${
                  isFocused
                    ? 'fill-[#2563EB] font-bold'
                    : 'fill-slate-400 font-medium'
                }`}
              >
                {day} {monthLabel.slice(0, 3).toLowerCase()}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Subtle Active Day Detail Footer */}
      <div className="mt-2 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        {focusedPoint ? (
          <div className="min-w-0 truncate">
            <span className="font-semibold text-[#0B1739]">
              {focusedPoint.fullDateLabel}:
            </span>{' '}
            <span className="tabular-cop">
              {focusedPoint.items.length > 0
                ? focusedPoint.items
                    .map((i) => `${i.concept} (${formatCOP(i.amount)})`)
                    .join(' · ')
                : 'Sin gastos registrados'}
            </span>
          </div>
        ) : null}
        <span className="tabular-cop shrink-0 text-slate-400">
          Pico: {peakDay.day} {monthLabel.slice(0, 3).toLowerCase()} (
          {formatCOP(peakDay.total)})
        </span>
      </div>
    </section>
  );
}

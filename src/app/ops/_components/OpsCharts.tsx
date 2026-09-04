"use client";

import { OpsEmpty } from "@/app/ops/_components/OpsChartCard";
import { OPS_CHART, shortDay } from "@/app/ops/_components/chartTheme";
import { formatInt } from "@/app/ops/_components/format";
import { cn } from "@/lib/utils";

function polar(cx: number, cy: number, r: number, angle: number): [number, number] {
  const rad = ((angle - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function donutSlice(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  start: number,
  end: number,
): string {
  const [ox1, oy1] = polar(cx, cy, outer, start);
  const [ox2, oy2] = polar(cx, cy, outer, end);
  const [ix1, iy1] = polar(cx, cy, inner, end);
  const [ix2, iy2] = polar(cx, cy, inner, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${ox1} ${oy1} A ${outer} ${outer} 0 ${large} 1 ${ox2} ${oy2} L ${ix1} ${iy1} A ${inner} ${inner} 0 ${large} 0 ${ix2} ${iy2} Z`;
}

export function OpsDonut({
  data,
  onSlice,
  activeId,
}: {
  data: { id: string; name: string; value: number; fill: string }[];
  onSlice?: (id: string) => void;
  activeId?: string;
}) {
  const total = data.reduce((sum, row) => sum + row.value, 0);
  if (total <= 0) return <OpsEmpty />;
  let cursor = 0;
  const slices = data
    .filter((row) => row.value > 0)
    .map((row) => {
      const start = (cursor / total) * 360;
      cursor += row.value;
      const end = (cursor / total) * 360;
      return { ...row, start, end: Math.min(end, start + 359.99) };
    });
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 120 120" className="h-44 w-44 shrink-0">
        {slices.map((row) => (
          <path
            key={row.id}
            d={donutSlice(60, 60, 32, 52, row.start, row.end)}
            fill={row.fill}
            opacity={activeId && activeId !== row.id ? 0.4 : 1}
            className={onSlice ? "cursor-pointer" : undefined}
            onClick={() => onSlice?.(row.id)}
          >
            <title>
              {row.name}: {formatInt(row.value)}
            </title>
          </path>
        ))}
        <text
          x="60"
          y="56"
          textAnchor="middle"
          className="fill-podium-white"
          fontSize="14"
          fontWeight="800"
        >
          {formatInt(total)}
        </text>
        <text
          x="60"
          y="72"
          textAnchor="middle"
          className="fill-podium-muted"
          fontSize="8"
        >
          total
        </text>
      </svg>
      <ul className="min-w-0 space-y-1.5 text-xs text-podium-gray">
        {data.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 text-left",
                onSlice && "hover:text-podium-white",
                activeId === row.id && "font-bold text-podium-white",
              )}
              onClick={() => onSlice?.(row.id)}
              disabled={!onSlice}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.fill }}
              />
              <span className="truncate">{row.name}</span>
              <span className="ml-auto font-semibold text-podium-white">
                {formatInt(row.value)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OpsHBar({
  data,
  onBar,
  activeId,
  color = OPS_CHART.active,
}: {
  data: { id: string; name: string; value: number }[];
  onBar?: (id: string) => void;
  activeId?: string;
  color?: string;
}) {
  if (data.length === 0 || data.every((row) => row.value <= 0)) {
    return <OpsEmpty />;
  }
  const max = Math.max(...data.map((row) => row.value), 1);
  return (
    <ul className="space-y-2">
      {data.map((row) => {
        const width = Math.max(4, (row.value / max) * 100);
        const active = activeId === row.id;
        const inner = (
          <>
            <div className="mb-1 flex justify-between gap-2 text-xs text-podium-gray">
              <span className={cn("truncate", active && "font-bold text-podium-white")}>
                {row.name}
              </span>
              <span className="shrink-0 font-semibold text-podium-white">
                {formatInt(row.value)}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${width}%`,
                  backgroundColor: color,
                  opacity: activeId && !active ? 0.4 : 1,
                }}
              />
            </div>
          </>
        );
        if (!onBar) return <li key={row.id}>{inner}</li>;
        return (
          <li key={row.id}>
            <button type="button" className="w-full text-left" onClick={() => onBar(row.id)}>
              {inner}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function money(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function lineChart({
  data,
  series,
  stacked,
  asMoney,
}: {
  data: Record<string, string | number>[];
  series: { key: string; name: string; color: string }[];
  stacked?: boolean;
  asMoney?: boolean;
}) {
  if (data.length === 0) return <OpsEmpty />;
  const width = 320;
  const height = 160;
  const pad = { l: asMoney ? 44 : 32, r: 8, t: 8, b: 22 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const keys = series.map((item) => item.key);
  const totals = data.map((row) =>
    stacked
      ? keys.reduce((sum, key) => sum + Number(row[key] ?? 0), 0)
      : Math.max(...keys.map((key) => Number(row[key] ?? 0)), 0),
  );
  const max = Math.max(...totals, 1);
  const x = (i: number) =>
    pad.l + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (value: number) => pad.t + innerH - (value / max) * innerH;

  const paths = series.map((item, seriesIndex) => {
    const top = data.map((row, i) => {
      const value = Number(row[item.key] ?? 0);
      const below = stacked
        ? keys
            .slice(0, seriesIndex)
            .reduce((sum, key) => sum + Number(row[key] ?? 0), 0)
        : 0;
      return { x: x(i), y: y(below + value), base: y(below) };
    });
    const line = top
      .map((point, i) => `${i === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
      .join(" ");
    const area = stacked
      ? `${line} ${[...top]
          .reverse()
          .map((point) => `L ${point.x.toFixed(1)} ${point.base.toFixed(1)}`)
          .join(" ")} Z`
      : `${line} L ${top[top.length - 1]!.x.toFixed(1)} ${y(0).toFixed(1)} L ${top[0]!.x.toFixed(1)} ${y(0).toFixed(1)} Z`;
    return { ...item, line, area };
  });

  const ticks = [0, 0.5, 1].map((t) => max * t);
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={y(tick)}
              y2={y(tick)}
              stroke={OPS_CHART.grid}
            />
            <text
              x={pad.l - 4}
              y={y(tick) + 3}
              textAnchor="end"
              fill={OPS_CHART.tick}
              fontSize="8"
            >
              {asMoney
                ? new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(tick / 100)
                : formatInt(Math.round(tick))}
            </text>
          </g>
        ))}
        {paths.map((item) => (
          <g key={item.key}>
            <path d={item.area} fill={item.color} opacity={0.28} />
            <path d={item.line} fill="none" stroke={item.color} strokeWidth="1.6" />
          </g>
        ))}
        {data.map((row, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <text
              key={String(row.day)}
              x={x(i)}
              y={height - 6}
              textAnchor="middle"
              fill={OPS_CHART.tick}
              fontSize="8"
            >
              {shortDay(String(row.day))}
            </text>
          ) : null,
        )}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-podium-gray">
        {series.map((item) => (
          <li key={item.key} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.name}
          </li>
        ))}
      </ul>
      {data.length > 0 ? (
        <p className="sr-only">
          {series
            .map((item) => {
              const last = Number(data[data.length - 1]?.[item.key] ?? 0);
              return `${item.name}: ${asMoney ? money(last) : formatInt(last)}`;
            })
            .join("; ")}
        </p>
      ) : null}
    </div>
  );
}

export function OpsStackedArea({
  data,
  series,
  asMoney = false,
}: {
  data: Record<string, string | number>[];
  series: { key: string; name: string; color: string }[];
  asMoney?: boolean;
}) {
  return lineChart({ data, series, stacked: true, asMoney });
}

export function OpsLines({
  data,
  series,
  asMoney = false,
}: {
  data: Record<string, string | number>[];
  series: { key: string; name: string; color: string }[];
  asMoney?: boolean;
}) {
  return lineChart({ data, series, stacked: false, asMoney });
}

export function OpsFunnelBars({
  steps,
}: {
  steps: { id: string; label: string; count: number }[];
}) {
  const max = Math.max(...steps.map((step) => step.count), 0);
  if (max <= 0) return <OpsEmpty />;
  return (
    <ul className="space-y-2">
      {steps.map((step, index) => {
        const width = max ? Math.max(8, (step.count / max) * 100) : 0;
        const prev = index === 0 ? step.count : steps[index - 1]!.count;
        const conv = prev ? Math.round((step.count / prev) * 100) : 0;
        return (
          <li key={step.id}>
            <div className="mb-1 flex justify-between gap-2 text-xs text-podium-gray">
              <span>{step.label}</span>
              <span className="font-semibold text-podium-white">
                {formatInt(step.count)}
                {index > 0 ? (
                  <span className="ml-2 font-normal text-podium-muted">
                    {conv}% da etapa anterior
                  </span>
                ) : null}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-podium-yellow"
                style={{ width: `${width}%`, opacity: 1 - index * 0.12 }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

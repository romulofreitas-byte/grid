import { COPY } from "@/lib/copy";
import type { BoxRhythm } from "@/lib/box/rhythm";
import { rhythmNeedsPulse } from "@/lib/box/rhythm";

const YELLOW = "#f5b301";
const WHATSAPP = "#38bdf8";

function sparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  const max = Math.max(...values, 1);
  if (values.length === 1) {
    const y = height - (values[0]! / max) * height;
    return `M 0 ${y.toFixed(1)} L ${width} ${y.toFixed(1)}`;
  }
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - (value / max) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function Spark({ values }: { values: number[] }) {
  const width = 72;
  const height = 16;
  const line = sparklinePath(values, width, height);
  if (!line) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-4 w-16 shrink-0"
        aria-hidden="true"
      />
    );
  }
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-4 w-16 shrink-0"
      aria-hidden="true"
    >
      <path d={line} fill="none" stroke={YELLOW} strokeWidth="1" />
    </svg>
  );
}

function Split({ ligar, whatsapp }: { ligar: number; whatsapp: number }) {
  const total = ligar + whatsapp;
  if (total <= 0) {
    return <div className="h-1 w-16 rounded-full bg-zinc-200" />;
  }
  return (
    <div className="flex h-1 w-16 overflow-hidden rounded-full bg-zinc-200">
      {ligar > 0 ? (
        <span
          className="h-full"
          style={{ width: `${(ligar / total) * 100}%`, backgroundColor: YELLOW }}
        />
      ) : null}
      {whatsapp > 0 ? (
        <span
          className="h-full"
          style={{ width: `${(whatsapp / total) * 100}%`, backgroundColor: WHATSAPP }}
        />
      ) : null}
    </div>
  );
}

export function BoxRhythmStrip({
  rhythm,
  overdueCount,
}: {
  rhythm: BoxRhythm;
  overdueCount: number;
}) {
  const done = rhythm.crmCallsToday + rhythm.crmWhatsappToday;
  const pulse = rhythmNeedsPulse(rhythm, overdueCount);
  return (
    <div className="relative shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-white">
      <div
        className="telemetry-bar"
        aria-hidden="true"
        data-active={pulse ? "1" : "0"}
      />
      <div className="flex min-w-0 items-center gap-4 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400">
            {COPY.boxRhythmCalls}
          </p>
          <p className="tabular-nums text-sm font-medium tracking-tight text-zinc-800">
            {`${rhythm.callsToday} / ${rhythm.callGoal}`}
          </p>
          <Spark values={rhythm.habit.map((point) => point.calls)} />
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400">
            {COPY.boxRhythmDone}
          </p>
          <p className="tabular-nums text-sm font-medium tracking-tight text-zinc-800">
            {done}
          </p>
          <Split ligar={rhythm.crmCallsToday} whatsapp={rhythm.crmWhatsappToday} />
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400">
            {COPY.boxRhythmAdvance}
          </p>
          <p className="tabular-nums text-sm font-medium tracking-tight text-zinc-800">
            {rhythm.crmMeetingsToday}
          </p>
          <p className="hidden truncate text-[11px] text-zinc-400 sm:block">
            reuniões hoje
          </p>
        </div>
      </div>
    </div>
  );
}

export { sparklinePath };

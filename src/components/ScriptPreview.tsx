import { GOLDEN_MINUTE_PLACEHOLDER } from "@/lib/golden-minute";
import {
  ANATOMY_BEATS,
  anatomyBeatsFromScript,
  buildOpeningScript,
} from "@/lib/golden-minute-script";
import { resolveMarketBrief } from "@/lib/market/resolve";
import type { ScriptProfile } from "@/lib/golden-minute-script";

export function ScriptPreview({
  profile,
}: {
  profile: ScriptProfile;
}) {
  const market = resolveMarketBrief({
    cnaeDescricao: "",
    municipioNome: profile.cidade_usuario?.trim() || "sua cidade",
  });
  const beats = anatomyBeatsFromScript(
    buildOpeningScript(profile, {
      decisorNome: "João Carlos",
      market,
    }),
  );
  return (
    <div className="rounded-xl border border-white/10 bg-podium-navy/60 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-podium-yellow">
        Anatomia da Ligação
      </p>
      <ol className="mt-2 space-y-2">
        {ANATOMY_BEATS.map((label, i) => (
          <li key={label}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-podium-muted">
              {i + 1} · {label}
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-podium-gray">
              {beats[i] || GOLDEN_MINUTE_PLACEHOLDER}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

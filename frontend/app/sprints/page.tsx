"use client";

import { SprintOccupancyChart } from "@/components/charts/SprintOccupancyChart";
import { Icon } from "@/components/layout/Icon";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { fmtData, fmtDec, fmtHoras, fmtInt, fmtPct } from "@/lib/format";
import { useParams, useSprints } from "@/lib/hooks";
import { useSim } from "@/lib/store";
import type { SprintRow } from "@/lib/types";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";

export default function SprintsPage() {
  const params = useParams();
  const cenario = useSim((s) => s.cenario);
  const { data, isLoading } = useSprints(params);
  const [sel, setSel] = useState<number | null>(null);
  const [limit, setLimit] = useState(24);

  const resumo = data?.resumo_sprints ?? [];
  const aloc = data?.alocacao ?? [];
  const kpis = data?.kpis;

  const selItems = useMemo(() => {
    if (sel == null) return [];
    return aloc.filter((a) => a.sprint_inicial <= sel && a.sprint_final >= sel);
  }, [aloc, sel]);

  const ultimoFim = resumo.length ? resumo[resumo.length - 1].data_fim : null;
  const cruzam = aloc.filter((a) => a.sprint_final > a.sprint_inicial).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Planejamento"
        title="Sprint Planner"
        description="Empacotamento greedy por prioridade. Capacidade = nº consultores × horas/dia × 10. Um EGP grande pode atravessar sprints — as horas são divididas. A soma das horas alocadas reconcilia com o esforço total."
        actions={
          <Badge tone={cenario === "bruto" ? "accent" : "electric"}>
            {cenario === "bruto" ? "Bruto" : "Sem-dup"}
          </Badge>
        }
      />

      {isLoading || !kpis ? (
        <Skeleton className="h-24" />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MiniKpi label="Nº de sprints" value={fmtInt(resumo.length)} icon="Calendar" />
          <MiniKpi
            label="Término estimado"
            value={fmtData(ultimoFim)}
            icon="Flag"
            accent
          />
          <MiniKpi label="Esforço total (×K)" value={fmtHoras(kpis.esforco_total)} icon="Flash" />
          <MiniKpi
            label="Itens que cruzam sprints"
            value={fmtInt(cruzam)}
            icon="ArrowSwapHorizontal"
            accent
          />
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-bold text-ink">Ocupação por sprint</h2>
        <Card className="p-5">
          {isLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <>
              <SprintOccupancyChart data={resumo} />
              <p className="mt-2 text-center text-[11px] text-ink-faint">
                {resumo.length > 60
                  ? `Mostrando os primeiros 60 de ${fmtInt(resumo.length)} sprints.`
                  : `${fmtInt(resumo.length)} sprints.`}
              </p>
            </>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <h2 className="mb-3 text-lg font-bold text-ink">Sprints</h2>
          {isLoading ? (
            <Skeleton className="h-96" />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {resumo.slice(0, limit).map((sp, i) => (
                  <SprintCard
                    key={sp.sprint}
                    sp={sp}
                    selected={sel === sp.sprint}
                    onSelect={() => setSel(sel === sp.sprint ? null : sp.sprint)}
                    delay={i * 0.02}
                  />
                ))}
              </div>
              {limit < resumo.length && (
                <button
                  onClick={() => setLimit((l) => l + 24)}
                  className="mt-3 w-full rounded-xl border border-line bg-white/5 py-2.5 text-sm font-medium text-ink-muted hover:text-ink"
                >
                  Carregar mais ({fmtInt(resumo.length - limit)} restantes)
                </button>
              )}
            </>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-lg font-bold text-ink">
            {sel ? `Itens do sprint ${sel}` : "Detalhe do sprint"}
          </h2>
          <Card className="p-5">
            {sel == null ? (
              <p className="py-12 text-center text-sm text-ink-muted">
                Selecione um sprint ao lado para ver os itens alocados.
              </p>
            ) : selItems.length === 0 ? (
              <p className="py-12 text-center text-sm text-ink-muted">Sprint vazio.</p>
            ) : (
              <div className="max-h-[520px] space-y-2 overflow-y-auto">
                {selItems.map((it) => (
                  <div
                    key={`${it.tipo}:${it.nome}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-base-900/40 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge tone={it.tipo === "egp" ? "accent" : "electric"}>
                          {it.tipo === "egp" ? "EGP" : "órfão"}
                        </Badge>
                        {it.sprint_final > it.sprint_inicial && (
                          <span className="text-[10px] text-ink-faint">
                            sprints {it.sprint_inicial}–{it.sprint_final}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-ink-muted" title={it.nome}>
                        {it.nome}
                      </p>
                    </div>
                    <span className="num shrink-0 text-sm font-semibold text-ink">
                      {fmtHoras(it.horas, 1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function SprintCard({
  sp,
  selected,
  onSelect,
  delay,
}: {
  sp: SprintRow;
  selected: boolean;
  onSelect: () => void;
  delay: number;
}) {
  const occ = sp.capacidade > 0 ? (sp.horas_alocadas / sp.capacidade) * 100 : 0;
  const full = occ >= 99.9;
  return (
    <motion.button
      onClick={onSelect}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`rounded-2xl border p-4 text-left transition-all ${
        selected
          ? "border-accent/40 bg-accent/10 shadow-glow"
          : "border-line bg-base-800/50 hover:bg-base-700/50"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-ink">Sprint {sp.sprint}</span>
        <span className={`text-xs font-semibold ${full ? "text-accent-soft" : "text-electric-soft"}`}>
          {fmtPct(occ)}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-ink-faint">
        {fmtData(sp.data_inicio)} → {fmtData(sp.data_fim)}
      </p>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full ${full ? "bg-grad-accent" : "bg-grad-electric"}`}
          style={{ width: `${Math.min(100, occ)}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-ink-muted">
        <span className="num">{fmtHoras(sp.horas_alocadas)}</span>
        <span>{fmtInt(sp.itens_no_sprint)} itens</span>
      </div>
    </motion.button>
  );
}

function MiniKpi({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className={accent ? "text-accent-soft" : "text-electric-soft"}>
        <Icon name={icon} size={22} variant="Bold" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
        <p className="num truncate text-lg font-bold text-ink">{value}</p>
      </div>
    </Card>
  );
}

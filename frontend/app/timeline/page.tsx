"use client";

import { MigrateBanner } from "@/components/domain/MigrateBanner";
import { Icon } from "@/components/layout/Icon";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { fmtData, fmtDec, fmtHoras, fmtInt, fmtPct } from "@/lib/format";
import { useEgps, useMigrate, useMigrateGain, useOrphans, useParams, useSprints } from "@/lib/hooks";
import { useSim } from "@/lib/store";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";

export default function TimelinePage() {
  const params = useParams();
  const cenario = useSim((s) => s.cenario);
  const gain = useMigrateGain();
  const { data, isLoading } = useSprints(params);
  const { data: mig } = useMigrate(params, gain);
  const { data: egpsData } = useEgps(params, gain);
  const { data: orphansData } = useOrphans(params);
  const migActive = mig?.[cenario];
  const [topN, setTopN] = useState(20);

  const resumo = data?.resumo_sprints ?? [];
  const aloc = data?.alocacao ?? [];
  const totalSprints = resumo.length;

  // Razão de redução do Migrate por item (chave `${tipo}:${nome}`): EGP vem do
  // esforço migrado por EGP; órfão, do ganho da sua categoria (sem Job).
  const migRatio = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of egpsData?.egps ?? []) {
      m.set(`egp:${e.egp_name}`, e.horas_total > 0 ? e.horas_total_migrate / e.horas_total : 1);
    }
    for (const o of orphansData?.orphans ?? []) {
      m.set(`orfao:${o.file_name}`, 1 - (gain[o.categoria] ?? 0) / 100);
    }
    return m;
  }, [egpsData, orphansData, gain]);

  const top = useMemo(
    () => aloc.slice().sort((a, b) => b.horas - a.horas).slice(0, topN),
    [aloc, topN]
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Cronograma"
        title="Timeline"
        description="Visão cronológica dos maiores itens da fila ao longo dos sprints. Cada barra mostra de qual a qual sprint o item se estende (itens grandes atravessam sprints)."
        actions={
          <div className="flex items-center gap-3">
            <SegmentedControl
              size="sm"
              value={String(topN)}
              onChange={(v) => setTopN(Number(v))}
              options={[
                { value: "20", label: "Top 20" },
                { value: "40", label: "Top 40" },
                { value: "60", label: "Top 60" },
              ]}
            />
            <Badge tone={cenario === "bruto" ? "accent" : "electric"}>
              {cenario === "bruto" ? "Bruto" : "Sem-dup"}
            </Badge>
          </div>
        }
      />

      {migActive && (
        <MigrateBanner
          ganhoPct={migActive.ganho_pct}
          title="Com Migrate, a linha do tempo encurta"
          subtitle="projeção (MigrateMind) — as barras abaixo refletem o plano do cenário manual"
          stats={[
            {
              label: "Sprints",
              value: `${fmtInt(migActive.manual.n_sprints)} → ${fmtInt(migActive.migrate.n_sprints)}`,
            },
            {
              label: "Duração",
              value: `${fmtDec(migActive.manual.duracao_dias_uteis)} → ${fmtDec(migActive.migrate.duracao_dias_uteis)} dias`,
            },
            {
              label: "Economia",
              value: `−${fmtHoras(migActive.economia_horas)}`,
              success: true,
            },
          ]}
        />
      )}

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <Card className="p-5">
          {/* régua de sprints */}
          <div className="mb-3 flex items-center justify-between text-[11px] text-ink-faint">
            <span>Sprint 1 · {fmtData(resumo[0]?.data_inicio)}</span>
            <span>
              Sprint {totalSprints} · {fmtData(resumo[totalSprints - 1]?.data_fim)}
            </span>
          </div>

          <div className="space-y-2">
            {top.map((it, i) => {
              const left = ((it.sprint_inicial - 1) / totalSprints) * 100;
              const width = Math.max(
                1.5,
                ((it.sprint_final - it.sprint_inicial + 1) / totalSprints) * 100
              );
              const ratio = migRatio.get(`${it.tipo}:${it.nome}`) ?? 1;
              const migHoras = it.horas * ratio;
              const ganho = it.horas > 0 ? (1 - ratio) * 100 : 0;
              return (
                <div key={`${it.tipo}:${it.nome}`} className="flex items-center gap-3">
                  <div className="w-44 shrink-0 truncate text-right text-xs text-ink-muted" title={it.nome}>
                    {it.nome}
                  </div>
                  <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-black/[0.05]">
                    <motion.div
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: `${width}%`, opacity: 1 }}
                      transition={{ delay: i * 0.03, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      className={`absolute top-0 flex h-full items-center rounded-lg px-2 text-[10px] font-semibold text-white ${
                        it.tipo === "egp" ? "bg-grad-accent" : "bg-grad-electric"
                      }`}
                      style={{ left: `${left}%` }}
                      title={`${it.nome} · sprints ${it.sprint_inicial}–${it.sprint_final} · manual ${fmtHoras(it.horas)} → Migrate ${fmtHoras(migHoras)}`}
                    >
                      <span className="num truncate">{fmtHoras(it.horas, 0)}</span>
                    </motion.div>
                  </div>
                  <div className="w-28 shrink-0 text-[11px] leading-tight text-ink-faint">
                    <div>
                      spr {it.sprint_inicial}
                      {it.sprint_final > it.sprint_inicial ? `–${it.sprint_final}` : ""}
                    </div>
                    <div className="num text-success">
                      → {fmtHoras(migHoras, 0)}{" "}
                      <span className="text-ink-faint">−{fmtPct(ganho, 0)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-center gap-5 border-t border-line pt-4 text-xs text-ink-muted">
            <span className="flex items-center gap-2">
              <span className="h-3 w-5 rounded bg-grad-accent" /> EGP
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-5 rounded bg-grad-electric" /> SAS (sem EGP)
            </span>
            <span className="flex items-center gap-2 text-success">
              → esforço com Migrate (por item)
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <Icon name="InfoCircle" size={14} />
              {fmtInt(totalSprints)} sprints no total
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}

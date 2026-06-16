"use client";

import { MigrateCompare } from "@/components/domain/MigrateCompare";
import { Icon } from "@/components/layout/Icon";
import { Badge, categoriaTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { diasParaAnos, fmtDec, fmtHoras, fmtInt, fmtPct } from "@/lib/format";
import { useMigrate, useMigrateGain, useParams } from "@/lib/hooks";
import { useSim } from "@/lib/store";
import type { MigrateCategoriaRow } from "@/lib/types";
import { motion } from "framer-motion";
import Link from "next/link";

export default function MigratePage() {
  const s = useSim();
  const params = useParams();
  const gain = useMigrateGain();
  const { data, isLoading } = useMigrate(params, gain);
  const active = data?.[s.cenario];

  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="Migrate · MigrateMind"
        title="Tempo de Desenvolvimento"
        description="Quanto a migração assistida pela ferramenta Migrate (MigrateMind) reduz o esforço de conversão SAS → PySpark. O ganho é aplicado por complexidade sobre as horas de conversão de código — o overhead de Job (orquestração) não muda."
        actions={
          <div className="flex items-center gap-3">
            <SegmentedControl
              size="sm"
              value={s.cenario}
              onChange={s.setCenario}
              options={[
                { value: "bruto", label: "Bruto" },
                { value: "sem_dup", label: "Sem-dup" },
              ]}
            />
            <Link href="/migrate/config">
              <Button variant="ghost">
                <Icon name="Setting2" size={16} /> Calibrar ganho
              </Button>
            </Link>
          </div>
        }
      />

      {/* Banner MigrateMind */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card className="relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-success/20 blur-3xl" />
          <div className="relative flex flex-wrap items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-grad-accent shadow-glow">
              <Icon name="MagicStar" size={22} color="#fff" variant="Bold" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-ink">
                Migração assistida por IA (Codex) sobre Databricks
              </p>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-muted">
                O MigrateMind segmenta cada programa SAS em passos, converte cada
                um para PySpark, executa no Databricks, captura erros e repara em
                loop até certificar o resultado. Em testes de campo, código de
                baixa complexidade alcançou <span className="font-semibold text-success">mais de 90% de ganho</span> de
                tempo de desenvolvimento; código muito complexo ainda exige
                revisão manual relevante. Os percentuais por complexidade são
                ajustáveis na tela de calibração.
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* KPIs Migrate */}
      {isLoading || !active ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Esforço com Migrate"
            value={active.migrate.esforco_total}
            format={(v) => fmtHoras(v)}
            accent="electric"
            icon={<Icon name="Flash" size={20} variant="Bold" />}
            sub={`manual: ${fmtHoras(active.manual.esforco_total)}`}
            hint="Esforço total (conversão .sas reduzida pelo ganho + overhead de Job inalterado) × K. Vem de core.compute_migrate."
          />
          <KpiCard
            label="Economia de esforço"
            value={active.economia_horas}
            format={(v) => "−" + fmtHoras(v)}
            icon={<Icon name="TrendDown" size={20} variant="Bold" />}
            sub={`ganho de ${fmtPct(active.ganho_pct, 1)} sobre o total`}
            hint="Diferença entre o esforço manual e o esforço com Migrate (sobre o esforço total, incluindo o overhead de Job que não é reduzido)."
            delay={0.05}
          />
          <KpiCard
            label="Duração com Migrate"
            value={active.migrate.duracao_dias_uteis}
            format={(v) => fmtDec(v) + " dias"}
            accent="electric"
            icon={<Icon name="Calendar1" size={20} variant="Bold" />}
            sub={`manual: ${fmtDec(active.manual.duracao_dias_uteis)} dias · ${diasParaAnos(active.migrate.duracao_dias_uteis)}`}
            hint="Dias úteis = esforço com Migrate ÷ (nº consultores × horas/dia). Mesma fórmula do cenário manual."
            delay={0.1}
          />
          <KpiCard
            label="Sprints com Migrate"
            value={active.migrate.n_sprints}
            format={(v) => fmtInt(v)}
            icon={<Icon name="Calendar" size={20} variant="Bold" />}
            sub={`manual: ${fmtInt(active.manual.n_sprints)} sprints`}
            hint="esforço com Migrate ÷ capacidade do sprint (nº consultores × horas/dia × 10)."
            delay={0.15}
          />
        </div>
      )}

      {/* Comparação + ganho por complexidade */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 className="mb-3 text-lg font-bold text-ink">Manual × Com Migrate</h2>
          {active ? <MigrateCompare data={active} /> : <Skeleton className="h-80" />}
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink">Ganho por complexidade</h2>
            <Badge tone={s.cenario === "bruto" ? "accent" : "electric"}>
              {s.cenario === "bruto" ? "Bruto" : "Sem-dup"}
            </Badge>
          </div>
          <Card className="p-5">
            {active ? (
              <CategoriaGanho rows={active.por_categoria} />
            ) : (
              <Skeleton className="h-80" />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Barras manual × migrate por categoria, com ganho % e economia. */
function CategoriaGanho({ rows }: { rows: MigrateCategoriaRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.horas_manual));
  return (
    <div className="space-y-4">
      {rows.map((r, i) => {
        const wManual = (r.horas_manual / max) * 100;
        const wMigrate = (r.horas_migrate / max) * 100;
        return (
          <motion.div
            key={r.categoria}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <Badge tone={categoriaTone(r.categoria)}>{r.categoria}</Badge>
                <span className="text-ink-faint">{fmtInt(r.n_sas)} .sas</span>
              </span>
              <span className="num font-semibold text-success">
                −{fmtPct(r.ganho_pct, 0)}
              </span>
            </div>
            <div className="relative h-6 overflow-hidden rounded-lg bg-white/[0.03]">
              {/* manual (fundo) */}
              <div
                className="absolute inset-y-0 left-0 rounded-lg bg-white/10"
                style={{ width: `${wManual}%` }}
              />
              {/* migrate (frente) */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${wMigrate}%` }}
                transition={{ delay: i * 0.05 + 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-y-0 left-0 rounded-lg bg-grad-accent"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-ink-faint">
              <span className="num">manual {fmtHoras(r.horas_manual)}</span>
              <span className="num text-success">
                Migrate {fmtHoras(r.horas_migrate)} · −{fmtHoras(r.economia_horas)}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
